/**
 * Frame-stability rules for the station canvas.
 * The scene itself is not imported here so node tests can cover the decisions.
 */

/** Grain and the CA fringe blend over the live canvas. The context must keep a finished frame or the compositor samples a torn buffer (often the lower tiles). Set only at context creation. */
export function preserveDrawingBuffer(settings) {
  return Boolean(settings && (settings.grain || settings.ca))
}

/**
 * True when the CSS-3D stage box does not already match the canvas.
 * Rewriting the same width / perspective every frame dirties layout and
 * makes ResizeObserver reallocate the drawing buffer.
 */
export function css3dBoxChanged(style, width, height, perspective, origin) {
  if (!style) return true
  return style.width !== `${width}px`
    || style.height !== `${height}px`
    || style.perspective !== perspective
    || style.perspectiveOrigin !== origin
}

/**
 * Hover does not pause the strip. The gallery fills the viewport, so the
 * pointer is over it the whole time you are looking. Only a press or drag holds.
 */
export function photoAutoplayGesture(type) {
  if (type === 'pointerdown') return 'pause'
  if (type === 'pointerup' || type === 'pointercancel') return 'resume'
  return 'none'
}

/** Photo strip timer. It only runs while the gallery is the page in front of you. */
export function photoAutoplayAllowed(pathname, hidden) {
  if (hidden) return false
  return pathname === '/photo'
}

/**
 * Invisible bottom-corner pan targets.
 * Home keeps both corners. A full left pan (the poster boards) keeps the
 * right corner, and a full right pan (the train) keeps the left corner.
 * The intro and a wall page get none, so those clicks stay on the page.
 */
export function panCornerZones({
  dimmed = false,
  pageView = false,
  pov = 'kiosk',
  kioskZoom = 'close',
} = {}) {
  if (dimmed || pageView) return []
  if (pov === 'kiosk' && kioskZoom === 'left') return ['right']
  if (pov === 'kiosk' && (kioskZoom === 'right' || kioskZoom === 'wide')) return ['left']
  return ['left', 'right']
}

/**
 * Zoom a corner tap applies. Home corners look that way. On a panned
 * shot the remaining corner takes the same destination as the pan arrow
 * on that side (left's right arrow goes right, right's left arrow goes left).
 */
export function panCornerZoom(kioskZoom, side) {
  if (kioskZoom === 'left' && side === 'right') return 'right'
  if ((kioskZoom === 'right' || kioskZoom === 'wide') && side === 'left') return 'left'
  return side
}

/** Next featured photo, walking the strip so the yellow frame can follow. */
export function nextPhotoIndex(current, indexes) {
  if (!indexes || indexes.length === 0) return 0
  const pos = indexes.indexOf(current)
  const step = pos < 0 ? 0 : pos + 1
  return indexes[step % indexes.length]
}

/**
 * Largest frame of `frameAspect` (width / height) that fits a stage.
 * Used so a wide photo does not paint past the tablet viewport.
 */
export function fitFrame(boxW, boxH, frameAspect) {
  const aspect = Number.isFinite(frameAspect) && frameAspect > 0 ? frameAspect : 1
  const w = Math.max(0, Number(boxW) || 0)
  const h = Math.max(0, Number(boxH) || 0)
  if (w === 0 || h === 0) return { width: 0, height: 0 }
  let width = w
  let height = width / aspect
  if (height > h) {
    height = h
    width = height * aspect
  }
  return { width, height }
}

/**
 * Composer targets follow the drawing buffer, not just CSS pixels.
 * A DPR step keeps CSS size and leaves the bloom targets at the old height.
 */
export function composerBufferStale(bufferWidth, bufferHeight, drawingWidth, drawingHeight) {
  return bufferWidth !== drawingWidth || bufferHeight !== drawingHeight
}
