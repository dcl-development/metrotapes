export const PRESENTATION_KEY = 'metrotapes-quality'

export function readPresentation(storage) {
  try {
    const store = storage || globalThis.localStorage
    const value = store?.getItem(PRESENTATION_KEY)
    if (value === 'lite' || value === 'full') return value
  } catch {
    /* private mode */
  }
  return 'full'
}

export function writePresentation(mode, storage) {
  const next = mode === 'lite' ? 'lite' : 'full'
  try {
    const store = storage || globalThis.localStorage
    store?.setItem(PRESENTATION_KEY, next)
  } catch {
    /* private mode */
  }
  return next
}
