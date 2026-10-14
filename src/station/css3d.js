import * as THREE from 'three'
import { KIOSK_BEZEL, KIOSK_CAB_H, KIOSK_CAB_W, KIOSK_PANEL_H, KIOSK_PANEL_W, KIOSK_POST_H, KIOSK_SCREEN_H, KIOSK_SCREEN_W } from '../lib/kioskSize.js'
import { css3dBoxChanged } from '../lib/stationFrame.js'

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

/**
 * CSS pixels per world meter, shared by the camera and every screen.
 * The station is in meters, but CSS perspective is in pixels. Unscaled
 * matrices park a screen that is 1.8m away at w ≈ 0.002 — two CSS pixels
 * from the clip plane. Chrome's GPU compositor then culls tiles: the LCD
 * and wall pages flicker, a hard edge cuts the kiosk, and the header
 * vanishes. Software compositing never hits that path.
 * Scaling translation (and the object's pixel size) by this factor keeps
 * the same projected picture and puts w near 1.
 */
export const CSS3D_SCALE = 512
/** Below this, a corner is grazing the clip plane. Drop the layer. */
export const CSS3D_MIN_W = 0.2

export function cameraCssMultipliers(scale = CSS3D_SCALE) {
  return [1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1, scale, -scale, scale, 1]
}

export function objectCssMultipliers(pxPerMeter, scale = CSS3D_SCALE) {
  const s = scale / pxPerMeter
  return [s, s, s, 1, -s, -s, -s, -1, s, s, s, 1, scale, scale, scale, 1]
}

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

  return `translateZ(${fov}px)${cssMatrix3d(camera.matrixWorldInverse, cameraCssMultipliers())}translate(${widthHalf}px,${heightHalf}px)`
}

export function objectCssMatrix(matrix, factor, panelW, panelH) {
  // Pixel origin — iOS treats translate(-50%,-50%) as a % of the viewport in 3D,
  // which slides the kiosk HTML down the white cabinet.
  return cssMatrix3d(
    matrix,
    objectCssMultipliers(factor),
    `translate(${-panelW / 2}px,${-panelH / 2}px)`,
  )
}

const _obj = new THREE.Matrix4()
const _cam = new THREE.Matrix4()
const _objT = new THREE.Matrix4()
const _tz = new THREE.Matrix4()
const _tzCam = new THREE.Matrix4()
const _half = new THREE.Matrix4()
const _camT = new THREE.Matrix4()
const _child = new THREE.Matrix4()
const _persp = new THREE.Matrix4()
const _neg = new THREE.Matrix4()
const _pShift = new THREE.Matrix4()
const _withP = new THREE.Matrix4()
const _root = new THREE.Matrix4()
const _v = new THREE.Vector4()

function applyMul(out, matrix, multipliers) {
  const e = matrix.elements
  const o = out.elements
  for (let i = 0; i < 16; i += 1) o[i] = multipliers[i] * e[i]
  return out
}

/**
 * Project the four corners of a CSS screen the way the DOM does
 * (perspective-origin center, transform-origin center).
 * NDC y is up. Returns null when the inputs can't form a projection.
 */
export function css3dProject(objectMatrix, camera, width, height, pxPerMeter, panelW, panelH) {
  if (!(width > 0) || !(height > 0) || !(pxPerMeter > 0) || !(panelW > 0) || !(panelH > 0)) {
    return null
  }
  const fov = camera.projectionMatrix.elements[5] * (height / 2)
  if (!(fov > 0)) return null

  applyMul(_obj, objectMatrix, objectCssMultipliers(pxPerMeter))
  applyMul(_cam, camera.matrixWorldInverse, cameraCssMultipliers())

  // Transform-origin center cancels the centering translate on the left,
  // leaving the matrix applied around the element's center.
  _objT.multiplyMatrices(_obj, _half.makeTranslation(-panelW / 2, -panelH / 2, 0))
  _tzCam.multiplyMatrices(_tz.makeTranslation(0, 0, fov), _cam)
  _camT.multiplyMatrices(_half.makeTranslation(width / 2, height / 2, 0), _tzCam)
  _child.multiplyMatrices(_camT, _objT)

  _persp.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1 / fov, 1)
  _pShift.multiplyMatrices(_persp, _neg.makeTranslation(-width / 2, -height / 2, 0))
  _withP.multiplyMatrices(_half.makeTranslation(width / 2, height / 2, 0), _pShift)
  _root.multiplyMatrices(_withP, _child)

  const ndc = []
  let minW = Infinity
  let maxW = -Infinity
  const corners = [[0, 0], [panelW, 0], [0, panelH], [panelW, panelH]]
  for (let i = 0; i < corners.length; i += 1) {
    _v.set(corners[i][0], corners[i][1], 0, 1).applyMatrix4(_root)
    const w = _v.w
    if (w < minW) minW = w
    if (w > maxW) maxW = w
    ndc.push({
      x: (_v.x / w / width) * 2 - 1,
      y: -((_v.y / w / height) * 2 - 1),
      w,
    })
  }
  return { minW, maxW, ndc }
}

/**
 * True when this screen can be a composited layer.
 * A corner with w under CSS3D_MIN_W is beside the camera (the photo board
 * from the straight-on kiosk shot). Chrome turns that quad into a page-sized
 * tile cull. Off-screen boards stay display:none so their full-viewport
 * textures are not resident.
 */
export function css3dLayerLive(objectMatrix, camera, size, pxPerMeter, panelW, panelH) {
  const width = size?.width
  const height = size?.height
  const proj = css3dProject(objectMatrix, camera, width, height, pxPerMeter, panelW, panelH)
  if (!proj || proj.minW < CSS3D_MIN_W) return false
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < proj.ndc.length; i += 1) {
    const p = proj.ndc[i]
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const m = 0.12
  return maxX >= -1 - m && minX <= 1 + m && maxY >= -1 - m && minY <= 1 + m
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
