import * as THREE from 'three'
import { KIOSK_BEZEL, KIOSK_CAB_H, KIOSK_CAB_W, KIOSK_PANEL_H, KIOSK_PANEL_W, KIOSK_POST_H, KIOSK_SCREEN_H, KIOSK_SCREEN_W } from '../lib/kioskSize'
import { css3dBoxChanged } from '../lib/stationFrame'

export const KIOSK = {
  x: 0.38,
  z: -4.35,
  cabW: KIOSK_CAB_W,
  cabH: KIOSK_CAB_H,
  cabD: 0.36,
  postH: KIOSK_POST_H,
  postW: 0.09,
  bezel: KIOSK_BEZEL,
  panelW: KIOSK_PANEL_W,
  screenW: KIOSK_SCREEN_W,
  screenH: KIOSK_SCREEN_H,
  panelH: KIOSK_PANEL_H,
}

const cssEps = (v) => (Math.abs(v) < 1e-10 ? 0 : v)

function cssMatrix3d(matrix, multipliers, prepend = '') {
  let out = 'matrix3d('
  for (let i = 0; i < 16; i += 1) {
    out += cssEps(multipliers[i] * matrix.elements[i]) + (i !== 15 ? ',' : ')')
  }
  return prepend + out
}

const CAM_CSS_MUL = [1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1]

export function isIOSWebKit() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iP(hone|od|ad)/.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

function evenPx(n) {
  const v = Math.round(n)
  return v - (v % 2)
}

export function applyCss3dCamera(root, camera, size, _canvas, camEl) {
  const width = evenPx(size.width)
  const height = evenPx(size.height)
  const widthHalf = width / 2
  const heightHalf = height / 2
  const fov = camera.projectionMatrix.elements[5] * heightHalf
  const perspective = `${fov}px`
  const origin = isIOSWebKit() ? `${widthHalf}px ${heightHalf}px` : '50% 50%'

  // Same box as last frame: do not touch layout. Writing width every frame
  // while the camera is parked makes the canvas ResizeObserver fire.
  if (css3dBoxChanged(root.style, width, height, perspective, origin)) {
    root.style.width = `${width}px`
    root.style.height = `${height}px`
    root.style.perspective = perspective
    root.style.position = 'absolute'
    root.style.top = '0px'
    root.style.left = '0px'
    root.style.right = 'auto'
    root.style.bottom = 'auto'
    root.style.perspectiveOrigin = origin
    if (isIOSWebKit() && camEl) {
      // WebKit resolves % origins against the Safari viewport, not this node.
      // Pixel lengths stay element-local — same space as translate(widthHalf, heightHalf).
      // Do NOT add getBoundingClientRect() here: that mixes viewport Y into element
      // space and empties the frustum (blank screens). Do NOT use origin 0 0.
      // Default OverlayCam is still 50% 50% → viewport center on iOS → HTML too low
      // even after perspective-origin is fixed. Pin cam pivot in the same element space.
      camEl.style.transformOrigin = origin
    }
    // Chrome: leave OverlayCam at default 50% 50% (element-local). Do not write it.
  }

  return `translateZ(${fov}px)${cssMatrix3d(camera.matrixWorldInverse, CAM_CSS_MUL)}translate(${widthHalf}px,${heightHalf}px)`
}

export function objectCssMatrix(matrix, factor, panelW, panelH) {
  const f = factor
  // Pixel origin — iOS treats translate(-50%,-50%) as a % of the viewport in 3D,
  // which slides the kiosk HTML down the white cabinet.
  return cssMatrix3d(
    matrix,
    [1 / f, 1 / f, 1 / f, 1, -1 / f, -1 / f, -1 / f, -1, 1 / f, 1 / f, 1 / f, 1, 1, 1, 1, 1],
    `translate(${-panelW / 2}px,${-panelH / 2}px)`,
  )
}

function roundedRectShape(w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  const x = -w / 2
  const y = -h / 2
  const s = new THREE.Shape()
  s.moveTo(x + rad, y)
  s.lineTo(x + w - rad, y)
  s.quadraticCurveTo(x + w, y, x + w, y + rad)
  s.lineTo(x + w, y + h - rad)
  s.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  s.lineTo(x + rad, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - rad)
  s.lineTo(x, y + rad)
  s.quadraticCurveTo(x, y, x + rad, y)
  return s
}

/** Clockwise hole so the cabinet is a frame, not a solid slab. */
function roundedRectHole(w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  const x = -w / 2
  const y = -h / 2
  const p = new THREE.Path()
  p.moveTo(x + rad, y)
  p.quadraticCurveTo(x, y, x, y + rad)
  p.lineTo(x, y + h - rad)
  p.quadraticCurveTo(x, y + h, x + rad, y + h)
  p.lineTo(x + w - rad, y + h)
  p.quadraticCurveTo(x + w, y + h, x + w, y + h - rad)
  p.lineTo(x + w, y + rad)
  p.quadraticCurveTo(x + w, y, x + w - rad, y)
  p.lineTo(x + rad, y)
  return p
}

export function makeRoundedBoxGeometry(w, h, d, r, holeW, holeH, holeR) {
  const outer = roundedRectShape(w, h, r)
  if (holeW && holeH) {
    outer.holes.push(roundedRectHole(holeW, holeH, holeR ?? r))
  }
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: 12,
  })
  geo.translate(0, 0, -d / 2)
  geo.computeVertexNormals()
  return geo
}

export function makeRoundedPlaneGeometry(w, h, r) {
  return new THREE.ShapeGeometry(roundedRectShape(w, h, r), 12)
}
