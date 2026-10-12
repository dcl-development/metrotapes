import { primeMtaPlate } from './mtaPlate'

let preloadPromise = null

/** Resolves when preloadStationAssets has finished (or immediately if already done). */
export function whenStationPreloaded() {
  return preloadPromise || Promise.resolve('done')
}

/**
 * The canvas fetches its own textures. This only warms the MTA plate so the
 * kiosk texture and the zap screen share one read. Wall boards mount with
 * the station and load their own media.
 */
export function preloadStationAssets() {
  if (!preloadPromise) {
    preloadPromise = primeMtaPlate().then(() => 'done').catch(() => 'done')
  }
  return preloadPromise
}
