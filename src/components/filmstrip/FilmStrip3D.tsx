'use client';

/**
 * FilmStrip3D v3 — a cinematic 35mm film strip that bends / twists / spirals through
 * space using nothing but CSS 3D transforms and ONE requestAnimationFrame loop.
 *
 *  - No WebGL, no three.js, no dependencies.
 *  - The strip is ONE continuous ribbon: the black film BASE is built from many thin SLICES
 *    (~26 world px wide, ~110 of them) laid along the 3D path. Each slice is posed from the chord
 *    between two points of the path (its left/right edges ARE path samples, so neighbours share
 *    their edge to <1px) and overlaps its right neighbour by a couple of px on a solid black
 *    background, so no page background can show through at any bend angle.
 *  - The photos are NOT separate flat cards: every slice carries a clipped window onto "its"
 *    photo (a child element `.ph` of full photo size, clipped by the slice). The photo therefore
 *    bends with the film, has real black margins (`gap`) either side, small rounded corners and a
 *    subtle inner border. Sprocket holes are background tiles keyed to the strip coordinate, so
 *    they stay continuous across slices and frames.
 *  - Depth fog / light are one black overlay + one sheen per slice (opacity only, from smooth
 *    functions of depth, so neighbouring slices never show a seam). No filters.
 *  - The loop only writes `transform` (matrix3d) and a few opacity-driving custom properties
 *    through refs. React never re-renders per frame.
 *  - The path is pre-sampled once into an arc-length table. The bend per slice is limited
 *    (the wave is flattened / stretched until no slice turns more than ~5deg), so turns read as
 *    fluid curves instead of folds.
 *  - Variable aspect ratios: every item may carry `width`/`height` (or `aspect`). Frame pitch =
 *    photo width (at the fixed film height) + `gap`; slices are aligned to frame boundaries.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import styles from './FilmStrip3D.module.css';
import { cssUrl, DEFAULT_GRAIN_SRC } from './grain';

export { DEFAULT_GRAIN_SRC };

export type FilmStripItem = {
  src: string;
  /** Sharper file for 2× screens. Skipped on slow / save-data connections. */
  src2x?: string;
  /** Tiny data-uri so the frame isn't blank while `src` loads. */
  placeholder?: string;
  alt: string;
  label?: string;
  href?: string;
  /** Natural pixel size of the photo. Together they define its aspect ratio. */
  width?: number;
  height?: number;
  /** width / height. Alternative to width + height (e.g. Sanity `metadata.dimensions.aspectRatio`). */
  aspect?: number;
};

export type FilmStrip3DProps = {
  items: FilmStripItem[];
  /** Called when a frame is activated (click / tap / Enter / Space). */
  onSelect?: (item: FilmStripItem, index: number) => void;
  /** Autoplay speed multiplier. 1 = ~0.4 frames/s. Negative reverses. 0 = no autoplay. */
  speed?: number;
  /**
   * 'loop' (default) = dramatic switchback: the strip arches towards the viewer, makes a hairpin U-turn, recedes,
   * and turns again. 'ribbon' = gentle S-curve wave with twist, 'helix' = spiral staircase.
   */
  variant?: 'loop' | 'ribbon' | 'helix';
  /** ribbon / helix only: curve amplitude multiplier (0.4 – 1.6 sensible). Default 1. */
  amplitude?: number;
  /** loop only: hairpin tightness (0.5 wide – 1.8 tight; the radius is floored so no slice bends > ~9°). Default 1. */
  turnSharpness?: number;
  /** loop only: depth of the arch / how far the legs climb (0.5 – 1.6). Default 1. */
  depth?: number;
  /** loop only: camera distance in world px (smaller = stronger perspective, bigger foreground frames). Default 750. */
  perspective?: number;
  /** Container height (number = px, or any CSS length). Default: the `--fs3d-height` CSS variable. */
  height?: number | string;
  /**
   * Black film margin between two photos, in strip px (the strip is ~184px tall). Default 18.
   * Clamped to 10 – 90. Larger = more black film between the pictures.
   */
  gap?: number;
  /** Yellow edge-print text on every frame. */
  stockLabel?: string;
  /** Accessible name of the whole strip. */
  ariaLabel?: string;
  /** Force low-power mode (~24fps, wider slices, no gloss/fog). Default: auto-detect. */
  lowPower?: boolean;
  className?: string;
  /** Fires once the first posed frame (or the flat fallback) is in the DOM. */
  onReady?: () => void;
  /**
   * 'auto' (default): 3D when preserve-3d and perspective are supported, otherwise
   * the flat strip. '3d' and 'flat' force that renderer.
   * Reduced motion and the compact / low-power tier do not switch renderers.
   */
  mode?: FilmStripMode;
  /**
   * Scratch-plate URL. Default `/film-scratches-grain.webp` (copy the file in
   * this folder to the host `public/` directory, or pass any other URL).
   */
  grainSrc?: string;
  /** Canvas font for the yellow edge print. Load the face yourself. */
  printFont?: string;
  /**
   * When false, the rAF loop is not scheduled and does no per-frame work.
   * Off-screen, hidden-tab, and reduced-motion pauses still apply when this is true.
   * Default true so a standalone strip keeps running.
   */
  active?: boolean;
  /** Photo index to bring to the front. Snaps when it changes. */
  selectedIndex?: number;
};

export type FilmStripMode = 'auto' | '3d' | 'flat';

/* ------------------------------------------------------------------ */
/* constants                                                           */
/* ------------------------------------------------------------------ */

const W = 200; // strip pitch (world px) of a frame without a known ratio
const STRIP_H = 184; // film height (world px); keep in sync with the CSS `.slice { height }`
const HALF_H = STRIP_H / 2;
const PHOTO_H = 112; // photo window height; keep in sync with the CSS `.ph { height }`
const PHOTO_TOP = 36; // keep in sync with CSS `.ph { top }` — leaves a top edge-print band
const DEFAULT_GAP = 18;
const STOCK_EVERY = 4; // show stock label on every Nth frame only
const MIN_GAP = 10;
const MAX_GAP = 90;
const MIN_ASPECT = 0.55; // wider/narrower photos are cropped (cover) beyond these
const MAX_ASPECT = 2.3;
const SPROCKET = 25; // perforation pitch (px) = background tile width in the CSS
const SLICE_HI = 26; // nominal slice width (world px)
const SLICE_LOW = 40; // low-power: wider slices -> ~35% fewer nodes
const MAX_EDGE = 0.6; // world px: max misalignment of the outer corners of two neighbouring slices
const SLICE_LOOP = 20; // loop variant: narrower slices so the hairpins stay smooth (≤ ~8° per slice)
const SLICE_LOOP_LOW = 56; // phones: fewer DOM layers > razor hairpins
const LOOP_TILT = 15; // camera pitch (deg) of the loop variant
const MAX_SLICE_BEND = 0.15; // rad (≈ 8.6°): floor of the loop's hairpin radius = slice width / this
const MIN_BEND_R = 200; // tightest allowed bend radius (world px) — lower = sharper S folds
const END_FADE = 320; // the path ends fade to black film (not alpha: overlapping slices would double-blend) over this length
const BASE_FPS = 0.4; // average frames per second at speed = 1
const TABLE_STEP = 5.8; // arc-length table spacing (world px)
const DRAG_THRESHOLD = 6; // px before a press becomes a drag (so taps still click)
const MAX_FLICK = 4; // frames/s cap for inertia

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const mod = (n: number, m: number) => ((n % m) + m) % m;
const smooth = (t: number) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};

/* ------------------------------------------------------------------ */
/* path (arc-length table of positions + "down" reference vectors)     */
/* ------------------------------------------------------------------ */

type PathTable = {
  pos: Float64Array; // (T+1) * 3
  dn: Float64Array; // (T+1) * 3  unit vector along the strip's height ("down" edge)
  length: number;
  /** number of table intervals */
  T: number;
  /** rough half-extent of the shape in depth, used for fog */
  zScale: number;
  /** vertical scale reference for fitting the shape into the container height */
  fitH: number;
  /** loop only: length of the visible path (the table is longer by the padding on both ends) */
  Lp?: number;
  /** loop only: path coordinate where a keyboard-focused frame is brought to (big, in front) */
  heroS?: number;
  /** loop only: visible-path range between the two hairpins (used to fit the camera) */
  core?: [number, number];
};

type PathParams = { Az: number; Ay: number; lambda: number; R: number; roll: number };

function generatePath(variant: 'ribbon' | 'helix', pr: PathParams, length: number): PathTable {
  const TABLE = Math.max(64, Math.ceil(length / TABLE_STEP));
  const pos = new Float64Array((TABLE + 1) * 3);
  const dn = new Float64Array((TABLE + 1) * 3);
  const ds = length / TABLE;

  if (variant === 'helix') {
    // Helix around a vertical axis; the strip's face looks outward (carousel / spiral staircase).
    const R = pr.R;
    const rise = -236; // vertical travel per turn (negative = ascends to the right)
    const b = rise / TAU;
    const arcPerRad = Math.hypot(R, b);
    for (let i = 0; i <= TABLE; i++) {
      const t = (i * ds - length / 2) / arcPerRad;
      const sx = Math.sin(t);
      const cz = Math.cos(t);
      pos[i * 3] = R * sx;
      pos[i * 3 + 1] = b * t;
      pos[i * 3 + 2] = R * cz;
      // T = (R cos t, b, -R sin t); r = (sin t, 0, cos t); down = r x T
      const Tx = R * cz,
        Ty = b,
        Tz = -R * sx;
      const rx = sx,
        rz = cz;
      const dx = 0 * Tz - rz * Ty; // r x T
      const dy = rz * Tx - rx * Tz;
      const dz = rx * Ty - 0 * Tx;
      const l = Math.hypot(dx, dy, dz);
      dn[i * 3] = dx / l;
      dn[i * 3 + 1] = dy / l;
      dn[i * 3 + 2] = dz / l;
    }
    return { pos, dn, length, T: TABLE, zScale: R, fitH: 620 };
  }

  // ribbon: x = u, z = Az sin, y = Ay sin (phase-shifted), plus a gentle roll twist.
  const { Az, Ay, lambda } = pr;
  const curve = (u: number, out: number[]) => {
    const p = (TAU * u) / lambda;
    out[0] = u;
    out[1] = Ay * Math.sin(p + 1.4);
    out[2] = Az * Math.sin(p);
  };
  const roll = (u: number) => pr.roll * Math.sin((TAU * u) / (lambda * 1.7) + 0.6);

  // dense sampling over [-length, length]
  const STEP = 5;
  const count = Math.ceil((2 * length) / STEP) + 1;
  const U = new Float64Array(count);
  const A = new Float64Array(count); // cumulative arc length
  const tmp = [0, 0, 0];
  let px = 0,
    py = 0,
    pz = 0;
  for (let j = 0; j < count; j++) {
    const u = -length + j * STEP;
    curve(u, tmp);
    U[j] = u;
    A[j] = j === 0 ? 0 : A[j - 1] + Math.hypot(tmp[0] - px, tmp[1] - py, tmp[2] - pz);
    px = tmp[0];
    py = tmp[1];
    pz = tmp[2];
  }
  const a0 = A[Math.round(length / STEP)]; // arc at u = 0
  const us = new Float64Array(TABLE + 1);
  let j = 0;
  for (let i = 0; i <= TABLE; i++) {
    const a = a0 + (i * ds - length / 2);
    while (j < count - 2 && A[j + 1] < a) j++;
    const f = clamp((a - A[j]) / Math.max(1e-6, A[j + 1] - A[j]), 0, 1);
    const u = U[j] + (U[j + 1] - U[j]) * f;
    us[i] = u;
    curve(u, tmp);
    pos[i * 3] = tmp[0];
    pos[i * 3 + 1] = tmp[1];
    pos[i * 3 + 2] = tmp[2];
  }
  for (let i = 0; i <= TABLE; i++) {
    // smooth tangent: finite difference over +-2 neighbouring samples
    const i0 = Math.max(0, i - 2),
      i1 = Math.min(TABLE, i + 2);
    let Tx = pos[i1 * 3] - pos[i0 * 3];
    let Ty = pos[i1 * 3 + 1] - pos[i0 * 3 + 1];
    let Tz = pos[i1 * 3 + 2] - pos[i0 * 3 + 2];
    const tl = Math.hypot(Tx, Ty, Tz);
    Tx /= tl;
    Ty /= tl;
    Tz /= tl;
    // D0 = world-down projected perpendicular to T
    let dx = -Ty * Tx;
    let dy = 1 - Ty * Ty;
    let dz = -Ty * Tz;
    const dl = Math.hypot(dx, dy, dz);
    dx /= dl;
    dy /= dl;
    dz /= dl;
    // rotate D0 about T by roll (Rodrigues; D0 ⟂ T)
    const r = roll(us[i]);
    const c = Math.cos(r),
      s = Math.sin(r);
    const cx = Ty * dz - Tz * dy; // T x D0
    const cy = Tz * dx - Tx * dz;
    const cz = Tx * dy - Ty * dx;
    dn[i * 3] = dx * c + cx * s;
    dn[i * 3 + 1] = dy * c + cy * s;
    dn[i * 3 + 2] = dz * c + cz * s;
  }
  // Fit box must cover vertical bob + foreshortened depth swing + strip height,
  // or mobile containers clip most of the wave (old hardcoded 410 was too tight).
  const fitH = Math.max(480, Ay * 2.2 + Az * 0.55 + STRIP_H + 100);
  return { pos, dn, length, T: TABLE, zScale: Az + 110, fitH };
}

/* ------------------------------------------------------------------ */
/* loop path: a switchback ribbon with two hairpin U-turns             */
/* ------------------------------------------------------------------ */

type LoopCfg = { sharp: number; depth: number; compact: number; minR: number; viewW: number };

const RAMP = 0.3; // curvature ramps in/out over this fraction of a hairpin (no kinks)
const bumpW = (u: number) => 1 - Math.cos(TAU * clamp(u, 0, 1)); // ∫ over [0,1] = 1
const platW = (u: number, r: number) => {
  u = clamp(u, 0, 1);
  const e = Math.min(u, 1 - u) / r;
  return (e >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * clamp(e, 0, 1))) / (1 - r);
}; // ∫ over [0,1] = 1

type LoopSeg = { len: number; d: number; kind: 'bump' | 'turn' };

/**
 * The centreline is defined by its HEADING (top-down angle, 0 = +x, positive = towards the camera) along arc length:
 * arch towards the viewer -> hairpin #1 -> back leg -> hairpin #2 -> exit leg that recedes to the right.
 * The approach stays near +x so the hairpin and the receding leg land on the right of the hero instead of
 * stalling mid-page; phones (compact = 1) shorten the straight legs. Straight bleed past both ends is NOT
 * part of the fitted core: the hairpin stays the same size, and the extra approach / exit run off the viewport.
 * Curvature is a smooth function of arc length, so there are no kinks; the hairpin radius is floored so that
 * no slice turns by more than MAX_SLICE_BEND.
 */
function loopSegs(c: LoopCfg) {
  const sharp = clamp(c.sharp, 0.5, 1.8);
  const dk = clamp(c.depth, 0.5, 1.6);
  const k = clamp(c.compact, 0, 1);
  const R1 = Math.max(c.minR, (150 * (1 - 0.15 * k)) / sharp);
  const R2 = Math.max(c.minR, (135 * (1 - 0.15 * k)) / sharp);
  const th0 = 0.04;
  const thA = clamp(0.18 * dk, 0.1, 0.55); // end of the approach: still mostly +x, opened toward the camera by depth
  const thB = -Math.PI + 0.12 * dk; // after hairpin 1: back along -x, only slightly away
  const thB2 = thB + 0.05;
  const thC = -0.1 * dk; // after hairpin 2: to the right, gently receding
  const thEnd = 0;
  // Straight bleed past the fitted body so the strip runs off both page edges.
  // Phones cut hard: every world-px of bleed is more CSS-3D slices, and that is
  // what stalls iPhone Safari. Portrait phones already clear both edges.
  // Wider compact windows (just under 768px, landscape, short laptop windows)
  // are height-limited, so that short tail stops on screen. Grow the right
  // run with the extra width; the fitted hairpin does not include this bleed.
  const bleedL = 1100 - 750 * k;
  const extraW = k > 0 ? Math.max(0, c.viewW - 420) : 0;
  const bleedR = 2400 - 1950 * k + extraW * 3.4;
  const segs: LoopSeg[] = [
    { len: 80 - 40 * k + bleedL, d: 0, kind: 'bump' }, // run-in, continues off the left edge
    { len: 720 - 500 * k, d: thA - th0, kind: 'bump' }, // arch towards the hairpin
    { len: (Math.abs(thB - thA) * R1) / (1 - RAMP), d: thB - thA, kind: 'turn' },
    { len: 260 - 160 * k, d: thB2 - thB, kind: 'bump' },
    { len: (Math.abs(thC - thB2) * R2) / (1 - RAMP), d: thC - thB2, kind: 'turn' },
    { len: 820 - 600 * k, d: thEnd - thC, kind: 'bump' }, // receding leg
    { len: 160 - 100 * k + bleedR, d: 0, kind: 'bump' }, // tail, continues off the right edge
  ];
  return { segs, th0, dk, Lp: segs.reduce((a, s) => a + s.len, 0), bleedL, bleedR };
}

function generateLoop(c: LoopCfg, pad: number, bank = 0.05): PathTable {
  const { segs, th0, dk, Lp, bleedL, bleedR } = loopSegs(c);
  const length = Lp + 2 * pad;
  const TABLE = Math.max(64, Math.ceil(length / TABLE_STEP));
  const ds = length / TABLE;
  const SUB = 4;
  const sub = ds / SUB;
  const segStart: number[] = [];
  {
    let a = pad;
    for (const s of segs) {
      segStart.push(a);
      a += s.len;
    }
  }
  const kappaAt = (s: number) => {
    for (let i = 0; i < segs.length; i++) {
      const a = segStart[i];
      if (s >= a && s < a + segs[i].len) {
        const u = (s - a) / segs[i].len;
        return (segs[i].d / segs[i].len) * (segs[i].kind === 'turn' ? platW(u, RAMP) : bumpW(u));
      }
    }
    return 0; // straight before / after the visible path
  };
  // the legs climb through the hairpins, so the zig-zag stacks into tiers on screen
  const LIFT = 70 * dk;
  const t1a = segStart[2] - 120;
  const t1b = segStart[2] + segs[2].len + 420;
  const t2a = segStart[4] - 120;
  const t2b = segStart[4] + segs[4].len + 420;
  const yAt = (s: number) => -LIFT * smooth((s - t1a) / (t1b - t1a)) - LIFT * smooth((s - t2a) / (t2b - t2a));

  const pos = new Float64Array((TABLE + 1) * 3);
  const dn = new Float64Array((TABLE + 1) * 3);
  const th = new Float64Array(TABLE + 1);
  let x = 0,
    z = 0,
    a = th0;
  for (let i = 0; i <= TABLE; i++) {
    pos[i * 3] = x;
    pos[i * 3 + 1] = yAt(i * ds);
    pos[i * 3 + 2] = z;
    th[i] = a;
    for (let k = 0; k < SUB; k++) {
      const s0 = i * ds + k * sub;
      const k0 = kappaAt(s0);
      const k1 = kappaAt(s0 + sub);
      const am = a + 0.25 * sub * (k0 + k1);
      x += Math.cos(am) * sub;
      z += Math.sin(am) * sub;
      a += 0.5 * (k0 + k1) * sub;
    }
  }
  // Centre on the fitted body only. The straight bleed past either end must not shift the hairpin.
  const body0 = pad + bleedL;
  const body1 = pad + Lp - bleedR;
  let mny = 1e9,
    mxy = -1e9,
    mnz = 1e9,
    mxz = -1e9,
    cmx = 1e9,
    cMx = -1e9;
  for (let i = clamp(Math.round(body0 / ds), 0, TABLE); i <= clamp(Math.round(body1 / ds), 0, TABLE); i++) {
    mny = Math.min(mny, pos[i * 3 + 1]);
    mxy = Math.max(mxy, pos[i * 3 + 1]);
    mnz = Math.min(mnz, pos[i * 3 + 2]);
    mxz = Math.max(mxz, pos[i * 3 + 2]);
    cmx = Math.min(cmx, pos[i * 3]);
    cMx = Math.max(cMx, pos[i * 3]);
  }
  const ox = (cmx + cMx) / 2,
    oy = (mny + mxy) / 2,
    oz = (mnz + mxz) / 2;
  for (let i = 0; i <= TABLE; i++) {
    pos[i * 3] -= ox;
    pos[i * 3 + 1] -= oy;
    pos[i * 3 + 2] -= oz;
  }
  // "down" vectors: world-down made perpendicular to the tangent, banked a little into the turns
  const BANK = bank;
  const KREF = 1 / 110;
  for (let i = 0; i <= TABLE; i++) {
    const iA = Math.max(0, i - 2),
      iB = Math.min(TABLE, i + 2);
    let Tx = pos[iB * 3] - pos[iA * 3],
      Ty = pos[iB * 3 + 1] - pos[iA * 3 + 1],
      Tz = pos[iB * 3 + 2] - pos[iA * 3 + 2];
    const tl = Math.hypot(Tx, Ty, Tz);
    Tx /= tl;
    Ty /= tl;
    Tz /= tl;
    let dx = -Ty * Tx,
      dy = 1 - Ty * Ty,
      dz = -Ty * Tz;
    const dl = Math.hypot(dx, dy, dz);
    dx /= dl;
    dy /= dl;
    dz /= dl;
    const kk = (th[iB] - th[iA]) / ((iB - iA) * ds);
    const r = -clamp(BANK * (kk / KREF), -0.16, 0.16);
    const cr = Math.cos(r),
      sr = Math.sin(r);
    const cx = Ty * dz - Tz * dy,
      cy = Tz * dx - Tx * dz,
      cz = Tx * dy - Ty * dx;
    dn[i * 3] = dx * cr + cx * sr;
    dn[i * 3 + 1] = dy * cr + cy * sr;
    dn[i * 3 + 2] = dz * cr + cz * sr;
  }
  return {
    pos,
    dn,
    length,
    T: TABLE,
    zScale: Math.max(200, (mxz - mnz) / 2),
    fitH: 0,
    Lp,
    heroS: segs[0].len + segs[1].len * 0.78,
    // Fitted span is the hairpin body. bleedL / bleedR run outside it and off the viewport.
    core: [bleedL + END_FADE * 0.16, Lp - bleedR - END_FADE * 0.35],
  };
}

/** Largest turn (radians) between two consecutive chords of length `w` along the table. */
function maxBend(t: PathTable, w: number): number {
  const step = Math.max(1, Math.round(w / (t.length / t.T)));
  const p = t.pos;
  let m = 0;
  for (let i = step; i + step <= t.T; i++) {
    const a0 = (i - step) * 3,
      b0 = i * 3,
      c0 = (i + step) * 3;
    const ux = p[b0] - p[a0],
      uy = p[b0 + 1] - p[a0 + 1],
      uz = p[b0 + 2] - p[a0 + 2];
    const vx = p[c0] - p[b0],
      vy = p[c0 + 1] - p[b0 + 1],
      vz = p[c0 + 2] - p[b0 + 2];
    const d = (ux * vx + uy * vy + uz * vz) / (Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz));
    const a = Math.acos(clamp(d, -1, 1));
    if (a > m) m = a;
  }
  return m;
}

/**
 * Largest mismatch (world px) between the outer corners of two neighbouring slices (width `w`).
 * Slices are rigid, so any rotation of the strip that is NOT a hinge about its own height axis
 * (in-plane bend from the vertical bob, twist from the roll) leaves the two edges of a joint
 * misaligned by half-height x angle. Hinge bends (the depth wave) do not contribute.
 */
function maxEdgeMismatch(t: PathTable, w: number): number {
  const step = Math.max(1, Math.round(w / (t.length / t.T)));
  const d = t.dn;
  let m = 0;
  for (let i = 4; i + step < t.T - 4; i++) {
    const a = i * 3,
      b = (i + step) * 3;
    const v = Math.hypot(d[a] - d[b], d[a + 1] - d[b + 1], d[a + 2] - d[b + 2]);
    if (v > m) m = v;
  }
  return m * HALF_H;
}

/**
 * Builds the path and softens it until (a) no slice turns by more than w / MIN_BEND_R and
 * (b) neighbouring slices' outer corners stay within MAX_EDGE world px of each other.
 * Ribbon: depth swing is reduced and the wavelength stretched (curvature ~ Az / lambda^2); vertical
 * bob and roll are scaled down for (b). Helix: the radius grows. `bend` (radians) and `edge`
 * (world px) report what was achieved.
 */
function buildPath(
  variant: 'ribbon' | 'helix',
  amp: number,
  length: number,
  w: number,
): PathTable & { bend: number; edge: number } {
  const limit = w / MIN_BEND_R;
  const pr: PathParams = {
    // Deeper Z swing + shorter wavelength = sharper S / near double-back
    Az: 340 * amp,
    Ay: 70 * amp,
    lambda: 1050,
    R: 360 * amp,
    roll: 0.28 * Math.min(amp, 1.4),
  };
  let t = generatePath(variant, pr, length);
  let bend = maxBend(t, w);
  let edge = maxEdgeMismatch(t, w);
  for (let n = 0; n < 10 && (bend > limit * 1.01 || edge > MAX_EDGE * 1.01); n++) {
    if (bend > limit * 1.01) {
      const f = limit / bend; // < 1
      if (variant === 'helix') {
        pr.R /= f ** 0.9;
      } else {
        const fa = f ** (1 / 3);
        pr.Az *= fa;
        pr.Ay *= fa;
        pr.lambda /= fa; // curvature ~ Az / lambda^2  =>  f^(1/3) * f^(2/3) = f
      }
    }
    if (edge > MAX_EDGE * 1.01 && variant === 'ribbon') {
      const f = MAX_EDGE / edge;
      pr.Ay *= f;
      pr.roll *= f;
    }
    t = generatePath(variant, pr, length);
    bend = maxBend(t, w);
    edge = maxEdgeMismatch(t, w);
  }
  return Object.assign(t, { bend, edge });
}

/* ------------------------------------------------------------------ */
/* layout: variable frame widths -> frame + slice tables                */
/* ------------------------------------------------------------------ */

/** width / height of an item if it declares one (aspect, or width + height). */
export function aspectOf(it: Pick<FilmStripItem, 'width' | 'height' | 'aspect'>): number | undefined {
  const a = it.aspect ?? (it.width && it.height ? it.width / it.height : undefined);
  return a && isFinite(a) && a > 0 ? a : undefined;
}

/** Strip pitch (photo + black margin) in world px for an aspect ratio (undefined = classic 200). */
const pitchFor = (aspect: number | undefined, gap: number) =>
  aspect === undefined ? Math.round(PHOTO_H * 1.5) + gap : Math.round(PHOTO_H * clamp(aspect, MIN_ASPECT, MAX_ASPECT)) + gap;

type Layout = {
  L: number; // number of items
  gap: number;
  pitch: Float64Array; // per item
  cum: Float64Array; // L + 1 prefix sums
  total: number;
  mean: number;
  min: number;
  max: number;
  /** slice table for ONE period (all L frames): slices never straddle two frames */
  J: number;
  sStart: Float64Array; // J, strip coordinate of the slice's left edge
  sW: Float64Array; // J, slice width
  sFrame: Int32Array; // J, frame (item) index
};

function buildLayout(pitches: ArrayLike<number>, gap: number, target: number): Layout {
  const L = Math.max(1, pitches.length);
  const pitch = new Float64Array(L);
  const cum = new Float64Array(L + 1);
  let min = Infinity;
  let max = 0;
  let J = 0;
  const counts = new Int32Array(L);
  for (let i = 0; i < L; i++) {
    const p = i < pitches.length ? pitches[i] : W;
    pitch[i] = p;
    cum[i + 1] = cum[i] + p;
    if (p < min) min = p;
    if (p > max) max = p;
    counts[i] = Math.max(1, Math.round(p / target));
    J += counts[i];
  }
  const sStart = new Float64Array(J);
  const sW = new Float64Array(J);
  const sFrame = new Int32Array(J);
  let j = 0;
  for (let i = 0; i < L; i++) {
    // integer widths (the pitch is an integer): every slice edge then lands on a whole pixel inside
    // its own layer, so the photo / print / sprocket sampling is identical on both sides of a joint
    const base = Math.floor(pitch[i] / counts[i]);
    const extra = pitch[i] - base * counts[i]; // the first `extra` slices are 1px wider
    let acc = 0;
    for (let s = 0; s < counts[i]; s++, j++) {
      const w = base + (s < extra ? 1 : 0);
      sStart[j] = cum[i] + acc;
      sW[j] = w;
      sFrame[j] = i;
      acc += w;
    }
  }
  return { L, gap, pitch, cum, total: cum[L], mean: cum[L] / L, min, max, J, sStart, sW, sFrame };
}

/** Start of virtual (infinitely repeated) frame k along the strip. */
function cumAt(lay: Layout, k: number): number {
  const q = Math.floor(k / lay.L);
  return q * lay.total + lay.cum[k - q * lay.L];
}
function pitchAt(lay: Layout, k: number): number {
  return lay.pitch[mod(k, lay.L)];
}
/** Start of virtual slice j. */
function sliceStartAt(lay: Layout, j: number): number {
  const q = Math.floor(j / lay.J);
  return q * lay.total + lay.sStart[j - q * lay.J];
}

type Plan = { N: number; NS: number; Lp: number; pad: number };

/**
 * How many DOM hit-frames (N) and base slices (NS) are needed to cover a visible path of length Lp
 * at ANY scroll offset, and how long that path is. Elements are recycled from the left end to the
 * right end while hidden beyond the path ends (which are faded to black).
 */
function planLayout(lay: Layout, Lp: number, target: number): Plan {
  let N = 0;
  for (let r = 0; r < lay.L; r++) {
    let c = 0;
    while (cumAt(lay, r + c) - lay.cum[r] < Lp) c++;
    if (c > N) N = c;
  }
  let NS = 0;
  for (let r = 0; r < lay.J; r++) {
    let c = 0;
    while (sliceStartAt(lay, r + c) - lay.sStart[r] < Lp) c++;
    if (c > NS) NS = c;
  }
  N += 2;
  NS += 3;
  void target;
  return { N, NS, Lp, pad: Math.max(420, lay.max + 40) };
}

/* ------------------------------------------------------------------ */
/* edge print (frame number + stock label) as a tiny SVG background     */
/* ------------------------------------------------------------------ */

const NARROW_PHOTO = 120; // skip stock on very narrow frames (4:3 @ PHOTO_H is ~149)
const PRINT_SCALE = 3; // bitmap resolution multiplier (the strip is drawn up to ~2.2x, plus perspective)
/** Must match next/font IBM_Plex_Mono in layout.tsx — canvas can't use CSS vars. */
const PRINT_FONT = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const PRINT_WEIGHT = 700;
const PRINT_SIZE = 13; // stock + frame numbers share this

function printFontCss(font: string = PRINT_FONT, size = PRINT_SIZE) {
  return `${PRINT_WEIGHT} ${size}px ${font}`;
}

async function ensurePrintFont(font: string = PRINT_FONT) {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  try {
    await document.fonts.load(printFontCss(font));
    await document.fonts.ready;
  } catch {
    /* fall through — canvas will use the stack fallback */
  }
}

/**
 * Yellow edge print baked once per (frame number, pitch, stock?) into a full-strip-height bitmap.
 * Like 35mm stock: perforations sit against the photo, and the type sits outside them —
 * stock label in the outer TOP band, frame number in the outer BOTTOM band.
 * Used as a slice background so the type bends with the film (no extra DOM).
 * Hole tiles are 18px (see CSS); they occupy PHOTO_TOP-18..PHOTO_TOP and
 * PHOTO_TOP+PHOTO_H..PHOTO_TOP+PHOTO_H+18.
 */
function printUrl(
  num: string,
  pitch: number,
  gap: number,
  ink: string,
  stock: string,
  font: string = PRINT_FONT,
): string {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(pitch * PRINT_SCALE);
  cv.height = STRIP_H * PRINT_SCALE;
  const g = cv.getContext('2d');
  if (!g) return 'none';
  g.scale(PRINT_SCALE, PRINT_SCALE);
  g.fillStyle = ink;
  g.textBaseline = 'alphabetic';
  g.font = printFontCss(font);
  const x0 = gap / 2 + 1;
  const mid = pitch / 2; // centre of the photo window
  const HOLE_TILE = 18;

  // Outer top band, above the upper perforations: stock label, sparse
  if (stock && pitch - gap >= NARROW_PHOTO) {
    g.textAlign = 'left';
    g.fillText(stock, x0, 13);
  }

  // Outer bottom band, below the lower perforations: frame marker + number
  g.textAlign = 'left';
  const triW = 9;
  const triPad = 6;
  const numW = g.measureText(num).width;
  const groupW = triW + triPad + numW;
  const left = mid - groupW / 2;
  const bandTop = PHOTO_TOP + PHOTO_H + HOLE_TILE;
  const triH = 10;
  const triMid = bandTop + (STRIP_H - bandTop) / 2;
  g.beginPath();
  g.moveTo(left, triMid - triH / 2);
  g.lineTo(left + triW, triMid);
  g.lineTo(left, triMid + triH / 2);
  g.closePath();
  g.fill();
  g.fillText(num, left + triW + triPad, triMid + triH / 2 + 0.5);

  const bin = atob(cv.toDataURL('image/png').split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return `url("${URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))}")`;
}

// Sprocket hole tile (25 x 18, drawn at the top and bottom edge) and the base's vertical shading (stretched to the
// film height). Plain images on purpose, see the note in the CSS.
const HOLE_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='25' height='18'%3E%3Crect x='5.5' y='4' width='14' height='10' rx='2.6' fill='%23f3f0e6' stroke='%23b4afa2' stroke-width='.6'/%3E%3C/svg%3E";
const BASE_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='184' viewBox='0 0 4 184' preserveAspectRatio='none'%3E%3ClinearGradient id='g' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23232327'/%3E%3Cstop offset='.14' stop-color='%231b1b1e'/%3E%3Cstop offset='.45' stop-color='%230d0d0f'/%3E%3Cstop offset='1' stop-color='%23070708'/%3E%3C/linearGradient%3E%3Crect width='4' height='184' fill='url(%23g)'/%3E%3C/svg%3E";
const HOLE = `url("${HOLE_SVG}")`;
const BASE_SHADE = `url("${BASE_SVG}")`;
/* Old flat-strip scratch plate, black floor lifted to alpha. 720px tile width
   must match the slice / .ph background-size in FilmStrip3D.module.css. */
const GRAIN_TILE = 720;
/** Public-path default. Override with the `grainSrc` prop. Tile width must match the CSS. */
const GRAIN = cssUrl(DEFAULT_GRAIN_SRC);

type NetInfo = { saveData?: boolean; effectiveType?: string };

/** Save-Data, 2g, or prefers-reduced-data: one modest file, no 2× candidate. */
export function prefersSmallImages() {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as Navigator & { connection?: NetInfo }).connection;
  const reducedData =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-data: reduce)').matches;
  return (
    reducedData ||
    !!conn?.saveData ||
    conn?.effectiveType === 'slow-2g' ||
    conn?.effectiveType === '2g'
  );
}

function supportsFilm3D() {
  return (
    typeof CSS !== 'undefined' &&
    CSS.supports('transform-style', 'preserve-3d') &&
    CSS.supports('perspective', '1px')
  );
}

let imageSetFn: 'image-set' | '-webkit-image-set' | 'none' | null = null;
function imageSetFunction() {
  if (imageSetFn) return imageSetFn;
  const probe = 'url("data:image/gif;base64,R0lGODlhAQABAAAAACw=") 1x';
  if (typeof CSS !== 'undefined' && CSS.supports?.('background-image', `image-set(${probe})`)) imageSetFn = 'image-set';
  else if (typeof CSS !== 'undefined' && CSS.supports?.('background-image', `-webkit-image-set(${probe})`))
    imageSetFn = '-webkit-image-set';
  else imageSetFn = 'none';
  return imageSetFn;
}

/** Sharp photo under the scratch plate. One declaration so the browser fetches a single photo candidate.
 *  Grain is a separate layer (not inside image-set) and is positioned with --grain-x, which
 *  changes only when a slice is recycled or flipped — not every animation frame. */
function paintPhoto(el: HTMLElement, it: FilmStripItem, dense: boolean, grain: string = GRAIN) {
  const placeholder = it.placeholder ? cssUrl(it.placeholder) : '';
  const src2x = it.src2x;
  const fn = dense && src2x ? imageSetFunction() : 'none';
  const photo =
    fn === 'none' || !src2x ? cssUrl(it.src) : `${fn}(${cssUrl(it.src)} 1x, ${cssUrl(src2x)} 2x)`;
  // Concrete url(), not a CSS variable: a var() inside background-image makes
  // Chrome re-raster every transformed slice on every frame.
  const layers = [grain, photo];
  if (placeholder) layers.push(placeholder);
  const rest = layers.length - 1;
  el.style.backgroundImage = layers.join(', ');
  el.style.backgroundSize = [`${GRAIN_TILE}px 184px`, ...Array(rest).fill('cover')].join(', ');
  el.style.backgroundRepeat = ['repeat-x', ...Array(rest).fill('no-repeat')].join(', ');
  el.style.backgroundPosition = ['var(--grain-x) -36px', ...Array(rest).fill('50% 50%')].join(', ');
}

/* ------------------------------------------------------------------ */
/* component                                                           */
/* ------------------------------------------------------------------ */

/** Phones, and wide-but-short viewports (landscape handsets). */
const COMPACT_MQ = '(max-width: 767px), (max-height: 560px)';
/**
 * Hairpin radius for every non-phone window. Tied to the fine desktop slice,
 * not to whatever slice width a viewport happens to use. A larger floor
 * (the old 768–1279px tier) widened the turn until the back leg sat edge-on
 * and the overhead view disappeared.
 */
const DESK_MIN_R = (SLICE_LOOP + 2) / MAX_SLICE_BEND;

type StripTier = 'ssr' | 'compact' | 'desk';

function detectWeakDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (
    (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) ||
    (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4)
  );
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function pad2(n: number) {
  return n < 10 ? '0' + n : String(n);
}

export default function FilmStrip3D({
  items,
  onSelect,
  speed = 1,
  variant = 'loop',
  amplitude = 1,
  turnSharpness = 1,
  depth: depthProp = 1,
  perspective = 750,
  height,
  gap = DEFAULT_GAP,
  stockLabel = 'KODAK EPP 5005',
  ariaLabel = 'Photo film strip',
  lowPower,
  className,
  onReady,
  mode = 'auto',
  grainSrc = DEFAULT_GRAIN_SRC,
  printFont = PRINT_FONT,
  active = true,
  selectedIndex,
}: FilmStrip3DProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  useIsoLayoutEffect(() => {
    onReadyRef.current = onReady;
  });
  // 'ssr' until the client knows the viewport, so we never paint the desktop
  // loop and then swap it for the phone one (that flash is a layout jump).
  const [tier, setTier] = useState<StripTier>('ssr');
  const [flat, setFlat] = useState(mode === 'flat');
  const [viewW, setViewW] = useState(0);
  useEffect(() => {
    const compactMq = window.matchMedia(COMPACT_MQ);
    const apply = () => {
      const unsupported = !supportsFilm3D();
      setFlat(mode === 'flat' ? true : mode === '3d' ? false : unsupported);
      setTier(compactMq.matches ? 'compact' : 'desk');
      // 40px buckets so a drag-resize doesn't rebuild the path every pixel.
      setViewW(Math.round(window.innerWidth / 40) * 40);
    };
    apply();
    compactMq.addEventListener?.('change', apply);
    window.addEventListener('resize', apply);
    return () => {
      compactMq.removeEventListener?.('change', apply);
      window.removeEventListener('resize', apply);
    };
  }, [mode]);
  // Phones use wider slices — iPhone Safari chokes on 200+ 3D layers.
  // That must not change the desktop hairpin. Weak machines only drop to 30fps.
  const low = lowPower || tier === 'compact';
  const baseCount = low ? 12 : 14;
  const isLoop = variant === 'loop';
  const gapC = 2 * Math.round(clamp(Number.isFinite(gap) ? gap : DEFAULT_GAP, MIN_GAP, MAX_GAP) / 2); // even => whole-pixel margins
  const target = isLoop
    ? tier === 'compact' || lowPower
      ? SLICE_LOOP_LOW
      : SLICE_LOOP
    : low
      ? SLICE_LOW
      : SLICE_HI;

  // Layout from the declared ratios: computed once per items change (no DOM reads).
  const layoutKey = useMemo(
    () => items.map((it) => pitchFor(aspectOf(it), gapC).toFixed(2)).join(','),
    [items, gapC],
  );
  const hasUnknown = useMemo(() => items.some((it) => aspectOf(it) === undefined), [items]);
  const loopCfg = useMemo<LoopCfg>(
    () => ({
      sharp: Number.isFinite(turnSharpness) ? turnSharpness : 1,
      depth: Number.isFinite(depthProp) ? depthProp : 1,
      compact: tier === 'compact' ? 1 : 0,
      // Phones: coarser bend so the path stays short. Every wider window uses
      // the desktop radius, so a half-width laptop still shows the hairpin
      // from above. Do not derive this from `target` — wider slices would
      // inflate the radius and flatten the loop.
      minR: tier === 'compact' ? 110 : DESK_MIN_R,
      viewW: tier === 'compact' ? viewW : 0,
    }),
    [turnSharpness, depthProp, tier, viewW],
  );
  const pathLp = isLoop ? loopSegs(loopCfg).Lp : baseCount * W;
  const plan = useMemo(() => {
    const lay = buildLayout(layoutKey ? layoutKey.split(',').map(Number) : [], gapC, target);
    const p = planLayout(lay, pathLp, target);
    if (hasUnknown) {
      // some pitches may still change once the photo is measured: size the rings for the narrowest case
      const worst = planLayout(
        buildLayout(new Array(lay.L).fill(PHOTO_H * MIN_ASPECT + gapC), gapC, target),
        pathLp,
        target,
      );
      p.N = Math.max(p.N, worst.N);
      p.NS = Math.max(p.NS, worst.NS);
    }
    return { lay, ...p, target };
  }, [layoutKey, hasUnknown, pathLp, gapC, target]);
  const sliceCount = plan.NS;
  const frameCount = plan.N;

  // latest props, readable from the rAF loop / handlers without re-subscribing
  const itemsRef = useRef(items);
  const onSelectRef = useRef(onSelect);
  const speedRef = useRef(speed);
  const stockRef = useRef(stockLabel);
  const activeRef = useRef(active);
  activeRef.current = active;
  useIsoLayoutEffect(() => {
    itemsRef.current = items;
    onSelectRef.current = onSelect;
    speedRef.current = speed;
    stockRef.current = stockLabel;
  });

  // engine <-> handler bridge (all mutable, no re-render)
  const api = useRef<{
    kick: () => void;
    pointerDown: (e: PointerEvent<HTMLDivElement>) => void;
    pointerMove: (e: PointerEvent<HTMLDivElement>) => void;
    pointerUp: (e: PointerEvent<HTMLDivElement>) => void;
    focusSlot: (slot: number, fromKeyboard: boolean) => void;
    blurAll: () => void;
    nudge: (frames: number) => void;
    slotIndex: (slot: number) => number;
    neighbor: (slot: number, dir: number) => number;
    wasDrag: () => boolean;
    consumeSwallow: () => boolean;
    refresh: () => void;
    syncActive: () => void;
    showIndex: (index: number) => void;
  } | null>(null);

  const asLinks = useMemo(() => items.length > 0 && items.every((i) => !!i.href), [items]);

  /* ---------------- engine ---------------- */
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || flat || tier === 'ssr') return;
    const grainImage = cssUrl(grainSrc || DEFAULT_GRAIN_SRC);
    const fontStack = printFont || PRINT_FONT;
    const N = frameCount; // frame (button) ring
    const NS = sliceCount; // slice ring
    const Lp = plan.Lp;
    const pad = plan.pad;
    const gp = gapC;
    let lay = plan.lay; // may be refined in place by the measured ratio of photos without a declared one
    const meanPitch = () => lay.mean;
    const loop = variant === 'loop';
    const table: PathTable & { bend: number; edge: number } = loop
      ? (() => {
          let bank = 0.05;
          let t = generateLoop(loopCfg, pad, bank);
          let edge = maxEdgeMismatch(t, plan.target);
          for (let n = 0; n < 4 && edge > MAX_EDGE * 1.5; n++) {
            bank *= 0.5; // rigid slices can only hinge about their height axis: bank less until corners agree
            t = generateLoop(loopCfg, pad, bank);
            edge = maxEdgeMismatch(t, plan.target);
          }
          return Object.assign(t, { bend: maxBend(t, plan.target), edge });
        })()
      : buildPath(variant, clamp(amplitude, 0.3, 2), Lp + 2 * pad, plan.target * 1.15);
    const heroS = loop ? (table.heroS ?? Lp / 2) : Lp / 2; // where a focused frame is brought to
    const D = clamp(perspective, 350, 4000); // loop camera distance (world px)
    const slices = Array.from(root.querySelectorAll<HTMLElement>('[data-fs3d-slice]'));
    const hits = Array.from(root.querySelectorAll<HTMLElement>('[data-fs3d-hit]'));
    if (slices.length !== NS || hits.length !== N) return;
    root.setAttribute('data-bend', ((table.bend * 180) / Math.PI).toFixed(2)); // max degrees between neighbouring slices
    root.setAttribute('data-edge', table.edge.toFixed(2)); // max corner misalignment of neighbouring slices (world px)
    const ink = getComputedStyle(root).getPropertyValue('--ink').trim() || '#f6c915';

    // per-slice caches (everything written to the DOM is compared against these first)
    const slotJ = new Array<number>(NS).fill(NaN); // virtual slice index in each slot
    const sliceK = new Array<number>(NS).fill(NaN); // virtual frame of each slice
    const sliceW = new Float64Array(NS);
    const sliceA = new Float64Array(NS); // slice start inside its frame
    const sliceP = new Float64Array(NS); // pitch of its frame
    const sliceS0 = new Float64Array(NS); // strip coordinate of its left edge
    const lastFlip = new Int8Array(NS).fill(-1);
    const lastVis = new Int8Array(NS).fill(-1);
    const lastSh = new Float64Array(NS).fill(-1);
    const lastGl = new Float64Array(NS).fill(-1);
    const lastFocus = new Int8Array(NS).fill(0);
    // per-frame (hit button) caches
    const lastK = new Array<number>(N).fill(NaN);
    const lastFOp = new Array<boolean | null>(N).fill(null);
    const hitOn = new Int8Array(N).fill(1);
    const slotK = new Array<number>(N).fill(0);
    const printCache = new Map<string, string>();
    const sliceIdx = new Int32Array(NS);
    const printFor = (slot: number) => {
      const idx = sliceIdx[slot];
      // Every Nth tile along the strip (not unique photo index — short galleries
      // would otherwise only print stock once per loop).
      const showStock = mod(sliceK[slot], STOCK_EVERY) === 0;
      const stock = showStock ? stockRef.current : '';
      const pk = idx + '|' + sliceP[slot] + '|' + stock;
      let pu = printCache.get(pk);
      if (pu === undefined) {
        pu = printUrl(pad2(idx + 1), sliceP[slot], gp, ink, stock, fontStack);
        printCache.set(pk, pu);
      }
      return pu;
    };
    const revokePrints = () => printCache.forEach((u) => URL.revokeObjectURL(u.slice(5, -2)));
    const learned = new Map<number, number>(); // item index -> measured aspect (fallback)
    const probing = new Set<number>();

    const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = reduceMQ.matches;
    const weak = detectWeakDevice();
    const preferSmall = prefersSmallImages();
    // Phones / weak CPUs: fewer style writes, locked ~24fps, frozen micro-sway.
    // 24 is steadier on iPhone Safari than chasing 30 and dropping frames.
    const lite = low || weak;
    const minDelta = lite ? 1000 / 24 - 2 : 1000 / 60 - 3;

    // state
    // `off` = strip scroll offset in world px (frame k starts at cumAt(k) + off along the path)
    let off = heroS - pitchAt(lay, 0) / 2; // start with frame 0 at centre
    let kmin = 0; // first virtual frame that overlaps the path
    let jmin = 0; // first virtual slice that overlaps the path
    let focusK = NaN; // virtual frame that shows the keyboard focus ring
    let inertia = 0; // px/s
    let playF = 1; // 0..1 autoplay factor. Hover and keyboard focus do not change this.
    let clock = 0;
    let snapTo: number | null = null;
    let pressed = false;
    let visible = true;
    let docVisible = !document.hidden;
    let raf = 0;
    let lastT = 0;
    let rafRunning = false;
    let frontSlot = 0;
    // Skip style.transform when the rounded matrix did not change.
    const lastMx = new Array<string>(NS).fill('');
    const lastHitMx = new Array<string>(N).fill('');

    // geometry (updated on resize only)
    let S = 1;
    let shX = 0; // loop: camera-space shift (world px) that centres the projected shape
    let shY = 0;
    let rootW = 640;
    let rootH = 400;

    // drag
    let drag: {
      id: number;
      x0: number;
      lastX: number;
      lastT: number;
      moved: boolean;
      vel: number;
      threshold: number;
    } | null = null;
    let dragEndedAt = -1e9;
    let dragWasMove = false;
    let swallowClick = false;
    let ignoreClickUntil = 0;

    const camR = new Float64Array(9);
    const pA = new Float64Array(3),
      pB = new Float64Array(3),
      dA = new Float64Array(3),
      dB = new Float64Array(3);
    // joints of the current slice window, in camera space
    const jp = new Float64Array((NS + 1) * 3);
    const jd = new Float64Array((NS + 1) * 3);
    const bX = new Float64Array(NS * 3);
    const bY = new Float64Array(NS * 3);
    const bZ = new Float64Array(NS * 3);
    const bC = new Float64Array(NS); // chord length
    const jShade = new Float64Array(NS + 1);
    const jFade = new Float64Array(NS + 1);
    const jGloss = new Float64Array(NS + 1);

    const sample = (s: number, p: Float64Array, d: Float64Array) => {
      const f = clamp((s / table.length) * table.T, 0, table.T - 1e-6);
      const i = Math.floor(f);
      const t = f - i;
      const a = i * 3,
        b = a + 3;
      for (let c = 0; c < 3; c++) {
        p[c] = table.pos[a + c] + (table.pos[b + c] - table.pos[a + c]) * t;
        d[c] = table.dn[a + c] + (table.dn[b + c] - table.dn[a + c]) * t;
      }
    };

    /** Photo without a declared ratio: measure it once (off-DOM) and re-flow in place. */
    const learn = (idx: number, src: string) => {
      if (learned.has(idx) || probing.has(idx)) return;
      probing.add(idx);
      const im = new Image();
      im.onload = () => {
        probing.delete(idx);
        if (!im.naturalWidth || !im.naturalHeight) return;
        onRatio(idx, im.naturalWidth / im.naturalHeight);
      };
      im.onerror = () => probing.delete(idx);
      im.src = src;
    };

    const setFrame = (slot: number, k: number) => {
      const list = itemsRef.current;
      if (!list.length) return;
      const idx = mod(k, list.length);
      const it = list[idx];
      const hit = hits[slot];
      hit.style.setProperty('--pw', pitchAt(lay, k).toFixed(2));
      hit.setAttribute('aria-label', it.label ?? it.alt);
      if (hit.tagName === 'A' && it.href) hit.setAttribute('href', it.href);
      if (aspectOf(it) === undefined) learn(idx, it.src);
    };

    const orient = (slot: number, flip: number) => {
      lastFlip[slot] = flip;
      const w = sliceW[slot];
      // A back-facing slice is turned 180deg about its height axis so the picture reads un-mirrored from
      // behind (as in v2): its local x runs against the strip, so it samples the frame from the other end.
      const u0 = flip ? sliceP[slot] - sliceA[slot] - w : sliceA[slot];
      // (+2: the slice box reaches OVERLAP/2 = 2px past each joint, so box x = 2 sits on the joint)
      const ph = flip ? mod(sliceS0[slot] + w + 2, SPROCKET) : mod(2 - sliceS0[slot], SPROCKET);
      // Same phase rule as the sprockets, modulo the scratch tile, so the plate is continuous across slices.
      const gx = flip ? mod(sliceS0[slot] + w + 2, GRAIN_TILE) : mod(2 - sliceS0[slot], GRAIN_TILE);
      const el = slices[slot];
      el.style.setProperty('--u0', u0.toFixed(2));
      el.style.setProperty('--ph', ph.toFixed(2));
      el.style.setProperty('--gx', gx.toFixed(2));
      // loop: data-back keeps the gloss off. The photo stays — u0 above already
      // samples the other end of the frame so it reads un-mirrored from behind.
      if (loop) {
        if (flip) el.setAttribute('data-back', '');
        else el.removeAttribute('data-back');
      }
    };

    /** Bind a recycled slice slot to virtual slice j (photo, edge print, geometry vars). */
    const setSlice = (slot: number, j: number) => {
      const list = itemsRef.current;
      if (!list.length) return;
      const q = Math.floor(j / lay.J);
      const jj = j - q * lay.J;
      const fi = lay.sFrame[jj];
      const k = q * lay.L + fi;
      const idx = mod(k, list.length);
      const it = list[idx];
      const pitch = lay.pitch[fi];
      sliceK[slot] = k;
      sliceW[slot] = lay.sW[jj];
      sliceA[slot] = lay.sStart[jj] - lay.cum[fi];
      sliceP[slot] = pitch;
      sliceS0[slot] = q * lay.total + lay.sStart[jj];
      const st = slices[slot].style;
      st.setProperty('--w', sliceW[slot].toFixed(3));
      st.setProperty('--pw', pitch.toFixed(2));
      const ph = slices[slot].firstElementChild as HTMLElement;
      const dense = !preferSmall;
      const paintKey = `${it.src}|${dense ? '2' : '1'}`;
      if (ph.dataset.paint !== paintKey) {
        ph.dataset.paint = paintKey;
        ph.dataset.src = it.src;
        paintPhoto(ph, it, dense, grainImage);
      }
      sliceIdx[slot] = idx;
      st.backgroundImage = `${printFor(slot)}, ${HOLE}, ${HOLE}, ${GRAIN}, ${BASE_SHADE}`;
      lastFlip[slot] = -1;
      // Lite: fixed fog/gloss once — per-frame --sh/--gl is invisible on phones and costs writes.
      if (lite && lastSh[slot] < 0) {
        lastSh[slot] = 0.12;
        lastGl[slot] = 0.18;
        st.setProperty('--sh', '0.12');
        st.setProperty('--gl', '0.18');
      }
    };

    // light (camera space, y down): upper-left-front
    const Lx = -0.4,
      Ly = -0.5,
      Lz = 0.78;
    const Ll = Math.hypot(Lx, Ly, Lz);
    const lx = Lx / Ll,
      ly = Ly / Ll,
      lz = Lz / Ll;
    // half vector with viewer (0,0,1)
    const hl = Math.hypot(lx, ly, lz + 1);
    const hx = lx / hl,
      hy = ly / hl,
      hz = (lz + 1) / hl;

    const render = () => {
      // camera rotation: tilt (look from above) then yaw sway.
      // Lite drops the micro-sway — it forced every slice matrix to change every frame.
      const tilt = (
        loop
          ? LOOP_TILT + (lite ? 0 : 1.2 * Math.sin(clock * 0.42))
          : (variant === 'helix' ? 13 : 11) + (lite ? 0 : 2.2 * Math.sin(clock * 0.42))
      ) * (Math.PI / 180);
      const yaw = (
        loop
          ? lite ? 0 : 2.2 * Math.sin(clock * 0.27)
          : variant === 'helix' || lite
            ? 0
            : 6.5 * Math.sin(clock * 0.27)
      ) * (Math.PI / 180);
      const ct = Math.cos(tilt),
        st = Math.sin(tilt),
        cy = Math.cos(yaw),
        sy = Math.sin(yaw);
      // R = Rx(tilt) * Ry(yaw)   (CSS-style axes), row-major 3x3: v' = R v
      const R = camR;
      R[0] = cy;
      R[1] = 0;
      R[2] = -sy;
      R[3] = st * sy;
      R[4] = ct;
      R[5] = st * cy;
      R[6] = ct * sy;
      R[7] = -st;
      R[8] = ct * cy;

      const zRef = table.zScale * 1.02;
      const zRange = table.zScale * 2.0;

      /* ---------- 1. joints: the path sampled at every slice boundary, in camera space ---------- */
      while (sliceStartAt(lay, jmin) + lay.sW[mod(jmin, lay.J)] + off <= 0) jmin++;
      while (sliceStartAt(lay, jmin) + off > 0) jmin--;
      for (let i = 0; i <= NS; i++) {
        sample(sliceStartAt(lay, jmin + i) + off + pad, pA, dA);
        const o = i * 3;
        jp[o] = R[0] * pA[0] + R[1] * pA[1] + R[2] * pA[2] + shX;
        jp[o + 1] = R[3] * pA[0] + R[4] * pA[1] + R[5] * pA[2] + shY;
        jp[o + 2] = R[6] * pA[0] + R[7] * pA[1] + R[8] * pA[2];
        jd[o] = R[0] * dA[0] + R[1] * dA[1] + R[2] * dA[2];
        jd[o + 1] = R[3] * dA[0] + R[4] * dA[1] + R[5] * dA[2];
        jd[o + 2] = R[6] * dA[0] + R[7] * dA[1] + R[8] * dA[2];
      }

      /* ---------- 2. one orthonormal basis per slice from its two joints ---------- */
      for (let i = 0; i < NS; i++) {
        const o = i * 3,
          o1 = o + 3;
        let ex0 = jp[o1] - jp[o],
          ex1 = jp[o1 + 1] - jp[o + 1],
          ex2 = jp[o1 + 2] - jp[o + 2];
        const chord = Math.hypot(ex0, ex1, ex2) || 1e-9;
        ex0 /= chord;
        ex1 /= chord;
        ex2 /= chord;
        let ey0 = jd[o] + jd[o1],
          ey1 = jd[o + 1] + jd[o1 + 1],
          ey2 = jd[o + 2] + jd[o1 + 2];
        const dot = ey0 * ex0 + ey1 * ex1 + ey2 * ex2;
        ey0 -= dot * ex0;
        ey1 -= dot * ex1;
        ey2 -= dot * ex2;
        const el = Math.hypot(ey0, ey1, ey2) || 1e-9;
        ey0 /= el;
        ey1 /= el;
        ey2 /= el;
        bX[o] = ex0;
        bX[o + 1] = ex1;
        bX[o + 2] = ex2;
        bY[o] = ey0;
        bY[o + 1] = ey1;
        bY[o + 2] = ey2;
        bZ[o] = ex1 * ey2 - ex2 * ey1;
        bZ[o + 1] = ex2 * ey0 - ex0 * ey2;
        bZ[o + 2] = ex0 * ey1 - ex1 * ey0;
        bC[i] = chord;
      }

      /* ---------- 3. light + fog at the JOINTS (shared by both neighbours => no shading seams) ---------- */
      // Lite still needs end-fade for culling; skip Lambert/spec — fog is frozen in setSlice.
      for (let i = 0; i <= NS; i++) {
        const ps = sliceStartAt(lay, jmin + i) + off; // joint position along the path, 0..Lp
        const fade = smooth(Math.min(ps, Lp - ps) / END_FADE);
        jFade[i] = fade;
        if (lite) continue;
        const a = Math.max(0, i - 1) * 3,
          b = Math.min(NS - 1, i) * 3;
        const sa = bZ[a + 2] < 0 ? -1 : 1,
          sb = bZ[b + 2] < 0 ? -1 : 1;
        let n0 = sa * bZ[a] + sb * bZ[b],
          n1 = sa * bZ[a + 1] + sb * bZ[b + 1],
          n2 = sa * bZ[a + 2] + sb * bZ[b + 2];
        const nl = Math.hypot(n0, n1, n2) || 1;
        n0 /= nl;
        n1 /= nl;
        n2 /= nl;
        const depth = clamp((zRef - jp[i * 3 + 2]) / zRange, 0, 1);
        const lam = Math.max(0, n0 * lx + n1 * ly + n2 * lz);
        // Keep depth cue subtle — heavy fog was muddying photos on cream.
        // The back is only slightly dimmer than the front so those photos stay clear.
        // Ends still fade fully to black (they sit off-screen / in the distance).
        const back = loop ? ((sa < 0 ? 1 : 0) + (sb < 0 ? 1 : 0)) * 0.5 : 0;
        const bright = loop
          ? (0.92 + 0.08 * lam) * (1 - 0.2 * depth) * (1 - 0.12 * back) * fade
          : (0.9 + 0.1 * lam) * (1 - 0.22 * depth) * Math.max(fade, 0.35);
        jShade[i] = Math.round((1 - bright) * 100) / 100;
        const sp = hx * n0 + hy * n1 + hz * n2;
        const spec = sp > 0 ? Math.pow(sp, 14) : 0;
        jGloss[i] = Math.round((0.16 + 0.84 * spec) * (1 - depth * 0.45) * 50) / 50;
      }

      /* ---------- 4. pose every slice ---------- */
      for (let i = 0; i < NS; i++) {
        const j = jmin + i;
        const slot = mod(j, NS);
        const el = slices[slot];
        if (slotJ[slot] !== j) {
          slotJ[slot] = j;
          setSlice(slot, j);
        }
        const w = lay.sW[mod(j, lay.J)];
        if (jFade[i] <= 0.01 && jFade[i + 1] <= 0.01) {
          if (lastVis[slot] !== 0) {
            lastVis[slot] = 0;
            el.style.visibility = 'hidden';
          }
          continue;
        }

        const o = i * 3;
        const flip = bZ[o + 2] < 0 ? 1 : 0;
        // Lite: skip posing deep back-facing slices (still show near back at the hairpin).
        // Cuts roughly a third of matrix3d writes on the loop without losing the U-turn.
        if (lite && loop && flip && jFade[i] < 0.55 && jFade[i + 1] < 0.55) {
          if (lastVis[slot] !== 0) {
            lastVis[slot] = 0;
            el.style.visibility = 'hidden';
          }
          continue;
        }
        if (flip !== lastFlip[slot]) orient(slot, flip);

        // basis -> matrix3d. A back-facing slice is turned 180deg about its height axis (un-mirrored
        // from behind) and anchored at its right joint instead, because the box grows from its left edge.
        const sgn = flip ? -1 : 1;
        const sx = (S * bC[i] * sgn) / w;
        const sz = S * sgn;
        const q = flip ? o + 3 : o;
        // Lite: coarser rounding so subpixel drift does not rewrite transform every frame.
        const d = lite ? 3 : 4;
        const dp = lite ? 1 : 2;
        const mx =
          (bX[o] * sx).toFixed(d) + ',' + (bX[o + 1] * sx).toFixed(d) + ',' + (bX[o + 2] * sx).toFixed(d) + ',0,' +
          (bY[o] * S).toFixed(d) + ',' + (bY[o + 1] * S).toFixed(d) + ',' + (bY[o + 2] * S).toFixed(d) + ',0,' +
          (bZ[o] * sz).toFixed(d) + ',' + (bZ[o + 1] * sz).toFixed(d) + ',' + (bZ[o + 2] * sz).toFixed(d) + ',0,' +
          (jp[q] * S).toFixed(dp) + ',' + (jp[q + 1] * S).toFixed(dp) + ',' + (jp[q + 2] * S).toFixed(dp) + ',1';
        if (mx !== lastMx[slot]) {
          lastMx[slot] = mx;
          el.style.transform = 'matrix3d(' + mx + ')';
        }

        if (lastVis[slot] !== 1) {
          lastVis[slot] = 1;
          el.style.visibility = 'visible';
        }
        // fog / gloss: mean of the two joints. Lite freezes these in setSlice.
        if (!lite) {
          const sh = Math.round((jShade[i] + jShade[i + 1]) * 50) / 100;
          if (sh !== lastSh[slot]) {
            lastSh[slot] = sh;
            el.style.setProperty('--sh', String(sh));
          }
          const gl = Math.round((jGloss[i] + jGloss[i + 1]) * 25) / 50;
          if (gl !== lastGl[slot]) {
            lastGl[slot] = gl;
            el.style.setProperty('--gl', String(gl));
          }
        }
        const foc = sliceK[slot] === focusK ? 1 : 0;
        if (foc !== lastFocus[slot]) {
          lastFocus[slot] = foc;
          if (foc) el.setAttribute('data-focus', '');
          else el.removeAttribute('data-focus');
        }
      }

      /* ---------- 5. frames: invisible, accessible buttons posed over each photo ---------- */
      while (cumAt(lay, kmin + 1) + off <= 0) kmin++;
      while (cumAt(lay, kmin) + off > 0) kmin--;
      let bestFront = 1e9;
      for (let i = 0; i < N; i++) {
        const k = kmin + mod(i - kmin, N);
        slotK[i] = k;
        const el = hits[i];
        if (k !== lastK[i]) {
          lastK[i] = k;
          setFrame(i, k);
        }
        const fw = pitchAt(lay, k);
        const x0 = cumAt(lay, k) + off;
        const cs = x0 + fw * 0.5;
        const vis = Math.min(cs, Lp - cs) / END_FADE > 0.06;
        if (vis !== lastFOp[i]) {
          lastFOp[i] = vis;
          el.style.visibility = vis ? 'visible' : 'hidden';
        }
        if (!vis) {
          hitOn[i] = 1;
          continue;
        }
        sample(x0 + pad, pA, dA);
        sample(x0 + fw + pad, pB, dB);
        let ex0 = pB[0] - pA[0],
          ex1 = pB[1] - pA[1],
          ex2 = pB[2] - pA[2];
        const chord = Math.hypot(ex0, ex1, ex2) || 1e-9;
        ex0 /= chord;
        ex1 /= chord;
        ex2 /= chord;
        let ey0 = dA[0] + dB[0],
          ey1 = dA[1] + dB[1],
          ey2 = dA[2] + dB[2];
        const dot = ey0 * ex0 + ey1 * ex1 + ey2 * ex2;
        ey0 -= dot * ex0;
        ey1 -= dot * ex1;
        ey2 -= dot * ex2;
        const el_ = Math.hypot(ey0, ey1, ey2) || 1e-9;
        ey0 /= el_;
        ey1 /= el_;
        ey2 /= el_;
        const ez0 = ex1 * ey2 - ex2 * ey1;
        const ez1 = ex2 * ey0 - ex0 * ey2;
        const ez2 = ex0 * ey1 - ex1 * ey0;
        const c0 = (pA[0] + pB[0]) * 0.5,
          c1 = (pA[1] + pB[1]) * 0.5,
          c2 = (pA[2] + pB[2]) * 0.5;
        const X0 = R[0] * ex0 + R[1] * ex1 + R[2] * ex2;
        const X1 = R[3] * ex0 + R[4] * ex1 + R[5] * ex2;
        const X2 = R[6] * ex0 + R[7] * ex1 + R[8] * ex2;
        const Y0 = R[0] * ey0 + R[1] * ey1 + R[2] * ey2;
        const Y1 = R[3] * ey0 + R[4] * ey1 + R[5] * ey2;
        const Y2 = R[6] * ey0 + R[7] * ey1 + R[8] * ey2;
        const Z0 = R[0] * ez0 + R[1] * ez1 + R[2] * ez2;
        const Z1 = R[3] * ez0 + R[4] * ez1 + R[5] * ez2;
        const Z2 = R[6] * ez0 + R[7] * ez1 + R[8] * ez2;
        const T0 = R[0] * c0 + R[1] * c1 + R[2] * c2;
        const T1 = R[3] * c0 + R[4] * c1 + R[5] * c2;
        const T2 = R[6] * c0 + R[7] * c1 + R[8] * c2;
        const fx = (S * chord) / fw;
        if (loop) {
          // only frames that face the viewer take clicks; the back stays focusable
          // for the keyboard (focus brings it round to the hero spot) but ignores the pointer
          const on = Z2 > 0.2 ? 1 : 0;
          if (on !== hitOn[i]) {
            hitOn[i] = on;
            el.style.pointerEvents = on ? '' : 'none';
          }
        }
        {
          const d = lite ? 3 : 4;
          const dp = lite ? 1 : 2;
          const mx =
            (X0 * fx).toFixed(d) + ',' + (X1 * fx).toFixed(d) + ',' + (X2 * fx).toFixed(d) + ',0,' +
            (Y0 * S).toFixed(d) + ',' + (Y1 * S).toFixed(d) + ',' + (Y2 * S).toFixed(d) + ',0,' +
            (Z0 * S).toFixed(d) + ',' + (Z1 * S).toFixed(d) + ',' + (Z2 * S).toFixed(d) + ',0,' +
            // Photo centre sits on the strip midline (PHOTO_TOP + PHOTO_H/2 === HALF_H)
            ((T0 + shX) * S).toFixed(dp) + ',' + ((T1 + shY) * S).toFixed(dp) + ',' + (T2 * S).toFixed(dp) + ',1';
          if (mx !== lastHitMx[i]) {
            lastHitMx[i] = mx;
            el.style.transform = 'matrix3d(' + mx + ')';
          }
        }
        const dc = Math.abs(cs - heroS);
        if (dc < bestFront) {
          bestFront = dc;
          frontSlot = i;
        }
      }

      // roving tabindex: the front-most frame is the Tab stop
      for (let i = 0; i < N; i++) {
        const want = i === frontSlot ? '0' : '-1';
        if (hits[i].getAttribute('tabindex') !== want) hits[i].setAttribute('tabindex', want);
      }
    };

    /** loop: fit the visible ribbon (approach, both hairpins, receding leg; film edges included) and centre it */
    const measureLoop = () => {
      const h = rootH;
      const w = rootW;
      const t0 = LOOP_TILT * (Math.PI / 180);
      const ct = Math.cos(t0),
        st = Math.sin(t0);
      const [c0, c1] = table.core ?? [0, Lp];
      const pts: number[][] = [];
      // one slice past each end: a slice's screen box reaches past the centreline sample
      const s0 = Math.max(0, c0 - 36);
      const s1 = Math.min(Lp, c1 + 28);
      for (let s = s0; s <= s1; s += 14) {
        sample(s + pad, pA, dA);
        for (const e of [-HALF_H, HALF_H]) {
          const x = pA[0] + dA[0] * e,
            y = pA[1] + dA[1] * e,
            z = pA[2] + dA[2] * e;
          pts.push([x, ct * y + st * z, -st * y + ct * z]);
        }
      }
      const vpY = 0.5;
      let px = 0,
        py = 0,
        sc = 1;
      // shX is added in camera space, then multiplied by each point's own perspective factor.
      // Correct the shift by that factor so the projected box actually lands on the container centre
      // (subtracting raw projected pixels walks the near foreground off the left).
      const bounds = () => {
        let x0 = 1e9,
          x1 = -1e9,
          y0 = 1e9,
          y1 = -1e9,
          kL = 1,
          kR = 1,
          kT = 1,
          kB = 1;
        for (const p of pts) {
          const k = D / Math.max(40, D - p[2]);
          const X = (p[0] + px) * k,
            Y = (p[1] + py) * k;
          if (X < x0) {
            x0 = X;
            kL = k;
          }
          if (X > x1) {
            x1 = X;
            kR = k;
          }
          if (Y < y0) {
            y0 = Y;
            kT = k;
          }
          if (Y > y1) {
            y1 = Y;
            kB = k;
          }
        }
        return { x0, x1, y0, y1, kL, kR, kT, kB };
      };
      for (let it = 0; it < 12; it++) {
        const b = bounds();
        const midX = (b.x0 + b.x1) / 2;
        const midY = (b.y0 + b.y1) / 2;
        px -= midX / ((b.kL + b.kR) / 2 || 1);
        py -= midY / ((b.kT + b.kB) / 2 || 1);
        if (Math.abs(midX) < 0.5 && Math.abs(midY) < 0.5) break;
      }
      const fitted = bounds();
      // Fill more of the width on phones so the ribbon reaches the left edge.
      const compactFit = w < 768 || h < 560;
      const fillX = compactFit ? 0.92 : 0.7;
      const fillY = compactFit ? 0.78 : 0.72;
      sc = Math.min((w * fillX) / (fitted.x1 - fitted.x0), (h * fillY) / (fitted.y1 - fitted.y0));
      S = clamp(sc, 0.2, 2.2);
      shX = px;
      shY = py;
      root.style.perspective = Math.round(D * S) + 'px';
      root.style.perspectiveOrigin = '50% ' + vpY * 100 + '%';
    };

    const measure = () => {
      const h = root.clientHeight || 400;
      const w = root.clientWidth || 640;
      rootW = w;
      rootH = h;
      if (loop) {
        measureLoop();
        return;
      }
      // Fit height AND width so narrow phones don't crop the Z-swing / S fold
      const pad = 0.9;
      const sH = (h * pad) / table.fitH;
      const sW = (w * pad) / Math.max(380, table.zScale * 1.05);
      S = clamp(Math.min(sH, sW), 0.2, 2.2);
      root.style.perspective = Math.round(1100 * S + w * 0.4) + 'px';
    };

    const animating = () =>
      pressed || (drag?.moved ?? false) || Math.abs(inertia) > 2 || snapTo !== null;

    const shouldRun = () =>
      activeRef.current && visible && docVisible && (!reduced || animating());

    const stop = () => {
      if (rafRunning) cancelAnimationFrame(raf);
      rafRunning = false;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const el = now - lastT;
      if (el < minDelta) return;
      let dt = Math.min(el / 1000, 0.1);
      if (lastT === 0) dt = 0.016;
      lastT = now;

      // autoplay keeps full speed while hovering or while a frame merely has focus.
      // It pauses only while the strip is pressed (drag) or when the user prefers reduced motion.
      const target = reduced || pressed ? 0 : 1;
      playF += (target - playF) * (1 - Math.exp(-dt * 5));
      if (Math.abs(target - playF) < 0.002) playF = target;

      if (snapTo !== null) {
        const d = snapTo - off;
        if (reduced || Math.abs(d) < 0.4) {
          off = snapTo;
          snapTo = null;
        } else {
          off += d * (1 - Math.exp(-dt * 7));
        }
        inertia = 0;
      } else if (!(drag && drag.moved)) {
        off += (-BASE_FPS * meanPitch() * speedRef.current * playF + inertia) * dt;
        inertia *= Math.exp(-dt * 2.4);
        if (Math.abs(inertia) < 2) inertia = 0;
      }
      clock += dt * (reduced ? 0 : 0.3 + 0.7 * playF);
      render();

      if (!shouldRun()) stop();
    };

    const start = () => {
      if (rafRunning || !shouldRun()) return;
      rafRunning = true;
      lastT = 0;
      raf = requestAnimationFrame(tick);
    };

    const kick = () => {
      if (!activeRef.current) return;
      if (!rafRunning) {
        if (shouldRun()) start();
        else render();
      }
    };

    /* ---- visibility / reduced motion ---- */
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible) start();
        else stop();
      },
      { rootMargin: '80px' },
    );
    io.observe(root);
    const onVis = () => {
      docVisible = !document.hidden;
      if (docVisible) start();
      else stop();
    };
    document.addEventListener('visibilitychange', onVis);
    const onMQ = () => {
      reduced = reduceMQ.matches;
      if (reduced) {
        inertia = 0;
        snapTo = null;
      }
      start();
      render();
    };
    reduceMQ.addEventListener?.('change', onMQ);

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom
      let dx = e.deltaX;
      let dy = e.deltaY;
      if (e.deltaMode === 1) {
        dx *= 16;
        dy *= 16;
      } else if (e.deltaMode === 2) {
        dx *= rootW;
        dy *= rootH;
      }
      // Vertical wheel / trackpad scroll keeps moving the page.
      if (Math.abs(dx) <= Math.abs(dy)) return;
      e.preventDefault();
      const world = dx / (S * 1.12);
      off += world;
      inertia = reduced ? 0 : clamp(world * 14, -MAX_FLICK * meanPitch(), MAX_FLICK * meanPitch());
      snapTo = null;
      kick();
    };
    root.addEventListener('wheel', onWheel, { passive: false });

    const ro = new ResizeObserver(() => {
      measure();
      render();
    });
    ro.observe(root);

    measure();
    render();
    onReadyRef.current?.();
    start();

    /* ---- handlers exposed to React ---- */
    const worldPerPx = () => 1 / (S * 1.12);

    const refresh = () => {
      slotJ.fill(NaN);
      lastK.fill(NaN);
      render();
    };

    const bridge = {
      kick,
      pointerDown(e: PointerEvent<HTMLDivElement>) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const threshold = e.pointerType === 'touch' || e.pointerType === 'pen' ? 14 : DRAG_THRESHOLD;
        drag = {
          id: e.pointerId,
          x0: e.clientX,
          lastX: e.clientX,
          lastT: performance.now(),
          moved: false,
          vel: 0,
          threshold,
        };
        pressed = true;
        dragWasMove = false;
        snapTo = null;
        // freeze instantly: the frame under the finger must not slide away before the click fires
        playF = 0;
        inertia = 0;
        kick();
      },
      pointerMove(e: PointerEvent<HTMLDivElement>) {
        const d = drag;
        if (!d || e.pointerId !== d.id) return;
        if (!d.moved) {
          if (Math.abs(e.clientX - d.x0) < d.threshold) return;
          d.moved = true;
          dragWasMove = true;
          try {
            root.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          root.setAttribute('data-dragging', 'true');
          d.lastX = e.clientX;
          d.lastT = performance.now();
          return;
        }
        const t = performance.now();
        const dx = e.clientX - d.lastX;
        const dtm = Math.max(1, t - d.lastT);
        off += dx * worldPerPx();
        d.vel = d.vel * 0.6 + ((dx * worldPerPx()) / (dtm / 1000)) * 0.4;
        d.lastX = e.clientX;
        d.lastT = t;
        kick();
      },
      pointerUp(e: PointerEvent<HTMLDivElement>) {
        const d = drag;
        if (!d || e.pointerId !== d.id) return;
        const wasTap = !d.moved;
        if (d.moved) {
          const stale = performance.now() - d.lastT > 90;
          inertia = reduced || stale ? 0 : clamp(d.vel, -MAX_FLICK * meanPitch(), MAX_FLICK * meanPitch());
          dragEndedAt = performance.now();
          try {
            root.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
        root.removeAttribute('data-dragging');
        drag = null;
        pressed = false;
        // Touch often never fires click on a preserve-3d button. Open from the
        // tap here, and swallow the click if the browser also emits one.
        if (wasTap && (e.pointerType === 'touch' || e.pointerType === 'pen')) {
          const fromPoint = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
          const hit =
            ((e.target as HTMLElement | null)?.closest?.('[data-fs3d-hit]') as HTMLElement | null) ??
            (fromPoint?.closest?.('[data-fs3d-hit]') as HTMLElement | null);
          const slot = hit ? Number(hit.dataset.fs3dSlot) : -1;
          if (slot >= 0) {
            // Open immediately. Ignore the click that may follow, so a tap
            // never fires the lightbox twice and still works when click doesn't.
            ignoreClickUntil = performance.now() + 450;
            swallowClick = true;
            const len = itemsRef.current.length;
            const idx = len ? mod(slotK[slot], len) : 0;
            const item = itemsRef.current[idx];
            if (item) onSelectRef.current?.(item, idx);
          }
        }
        kick();
      },
      focusSlot(slot: number, fromKeyboard: boolean) {
        if (fromKeyboard) {
          const k = slotK[slot];
          focusK = k;
          snapTo = heroS - pitchAt(lay, k) / 2 - cumAt(lay, k); // bring this frame to the hero spot
          kick();
        }
      },
      blurAll() {
        focusK = NaN;
        kick();
      },
      nudge(frames: number) {
        snapTo = (snapTo ?? off) + frames * meanPitch();
        kick();
      },
      neighbor(slot: number, dir: number) {
        const want = slotK[slot] + dir;
        return slotK.indexOf(want);
      },
      slotIndex(slot: number) {
        const len = itemsRef.current.length;
        return len ? mod(slotK[slot], len) : 0;
      },
      wasDrag() {
        return dragWasMove && performance.now() - dragEndedAt < 120;
      },
      consumeSwallow() {
        if (performance.now() < ignoreClickUntil) return true;
        const v = swallowClick;
        swallowClick = false;
        return v;
      },
      refresh,
      syncActive() {
        if (shouldRun()) start();
        else stop();
      },
      showIndex(index: number) {
        const len = lay.L;
        if (!len || !Number.isFinite(index)) return;
        const i = mod(Math.round(index), len);
        let kc = kmin;
        while (cumAt(lay, kc + 1) + off <= heroS) kc++;
        let k = kc - mod(kc, len) + i;
        if (k - kc > len / 2) k -= len;
        else if (kc - k > len / 2) k += len;
        snapTo = heroS - pitchAt(lay, k) / 2 - cumAt(lay, k);
        kick();
      },
    };
    api.current = bridge;

    // Re-bake edge prints once IBM Plex Mono is actually available (canvas
    // otherwise silently falls back to a different mono and caches it forever).
    let fontAlive = true;
    void ensurePrintFont(fontStack).then(() => {
      if (!fontAlive) return;
      revokePrints();
      printCache.clear();
      bridge.refresh();
    });

    // Fallback for items that declare no ratio: re-flow once the decoded size is known.
    function onRatio(idx: number, a: number) {
      const prev = learned.get(idx);
      if (prev !== undefined && Math.abs(prev - a) < 0.005) return;
      learned.set(idx, a);
      // keep the frame at the centre where it is: remember it as (index, fraction), re-solve after re-flow
      const mid = Lp / 2;
      let kc = kmin;
      while (cumAt(lay, kc + 1) + off <= mid) kc++;
      const frac = (mid - cumAt(lay, kc) - off) / pitchAt(lay, kc);
      const pitches = Array.from(lay.pitch);
      learned.forEach((asp, i) => {
        if (aspectOf(itemsRef.current[i] ?? {}) === undefined) pitches[i] = pitchFor(asp, gp);
      });
      lay = buildLayout(pitches, gp, plan.target);
      off = mid - cumAt(lay, kc) - frac * pitchAt(lay, kc);
      if (snapTo !== null) snapTo = null;
      bridge.refresh();
    }

    return () => {
      fontAlive = false;
      stop();
      revokePrints();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      reduceMQ.removeEventListener?.('change', onMQ);
      root.removeEventListener('wheel', onWheel);
      api.current = null;
    };
  }, [variant, amplitude, loopCfg, perspective, plan, low, frameCount, sliceCount, gapC, stockLabel, flat, tier, grainSrc, printFont]);

  // Layout, not a passive effect: the loop must be cancelled before paint
  // when the camera leaves this page. Tiers, reduced motion, and the
  // off-screen stop stay inside shouldRun.
  useIsoLayoutEffect(() => {
    api.current?.syncActive();
  }, [active]);

  const selectedRef = useRef(selectedIndex);
  useIsoLayoutEffect(() => {
    if (selectedIndex == null || selectedIndex === selectedRef.current) {
      selectedRef.current = selectedIndex;
      return;
    }
    selectedRef.current = selectedIndex;
    api.current?.showIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    if (tier === 'ssr' || !flat) return;
    onReadyRef.current?.();
  }, [flat, tier]);

  // items changed → re-sync labels / srcs
  useIsoLayoutEffect(() => {
    api.current?.refresh();
  }, [items]);

  /* ---------------- React event glue (delegated, no per-frame work) ---------------- */
  const slotOf = (t: EventTarget | null): number => {
    const el = (t as HTMLElement | null)?.closest?.('[data-fs3d-hit]') as HTMLElement | null;
    return el ? Number(el.dataset.fs3dSlot) : -1;
  };

  const onClickCapture = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (api.current?.wasDrag() || api.current?.consumeSwallow()) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const onClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!api.current || api.current.consumeSwallow()) return;
    const slot = slotOf(e.target);
    if (slot < 0) return;
    const idx = api.current.slotIndex(slot);
    const item = itemsRef.current[idx];
    if (!item) return;
    const cb = onSelectRef.current;
    if (cb) {
      const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
      if (!modified) e.preventDefault(); // let the parent decide (lightbox etc.) instead of navigating
      cb(item, idx);
    }
  }, []);

  const onFocus = useCallback((e: FocusEvent<HTMLDivElement>) => {
    const slot = slotOf(e.target);
    if (slot < 0) return;
    let kb = false;
    try {
      kb = (e.target as HTMLElement).matches(':focus-visible');
    } catch {
      kb = true;
    }
    api.current?.focusSlot(slot, kb);
  }, []);

  const onBlur = useCallback((e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) api.current?.blurAll();
  }, []);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const slot = slotOf(e.target);
    if (slot < 0) return;
    e.preventDefault();
    const next = api.current?.neighbor(slot, e.key === 'ArrowRight' ? 1 : -1) ?? -1;
    if (next < 0) return;
    (rootRef.current?.querySelector(`[data-fs3d-slot="${next}"]`) as HTMLElement | null)?.focus();
  }, []);

  /* ---------------- markup ---------------- */
  const list = items.length ? items : [];
  const rootBase = variant === 'loop' ? `${styles.root} ${styles.loop}` : styles.root;
  const rootClass = className ? `${rootBase} ${className}` : rootBase;
  const ready = tier !== 'ssr';
  const show3d = ready && !flat && list.length > 0;

  return (
    <div
      ref={rootRef}
      className={rootClass}
      style={
        {
          '--gap': gapC,
          '--fs3d-grain': cssUrl(grainSrc || DEFAULT_GRAIN_SRC),
          ...(height !== undefined ? { height } : null),
        } as CSSProperties
      }
      role="group"
      aria-roledescription="film strip"
      aria-label={ariaLabel}
      aria-busy={ready ? undefined : true}
      data-variant={variant}
      data-fs3d-root=""
      data-compact={tier === 'ssr' ? undefined : tier === 'compact' ? 'true' : 'false'}
      data-tier={tier === 'ssr' ? undefined : tier}
      data-renderer={flat ? 'flat' : ready ? '3d' : undefined}
      onPointerDown={(e) => api.current?.pointerDown(e)}
      onPointerMove={(e) => api.current?.pointerMove(e)}
      onPointerUp={(e) => api.current?.pointerUp(e)}
      onPointerCancel={(e) => api.current?.pointerUp(e)}
      onClickCapture={onClickCapture}
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      {flat ? null : (
        /* base + photos, sliced along the path (decorative; the buttons below carry the semantics) */
        <div className={styles.stage}>
          {show3d &&
            Array.from({ length: sliceCount }, (_, i) => (
              <div key={i} className={styles.slice} data-fs3d-slice={i} style={SLICE_INIT} aria-hidden="true">
                <i className={styles.ph} />
              </div>
            ))}
          {show3d &&
            Array.from({ length: frameCount }, (_, i) => {
              const it = list[i % list.length];
              const common = {
                className: styles.hit,
                'data-fs3d-hit': '',
                'data-fs3d-slot': i,
                'aria-label': it.label ?? it.alt,
                tabIndex: i === 0 ? 0 : -1,
                style: SLICE_INIT,
              } as const;
              return asLinks ? (
                <a key={i} {...common} href={it.href} />
              ) : (
                <button key={i} type="button" {...common} />
              );
            })}
        </div>
      )}
    </div>
  );
}

const SLICE_INIT: CSSProperties = { visibility: 'hidden' };
