/**
 * Same GET guard as /api/videos, with its own counter, for the Sanity
 * content routes. Queries are fixed on the server; the request has no
 * user-supplied GROQ to validate.
 */

import { createPublicGetGuard } from './publicGet.js'

const guard = createPublicGetGuard()

export function resetContentGuard() {
  guard.reset()
}

export function allowContentRequest(req) {
  return guard.allow(req)
}
