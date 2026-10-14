/**
 * Hover pose for the discarded MetroCard.
 * A fine pointer lifts it into a slow bob. Reduced motion stays on the floor
 * and only brings up the glow.
 */
export function floorCardHoverPose({ hover, time, reduced }) {
  const h = hover > 0 ? Math.min(hover, 1) : 0
  if (h === 0) return { lift: 0, glow: 0 }
  if (reduced) return { lift: 0, glow: h }
  const bob = Math.sin(time * 1.7) * 0.011 * h
  return { lift: 0.046 * h + bob, glow: h }
}

/** Ease the hover amount. Snaps when it arrives so a settled card stops redrawing. */
export function stepHoverAmount(current, goal, dt) {
  const step = Math.min(Math.max(dt, 0), 0.05)
  const next = current + (goal - current) * (1 - Math.exp(-step * 2.4))
  if (Math.abs(next - goal) < 0.001) return goal
  return next
}

/** Home reloads in place. Any other route loads `/`, which plays the intro fresh. */
export function replayIntroLocation(pathname) {
  return pathname === '/' ? 'reload' : 'home'
}
