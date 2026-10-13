import * as THREE from 'three'
import { getWallFace } from '../lib/wallSize'

/**
 * 3D platform. Intro: one continuous MetroCard wind-flight onto litter, then kiosk home.
 *
 * HARD PLAN — one step at a time:
 *  0. Fullscreen Canvas, pointer-events none, overlays stay on top
 *  1. Grey floor + white wall + dark ceiling + locked camera
 *  2. Yellow tactile strip + repeating I-beam pillars
 *  3. Fluorescent tubes + fog
 *  4. Procedural tile + concrete materials
 *  5. Helvetica signage (Exit-style, pillar type)
 *  6. Track trench + simple silver car  ← here
 *  7. Subtle motion, pause after swipe, prefers-reduced-motion
 *
 * Space: +Y up, +X toward the tracks (right), camera looks down −Z.
 */
export const LEN = 52
export const HEIGHT = 3.22
export const WALL_H = HEIGHT - 0.2
export const WALL_X = -3.6
export const EDGE_X = 1.38
export const FLOOR_W = 10.45
export const MID_Z = -18
export const PILLAR_N = 11
export const PILLAR_GAP = 7.5
export const PILLAR_Z0 = -0.9
export const TRACK_Y = -1.08
export const TRACK_X0 = EDGE_X + 0.28
export const TRACK_W = WALL_X + FLOOR_W - TRACK_X0
export const TRACK_CX = TRACK_X0 + 2.05
export const RAIL_HALF = 0.72
export const PLAT_W = TRACK_X0 - WALL_X
export const TRAIN_Z = -8.4
export const TRAIN_Y = TRACK_Y + 0.14
export const WALL_BOARD_Z0 = -3.2

function isMobileViewport() {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

export function isWallPov(key) {
  return key === 'photo' || key === 'video' || key === 'about'
}

function wallBoardZ(key) {
  const { pitch } = getWallFace()
  if (key === 'photo') return WALL_BOARD_Z0
  if (key === 'video') return WALL_BOARD_Z0 - pitch
  return WALL_BOARD_Z0 - pitch * 2
}

function viewAspect() {
  if (typeof window === 'undefined') return 16 / 9
  const h = Math.max(1, window.innerHeight - 64)
  return window.innerWidth / h
}

/** World-space center of the live CSS page on a wall board. */
function wallContentOrigin(z) {
  const wall = getWallFace()
  return {
    x: WALL_X + 0.04 + 0.038 + 0.004,
    y: (Number.isFinite(wall.boardY) ? wall.boardY : 1.72) + wall.contentY,
    z,
  }
}

/**
 * Park looking straight at the page so it covers the canvas.
 * Cover (not contain): no tile wall around the edges. The overlay then
 * goes fullscreen so you're on the page, not staring at a poster.
 */
function pageShot(z, aspect) {
  const wall = getWallFace()
  const a = Number.isFinite(aspect) && aspect > 0.25 ? aspect : viewAspect()
  const o = wallContentOrigin(z)
  const fov = isMobileViewport() ? 34 : 28
  const vFov = THREE.MathUtils.degToRad(fov)
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * a)
  const dist = Math.min(
    (wall.contentH / 2) / Math.tan(vFov / 2),
    (wall.contentW / 2) / Math.tan(hFov / 2),
  ) * 0.985
  return {
    position: [o.x + dist, o.y, o.z],
    lookAt: [o.x, o.y, o.z],
    fov,
    ease: 1.35,
  }
}

export const POVS = {
  approach: {
    position: [-1.35, 1.68, 5.8],
    lookAt: [0.45, 1.12, -8],
    fov: 52,
    ease: 0.82,
  },
  kiosk: {
    // Close on the LCD — slight pullback so chrome still reads
    position: [0.38, 1.36, -2.38],
    lookAt: [0.38, 1.2, -4.28],
    fov: 51,
    ease: 1.35,
  },
  kioskMobile: {
    // Portrait: smaller pullback than desktop — keep UI readable
    position: [0.38, 1.34, -2.32],
    lookAt: [0.38, 1.2, -4.32],
    fov: 52,
    ease: 1.35,
  },
  // Over the tracks, near the far wall — train + trench + rat, stairs back-left
  kioskWideRight: {
    position: [5.78, 1.72, -2.55],
    lookAt: [2.62, 0.78, -7.85],
    fov: 50,
    ease: 1.18,
  },
  // Portrait hFOV is tight — stand further back so the car stays in frame
  kioskWideRightMobile: {
    position: [5.52, 1.92, 0.42],
    lookAt: [3.12, 0.62, -8.05],
    fov: 80,
    ease: 1.18,
  },
  // In front of the kiosk, toward the wall — cabinet off the right edge.
  kioskWideLeft: {
    position: [-1.48, 1.46, -2.02],
    lookAt: [-3.52, 1.34, -5.85],
    fov: 88,
    ease: 1.18,
  },
  // Portrait: pulled back so PHOTO / VIDEO / ABOUT all fit
  kioskWideLeftMobile: {
    position: [-0.15, 1.6, -0.28],
    lookAt: [-3.48, 1.4, -5.15],
    fov: 82,
    ease: 1.18,
  },
}

export const CAM = POVS.kiosk

export function isLandscapeZoom(zoom) {
  return zoom === 'left' || zoom === 'right' || zoom === 'wide'
}

/** NDC X from an R3F pointer event or a raw canvas click. Left is -1. */
export function ndcXFromEvent(e) {
  if (typeof e?.pointer?.x === 'number') return e.pointer.x
  const t = e?.target
  if (!t?.getBoundingClientRect || e.clientX == null) return null
  const rect = t.getBoundingClientRect()
  if (!rect.width) return null
  return ((e.clientX - rect.left) / rect.width) * 2 - 1
}

/** NDC X across the whole station stage (edge strips + missed canvas clicks). */
export function ndcXFromClient(clientX, root) {
  if (clientX == null || !root?.getBoundingClientRect) return null
  const rect = root.getBoundingClientRect()
  if (!rect.width) return null
  return ((clientX - rect.left) / rect.width) * 2 - 1
}

/** Active camera shot — phones use a pulled-back kiosk framing. */
export function resolvePov(key, aspect, kioskZoom = 'close') {
  if (key === 'kiosk') {
    if (kioskZoom === 'left') {
      return aspect < 0.85 ? POVS.kioskWideLeftMobile : POVS.kioskWideLeft
    }
    if (kioskZoom === 'right' || kioskZoom === 'wide') {
      return aspect < 0.85 ? POVS.kioskWideRightMobile : POVS.kioskWideRight
    }
    return isMobileViewport() ? POVS.kioskMobile : POVS.kiosk
  }
  if (isWallPov(key)) return pageShot(wallBoardZ(key), aspect)
  return POVS[key] ?? CAM
}

export const COL = {
  end: '#0e1012',
  steel: '#2a2e32',
  wood: '#d8b07a',
  woodDark: '#c49a62',
  clear: '#1a1f24',
  tube: '#f3f6ff',
  fixture: '#1c1c1f',
}

export const TILE = 0.11
export const WALL_ROWS = Math.round(WALL_H / TILE)
export const WALL_R = WALL_X + FLOOR_W
// Freestanding flight against the left wall, climbing away from the camera (−Z)
export const STAIR_W = 2.4
export const STAIR_X = WALL_X + STAIR_W * 0.5 + 0.28
export const STAIR_Z0 = -8.6
export const STAIR_N = 14
export const STAIR_RISE = 0.16
export const STAIR_RUN = 0.27
export const PILLAR_X = EDGE_X - 0.22
export const FONT = 'Helvetica, "Helvetica Neue", "Arial Black", Arial, sans-serif'
export const EXIT_RED = '#C60C30'

export function hash01(i) {
  let n = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b)
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}
