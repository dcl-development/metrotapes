/**
 * Best-effort guard for GET /api/videos.
 * The playlist id comes from Sanity, not the query string, so the request
 * has nothing to validate except method, size, and how often it is called.
 * The counter lives in module memory: one warm serverless instance shares
 * it, a cold start does not. That is enough to blunt a hot loop without
 * a store, and a normal page load (one or two fetches) stays under it.
 */

import { createPublicGetGuard } from './publicGet.js'

const guard = createPublicGetGuard()

export function resetVideosGuard() {
  guard.reset()
}

export function allowVideosRequest(req) {
  return guard.allow(req)
}
