/** Boot must leave even if a texture or the scene never reports ready. */
export const BOOT_LIMIT_MS = 8000
/** The neon loop always travels once, then stays lit briefly, before the fade. */
export const BOOT_PLAY_MS = 1800
export const BOOT_HOLD_MS = 400
export const BOOT_CEREMONY_MS = BOOT_PLAY_MS + BOOT_HOLD_MS

/**
 * Resolves 'done' when `work` settles, or 'timeout' if it is still pending.
 * A rejection counts as done so a failed preload cannot hold the boot screen.
 */
export function withTimeout(work, ms) {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve('timeout')
    }, ms)
    Promise.resolve(work).then(() => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve('done')
    }, () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve('done')
    })
  })
}
