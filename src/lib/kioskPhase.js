/**
 * Kiosk screen phases: closed (MTA plate) → opening → open → closing → closed.
 *
 * The plate and the menu share one state. A click has to land on a single
 * outcome: menu stays up, or we leave for a wall route. The bug we are
 * closing is a one-frame gap: closing finishes, zap becomes "closed" while
 * the route is still "/", and the open effect turns the menu back on.
 * Then the route commits and the plate slams shut. It looks like a flash
 * of menu and then a stuck MTA logo.
 */

/**
 * @param {object} input
 * @param {string} input.pov
 * @param {string} input.zoom
 * @param {string} input.zap
 * @param {boolean} input.live
 * @param {boolean} input.arrived
 * @param {boolean} input.dimmed
 * @param {boolean} input.reduced
 * @param {boolean} input.suppress  true while a leave-navigation is in flight
 * @returns {false|'open'|'opening'}
 */
export function shouldOpenKiosk({
  pov,
  zoom,
  zap,
  live,
  arrived,
  dimmed,
  reduced,
  suppress,
}) {
  if (pov !== 'kiosk' || zoom !== 'close') return false
  if (zap !== 'closed') return false
  // Intro keeps the LCD on so the fly-in is not a black plate.
  if (dimmed) return 'open'
  if (suppress) return false
  if (live && arrived) return reduced ? 'open' : 'opening'
  return false
}

/**
 * @param {{ phase: string, pending: string|null }} input
 * @returns {{
 *   ignore: boolean,
 *   zap: string|null,
 *   navigateTo: string|null,
 *   suppress: boolean,
 *   clearPending: boolean,
 * }}
 */
export function completeZapPhase({ phase, pending }) {
  if (phase === 'opening') {
    return {
      ignore: false,
      zap: 'open',
      navigateTo: null,
      suppress: false,
      clearPending: false,
    }
  }
  if (phase === 'closing') {
    const to = pending || null
    return {
      ignore: false,
      zap: 'closed',
      navigateTo: to,
      // Hold the plate shut until the route actually changes, so the
      // open effect cannot replay the menu on the in-between frame.
      suppress: Boolean(to),
      clearPending: true,
    }
  }
  return {
    ignore: true,
    zap: null,
    navigateTo: null,
    suppress: false,
    clearPending: false,
  }
}
