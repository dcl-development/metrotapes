/**
 * Full rate only while the camera or a gesture is moving.
 * A settled kiosk uses demand so an idle tab is not a 60fps GPU loop.
 * Wall pages and hidden tabs paint nothing.
 */
export function frameloopFor({
  hidden = false,
  pageView = false,
  moving = false,
  interacting = false,
} = {}) {
  if (hidden || pageView) return 'never'
  if (moving || interacting) return 'always'
  return 'demand'
}

/**
 * Idle motion (flicker, rat) still advances, but not at full rate.
 * 0 means the pump stays off: low tier, reduced motion, or a flight
 * that is already rendering every frame.
 */
export function idlePumpMs({
  hidden = false,
  pageView = false,
  moving = false,
  interacting = false,
  reducedMotion = false,
  idleMotion = false,
  extras = false,
} = {}) {
  if (hidden || pageView || moving || interacting || reducedMotion) return 0
  if (idleMotion || extras) return 34
  return 0
}
