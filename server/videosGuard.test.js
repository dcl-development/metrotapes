import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { allowVideosRequest, resetVideosGuard } from './videosGuard.js'

describe('allowVideosRequest', () => {
  it('allows a normal GET', () => {
    resetVideosGuard()
    assert.deepEqual(allowVideosRequest({ method: 'GET', url: '/api/videos' }), { ok: true })
  })

  it('rejects other methods', () => {
    resetVideosGuard()
    const result = allowVideosRequest({ method: 'POST', url: '/api/videos' })
    assert.equal(result.ok, false)
    assert.equal(result.status, 405)
  })

  it('rejects an oversized URL', () => {
    resetVideosGuard()
    const result = allowVideosRequest({ method: 'GET', url: `/${'a'.repeat(600)}` })
    assert.equal(result.status, 400)
  })

  it('rate limits one address after 40 requests in the window', () => {
    resetVideosGuard()
    const req = {
      method: 'GET',
      url: '/api/videos',
      headers: { 'x-forwarded-for': '203.0.113.8, 10.0.0.1' },
    }
    for (let i = 0; i < 40; i += 1) {
      assert.equal(allowVideosRequest(req).ok, true)
    }
    const blocked = allowVideosRequest(req)
    assert.equal(blocked.status, 429)
  })
})
