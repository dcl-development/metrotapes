import styled from 'styled-components'
import { KIOSK_PANEL_H, KIOSK_PANEL_W, KIOSK_RADIUS_PX } from '../lib/kioskSize'
import { decideQualityStep } from '../lib/gfxDetect'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGfx } from '../lib/useGfx'

const GRAIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#n)"/>
  </svg>`,
)

const GLASS_SMUDGE_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="384">
    <filter id="s">
      <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="6" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#s)"/>
  </svg>`,
)

export const Layer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: ${(p) => (p.$hit ? 'auto' : 'none')};
  overflow: ${(p) => (p.$page ? 'hidden' : 'visible')};

  canvas {
    display: block;
    position: absolute !important;
    inset: 0;
    z-index: 0;
    width: 100% !important;
    height: 100% !important;
    max-width: 100%;
    /* Never fade the canvas itself. opacity + the film blend tears the
       drawing buffer, and the wall page already covers it when immersed. */
  }
`

export const SceneWrap = styled.div`
  position: absolute;
  inset: 0;
  /* Clip CSS-3D overflow here, not on the preserve-3d node.
     three.js CSS3DRenderer does the same: hidden on the outer box,
     preserve-3d on the child. Otherwise a matrix3d element grows the
     document, the scrollbar toggles, and the canvas buffer resizes. */
  overflow: hidden;
`

export const Overlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 3;
  pointer-events: none;
  overflow: ${(p) => (p.$page ? 'hidden' : 'visible')};
  transform-style: ${(p) => (p.$page ? 'flat' : 'preserve-3d')};
  background: ${(p) => (p.$page ? '#0c0e10' : 'transparent')};
  /* Opacity, not visibility — iOS preserve-3d + visibility:hidden never shows children. */
  opacity: 0;
  ${(p) => p.$hide && `
    display: none !important;
  `}
  ${(p) => p.$page && `
    /* Beat the inline opacity the CSS-3D loop wrote. Page view stops the
       frameloop, so that loop will not get another chance to set it. */
    opacity: 1 !important;
    visibility: visible !important;
    perspective: none !important;
    right: 0;
    bottom: 72px;
    width: 100% !important;
    height: auto !important;
  `}
`

export const OverlayCam = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-style: ${(p) => (p.$page ? 'flat' : 'preserve-3d')};
  pointer-events: none;
  ${(p) => p.$page && `
    transform: none !important;
  `}
`

export const OverlayObj = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  /* Solid hit shield over the projected screen so the canvas can't steal clicks */
  pointer-events: ${(p) => (p.$live || p.$catch ? 'auto' : 'none')};
  cursor: ${(p) => (p.$catch && !p.$live ? 'pointer' : 'inherit')};
  transform-style: ${(p) => (p.$fill ? 'flat' : 'preserve-3d')};
  ${(p) => p.$off && `
    visibility: hidden !important;
  `}
  ${(p) => !p.$live && `
    * { pointer-events: none !important; }
  `}
  ${(p) => p.$fill && `
    visibility: visible !important;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: none !important;
  `}
`

export const KioskFrame = styled.div`
  position: relative;
  width: ${KIOSK_PANEL_W}px;
  height: ${KIOSK_PANEL_H}px;
  overflow: hidden;
  border-radius: ${KIOSK_RADIUS_PX}px;
  /* Inherit from OverlayObj — don't re-enable hits while intro has live=false */
  pointer-events: inherit;
  /* Soften retina HTML so it sits in the lo-fi WebGL world (mobile). */
  ${(p) => p.$soft && `
    filter: contrast(0.94) saturate(0.86) brightness(0.98);
  `}
`

/** LCD glass: gasket + glare. No RGB subpixel mesh — that read as a screen door. */
export const KioskGlass = styled.div`
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 1.5px rgba(6, 8, 10, 0.72),
    inset 0 0 0 3px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    inset 0 8px 14px rgba(0, 0, 0, 0.16);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background:
      radial-gradient(ellipse 90% 70% at 50% 40%, transparent 62%, rgba(0, 0, 0, 0.1) 100%);
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background:
      radial-gradient(ellipse 46% 15% at 90% 14%, rgba(255, 248, 232, 0.22) 0%, transparent 64%),
      radial-gradient(ellipse 68% 18% at 24% -6%, rgba(255, 255, 255, 0.1) 0%, transparent 70%),
      radial-gradient(ellipse 28% 10% at 78% 58%, rgba(255, 255, 255, 0.04), transparent 70%),
      radial-gradient(ellipse 22% 8% at 16% 88%, rgba(255, 255, 255, 0.05), transparent 72%);
  }
`

export const KioskGlassDirt = styled.div`
  position: absolute;
  inset: 0;
  z-index: 9;
  pointer-events: none;
  border-radius: inherit;
  opacity: 0.08;
  background-image:
    url("data:image/svg+xml,${GLASS_SMUDGE_SVG}"),
    radial-gradient(ellipse 38% 16% at 70% 18%, rgba(255, 255, 255, 0.22), transparent 68%),
    radial-gradient(ellipse 26% 12% at 22% 74%, rgba(255, 255, 255, 0.14), transparent 70%);
  background-size: 180px 270px, 100% 100%, 100% 100%;
`

export const WallFrame = styled.div`
  position: relative;
  width: ${(p) => (p.$fill ? '100%' : `${p.$w}px`)};
  height: ${(p) => (p.$fill ? '100%' : `${p.$h}px`)};
  overflow: hidden;
  border-radius: 0;
  pointer-events: inherit;
  background: #0c0e10;
  contain: ${(p) => (p.$fill ? 'none' : 'strict')};
  ${(p) => !p.$fill && `
    * { pointer-events: none !important; }
  `}
  /* Projected boards only — fullscreen page view stays sharp. */
  ${(p) => p.$soft && !p.$fill && `
    filter: contrast(0.94) saturate(0.86) brightness(0.98);
  `}
`

/** Film over canvas + CSS-3D screens (under chrome). Ties lo-fi WebGL to sharp HTML. */
export const StationFilm = styled.div`
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    opacity: ${(p) => p.$grain};
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,${GRAIN_SVG}");
    background-size: 140px 140px;
    /* steps(2) only ever showed the 0% pose and the old 50% pose
       (translate 0.9%, -1% of a layer padded 8%). Shift the tile by that
       same amount. A transform on this blend layer is what splits the
       canvas into tiles and glitches the lower half. */
    animation: stationGrain 0.55s steps(2, end) infinite;
  }

  ${(p) => p.$ca && `
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      opacity: 0.55;
      mix-blend-mode: screen;
      background:
        linear-gradient(
          90deg,
          rgba(255, 40, 60, 0.07) 0%,
          transparent 18%,
          transparent 82%,
          rgba(40, 220, 255, 0.07) 100%
        ),
        radial-gradient(ellipse at center, transparent 52%, rgba(0, 0, 0, 0.22) 100%);
    }
  `}

  @keyframes stationGrain {
    from { background-position: 0 0; }
    /* steps(2, end) holds the halfway value in the second half.
       2.088% / 2 = 1.044% ≈ 0.9% of the old 116% layer. */
    to { background-position: 2.088% -2.32%; }
  }

  @media (prefers-reduced-motion: reduce) {
    &::before { animation: none; }
  }
`

/**
 * Runtime budget guard.
 * Soften DPR first, then drop a tier. Step back up only with headroom,
 * never above the probed ceiling. Warm-up + hysteresis so fly-ins don't flap.
 */
export function GfxWatch({ busyRef, armed = true }) {
  const {
    soften,
    drop,
    promote,
    finishWarm,
    canSoften,
    canDrop,
    canPromote,
    warmCorrectable,
    tier,
    ceiling,
    locked,
  } = useGfx()
  const acc = useRef({
    warm: 0,
    cool: 0,
    t: 0,
    n: 0,
    hitches: 0,
    sinceDrop: Number.POSITIVE_INFINITY,
    sincePromote: Number.POSITIVE_INFINITY,
  })

  useFrame((_, dt) => {
    // Idle pumps run slower than 36fps on purpose. Don't read that as jank.
    if (!armed) return
    if (!canSoften && !canDrop && !canPromote && !warmCorrectable) return
    // A camera move is supposed to be heavy. Don't treat it as a reason
    // to drop DPR mid-flight — that resizes the buffer and jerks the shot.
    if (busyRef?.current) return

    const a = acc.current
    // Cap so a background tab resume doesn't look like 2fps forever.
    const frame = Math.min(Math.max(dt, 0), 0.1)
    a.warm += frame
    if (a.cool > 0) a.cool = Math.max(0, a.cool - frame)
    if (Number.isFinite(a.sinceDrop)) a.sinceDrop += frame
    if (Number.isFinite(a.sincePromote)) a.sincePromote += frame
    if (a.warm < 3) return

    a.t += frame
    a.n += 1
    // ~21fps frame = hitch (60Hz target; 48ms+ is a real stall).
    if (frame > 0.048) a.hitches += 1

    if (a.t < 1.25) return

    const fps = a.n / a.t
    const hitchRate = a.hitches / a.t
    a.t = 0
    a.n = 0
    a.hitches = 0

    const decision = decideQualityStep({
      fps,
      hitchRate,
      tier,
      ceiling,
      canSoften,
      locked,
      sinceDrop: a.sinceDrop,
      sincePromote: a.sincePromote,
      cool: a.cool,
      warmCorrectable,
    })
    if (warmCorrectable && !decision.warmCorrectable) finishWarm()
    if (decision.action === 'hold') return

    a.cool = decision.cool
    if (decision.action === 'soften') {
      soften()
      a.warm = 1.2
      return
    }
    if (decision.action === 'drop') {
      drop()
      a.sinceDrop = 0
      a.warm = 0.8
      return
    }
    promote(Boolean(decision.raiseCeiling))
    a.sincePromote = 0
    a.warm = 0.8
  })

  return null
}

export function ToneMap() {
  const { gl } = useThree()
  const { settings } = useGfx()
  useLayoutEffect(() => {
    gl.toneMappingExposure = settings.exposure
  }, [gl, settings.exposure])
  return null
}

/** Keep the drawing buffer on the stage box, including while frameloop is never. */
export function StageFit() {
  const gl = useThree((s) => s.gl)
  const setSize = useThree((s) => s.setSize)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const el = gl.domElement?.parentElement
    if (!el) return undefined
    const apply = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w < 2 || h < 2) return
      setSize(w, h, false)
      invalidate()
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    const vv = window.visualViewport
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    vv?.addEventListener('resize', apply)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
      vv?.removeEventListener('resize', apply)
    }
  }, [gl, invalidate, setSize])
  return null
}

/** Advances flicker and the rat without a full-rate loop. */
export function IdlePump({ ms }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (!ms) return undefined
    const id = window.setInterval(() => invalidate(), ms)
    return () => window.clearInterval(id)
  }, [invalidate, ms])
  return null
}

export const ChromeBar = styled.div`
  position: absolute;
  left: 50%;
  bottom: max(1.1rem, env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 0.15rem;
  pointer-events: auto;
  ${(p) => p.$dock && `
    left: 0;
    right: 0;
    bottom: 0;
    transform: none;
    height: 72px;
    justify-content: flex-end;
    padding: 0 0.85rem max(0px, env(safe-area-inset-bottom, 0px));
    box-sizing: border-box;
    background: #0a0908;
  `}
`

/** Far left / right of the stage — look aside even when HTML screens eat canvas hits. */
export const EdgeHit = styled.button`
  position: absolute;
  top: 0;
  bottom: 0;
  ${(p) => (p.$side === 'left' ? 'left: 0;' : 'right: 0;')}
  width: min(18vw, 7.5rem);
  z-index: 4;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ew-resize;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
`

export const ChromeBtn = styled.button`
  margin: 0;
  padding: 0;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  animation: chromePulse 2.1s ease-in-out infinite;

  &:hover { color: rgba(255, 255, 255, 0.95); }
  &:active { color: rgba(255, 255, 255, 0.8); }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  @keyframes chromePulse {
    0%, 100% {
      transform: scale(1);
      color: rgba(255, 255, 255, 0.45);
    }
    50% {
      transform: scale(1.1);
      color: rgba(255, 255, 255, 0.95);
    }
  }
`

export function LivePhotoIcon() {
  const dashes = 26
  const r = 13.15
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden>
      <circle cx="16" cy="16" r="4" fill="none" stroke="currentColor" strokeWidth="1.85" />
      <circle cx="16" cy="16" r="7.35" fill="none" stroke="currentColor" strokeWidth="1.85" />
      {Array.from({ length: dashes }, (_, i) => {
        const a = (i / dashes) * Math.PI * 2
        const x = 16 + Math.cos(a) * r
        const y = 16 + Math.sin(a) * r
        return (
          <rect
            key={i}
            x={x - 0.7}
            y={y - 1.55}
            width="1.4"
            height="3.1"
            rx="0.7"
            fill="currentColor"
            transform={`rotate(${(a * 180) / Math.PI} ${x} ${y})`}
          />
        )
      })}
    </svg>
  )
}

export function PanArrow({ dir }) {
  const d = dir === 'left'
    ? 'M25 8 L13 20 L25 32'
    : 'M15 8 L27 20 L15 32'
  return (
    <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function HomeIcon() {
  return (
    <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden>
      <path
        d="M8 19 L20 8 L32 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 18.5 V31 H27 V18.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ReadyPing({ onReady, hud, wallHud }) {
  const { gl, scene, camera } = useThree()
  const sent = useRef(false)
  const frames = useRef(0)

  useLayoutEffect(() => {
    try {
      gl.compile(scene, camera)
    } catch {
      /* compile is best-effort */
    }
  }, [camera, gl, scene])

  useFrame(() => {
    if (sent.current) return
    frames.current += 1
    if (frames.current < 4) return
    // Hold boot until CSS-3D overlays have a live perspective (screens warmed).
    const wallOk = Boolean(wallHud?.current?.root?.style?.perspective)
    const kioskOk = Boolean(hud?.current?.root?.style?.perspective)
    if ((!wallOk || !kioskOk) && frames.current < 120) return
    sent.current = true
    onReady?.()
  })

  return null
}
