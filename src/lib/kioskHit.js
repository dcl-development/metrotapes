/**
 * CSS 3D overlays often paint the kiosk buttons where the hit target is not.
 * Pick the destination whose transformed box actually contains the point.
 * The smallest box wins so a parent panel does not steal a button.
 */
export function pickKioskDestination(x, y, boxes) {
  let best = null
  let bestArea = Infinity
  for (const box of boxes) {
    if (!box?.to) continue
    const left = Number(box.left)
    const top = Number(box.top)
    const right = Number(box.right)
    const bottom = Number(box.bottom)
    if (![left, top, right, bottom].every(Number.isFinite)) continue
    if (x < left || x > right || y < top || y > bottom) continue
    const area = Math.max(0, right - left) * Math.max(0, bottom - top)
    if (area < bestArea) {
      best = box.to
      bestArea = area
    }
  }
  return best
}
