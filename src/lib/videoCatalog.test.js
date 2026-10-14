import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  kioskPreviewAllowed,
  loadVideoCatalog,
  resetVideoCatalogForTests,
  youtubePreviewEmbed,
  youtubeThumb,
} from './videoCatalog.js'

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

describe('youtubePreviewEmbed', () => {
  it('loops a muted inline low-res preview', () => {
    const url = new URL(youtubePreviewEmbed('HrYCYJVQ4Vw'))
    assert.equal(url.searchParams.get('autoplay'), '1')
    assert.equal(url.searchParams.get('mute'), '1')
    assert.equal(url.searchParams.get('playsinline'), '1')
    assert.equal(url.searchParams.get('loop'), '1')
    assert.equal(url.searchParams.get('playlist'), 'HrYCYJVQ4Vw')
    assert.equal(url.searchParams.get('controls'), '0')
    assert.equal(url.searchParams.get('vq'), 'small')
  })

  it('drops an empty id', () => {
    assert.equal(youtubePreviewEmbed(''), '')
    assert.equal(youtubePreviewEmbed('nope'), '')
  })
})

describe('kioskPreviewAllowed', () => {
  const on = { live: true, hidden: false, reducedMotion: false, tier: 'mid', phone: false }

  it('plays on a live desktop kiosk', () => {
    assert.equal(kioskPreviewAllowed(on), true)
    assert.equal(kioskPreviewAllowed({ ...on, tier: 'high' }), true)
  })

  it('stays on the still when the kiosk, the tab, motion, the tier, or the phone says no', () => {
    assert.equal(kioskPreviewAllowed({ ...on, live: false }), false)
    assert.equal(kioskPreviewAllowed({ ...on, hidden: true }), false)
    assert.equal(kioskPreviewAllowed({ ...on, reducedMotion: true }), false)
    assert.equal(kioskPreviewAllowed({ ...on, tier: 'low' }), false)
    assert.equal(kioskPreviewAllowed({ ...on, phone: true }), false)
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
