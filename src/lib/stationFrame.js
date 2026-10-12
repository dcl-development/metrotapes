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

/** Photo strip timer. It only runs while the gallery is the page in front of you. */
export function photoAutoplayAllowed(pathname, hidden) {
  if (hidden) return false
  return pathname === '/photo'
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
