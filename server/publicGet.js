/**
 * In-memory GET limiter shared by the public read endpoints.
 * One warm serverless instance shares the counter; a cold start does not.
 * Enough to blunt a hot loop. A normal page load stays under it.
 */

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 40

function clientIp(req) {
  const headers = req?.headers || {}
  const fwd = headers['x-forwarded-for'] || headers['X-Forwarded-For']
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim().slice(0, 80)
  if (typeof headers['x-real-ip'] === 'string' && headers['x-real-ip'].trim()) {
    return headers['x-real-ip'].trim().slice(0, 80)
  }
  return req?.socket?.remoteAddress || 'local'
}

export function createPublicGetGuard() {
  const buckets = new Map()

  function prune(now) {
    if (buckets.size < 200) return
    for (const [key, bucket] of buckets) {
      if (now - bucket.start > WINDOW_MS) buckets.delete(key)
    }
  }

  return {
    reset() {
      buckets.clear()
    },
    /**
     * @param {{ method?: string, url?: string, headers?: object, socket?: object }} req
     * @returns {{ ok: true } | { ok: false, status: number, body: { detail: string } }}
     */
    allow(req) {
      const method = req?.method || 'GET'
      if (method !== 'GET') {
        return { ok: false, status: 405, body: { detail: 'Method not allowed' } }
      }

      const url = typeof req?.url === 'string' ? req.url : ''
      if (url.length > 512) {
        return { ok: false, status: 400, body: { detail: 'Bad request' } }
      }

      const now = Date.now()
      const ip = clientIp(req)
      let bucket = buckets.get(ip)
      if (!bucket || now - bucket.start > WINDOW_MS) {
        bucket = { start: now, count: 0 }
        buckets.set(ip, bucket)
      }
      bucket.count += 1
      prune(now)

      if (bucket.count > MAX_PER_WINDOW) {
        return { ok: false, status: 429, body: { detail: 'Too many requests' } }
      }
      return { ok: true }
    },
  }
}
