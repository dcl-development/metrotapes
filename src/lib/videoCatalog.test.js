import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { loadVideoCatalog, resetVideoCatalogForTests, youtubeThumb } from './videoCatalog.js'

describe('youtubeThumb', () => {
  it('uses hqdefault, which exists when maxres does not', () => {
    const url = youtubeThumb('HrYCYJVQ4Vw')
    assert.match(url, /\/hqdefault\.jpg$/)
    assert.equal(url.includes('maxresdefault'), false)
  })

  it('drops an empty id instead of requesting a bad URL', () => {
    assert.equal(youtubeThumb(''), '')
    assert.equal(youtubeThumb(null), '')
  })
})

describe('loadVideoCatalog', () => {
  it('fetches /api/videos once for overlapping callers', async () => {
    resetVideoCatalogForTests()
    let calls = 0
    const original = globalThis.fetch
    globalThis.fetch = async () => {
      calls += 1
      return new Response(JSON.stringify({
        videos: [{ videoId: 'HrYCYJVQ4Vw', title: 'Clip' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    try {
      const [a, b] = await Promise.all([loadVideoCatalog(), loadVideoCatalog()])
      assert.equal(calls, 1)
      assert.equal(a.status, 'ready')
      assert.equal(a, b)
      assert.equal(a.data[0].videoId, 'HrYCYJVQ4Vw')
    } finally {
      globalThis.fetch = original
      resetVideoCatalogForTests()
    }
  })
})
