let preloadPromise = null

/** Resolves when preloadStationAssets has finished (or immediately if already done). */
export function whenStationPreloaded() {
  return preloadPromise || Promise.resolve('done')
}

/**
 * Station textures load through the canvas (TextureLoader caches one request).
 * A second preload raced that loader and downloaded the same files twice.
 * Wall photos, about, and videos load on their own routes through the API.
 * The boot screen waits on the scene, with its own timeout in App.
 */
export function preloadStationAssets() {
  if (!preloadPromise) preloadPromise = Promise.resolve('done')
  return preloadPromise
}
