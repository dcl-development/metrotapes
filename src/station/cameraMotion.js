/** Kiosk left/right and the return to the close-up. Short enough to feel
 * like one move, long enough that the station doesn't whip. */
export const KIOSK_PAN_SEC = 0.75

/** One hitch may cost this much flight time. A larger step would skip
 * ahead and read as a jerk; the clock still ends on the goal. */
export const FLIGHT_STEP_CAP = 0.125

export function smootherstep(t) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/**
 * Advance a flight in [0, 1] from frame time. Completion is the clock
 * hitting 1, not a distance threshold — an exponential lerp never
 * arrives and the last snap is the jerk at the end of the side shots.
 */
export function stepFlight(t, dt, duration) {
  const step = Math.min(Math.max(Number(dt) || 0, 0), FLIGHT_STEP_CAP)
  const dur = duration > 0 ? duration : KIOSK_PAN_SEC
  return Math.min(1, (Number(t) || 0) + step / dur)
}
