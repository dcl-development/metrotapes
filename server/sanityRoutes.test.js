import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resetContentGuard } from './contentGuard.js'
import { readSanityConfig } from './sanityClient.js'
import { ABOUT_QUERY, PHOTOS_QUERY, POSTS_QUERY, loadAbout, loadPhotos, loadPosts } from './sanityContent.js'
import { CONTENT_CACHE_CONTROL, runContentRequest } from './sanityRoutes.js'

const photo = { asset: { _ref: 'image-abc-10x10-jpg' }, alt: 'Platform' }

describe('readSanityConfig', () => {
  it('falls back to the production project', () => {
    assert.deepEqual(readSanityConfig({}), {
      projectId: 'l3itmzli',
      dataset: 'production',
      apiVersion: '2024-01-30',
    })
  })

  it('reads the server-only SANITY_* names', () => {
    const config = readSanityConfig({
      SANITY_PROJECT_ID: 'serverid',
      SANITY_DATASET: 'staging',
    })
    assert.equal(config.projectId, 'serverid')
    assert.equal(config.dataset, 'staging')
  })

  it('ignores VITE_* names', () => {
    const config = readSanityConfig({
      VITE_SANITY_PROJECT_ID: 'viteid',
      VITE_SANITY_DATASET: 'preview',
    })
    assert.equal(config.projectId, 'l3itmzli')
    assert.equal(config.dataset, 'production')
  })
})

describe('content loaders', () => {
  it('keeps the queries the pages used to send from the browser', () => {
    assert.match(PHOTOS_QUERY, /\*\[_type == "photos"\]\[0\]\.images\[\]/)
    assert.match(PHOTOS_QUERY, /"width": asset->metadata\.dimensions\.width/)
    assert.match(PHOTOS_QUERY, /"height": asset->metadata\.dimensions\.height/)
    assert.match(ABOUT_QUERY, /photo1\{[^}]*"alt": coalesce\(alt, asset->altText\)/)
    assert.match(ABOUT_QUERY, /"width": asset->metadata\.dimensions\.width/)
    assert.match(POSTS_QUERY, /\*\[_type == "post"\] \| order\(publishedAt desc\)/)
    assert.match(POSTS_QUERY, /instagramPost/)
  })

  it('returns photo and post arrays, and a null about doc', async () => {
    const fetchQuery = async (_config, query) => {
      if (query === PHOTOS_QUERY) return null
      if (query === ABOUT_QUERY) return null
      if (query === POSTS_QUERY) return [{ title: 'Note' }]
      throw new Error(`unexpected query ${query}`)
    }
    const config = { projectId: 'l3itmzli', dataset: 'production' }
    assert.deepEqual(await loadPhotos(config, { fetchQuery }), { status: 200, body: { photos: [] } })
    assert.deepEqual(await loadAbout(config, { fetchQuery }), { status: 200, body: { about: null } })
    assert.deepEqual(await loadPosts(config, { fetchQuery }), {
      status: 200,
      body: { posts: [{ title: 'Note' }] },
    })
  })

  it('passes a photo document through unchanged', async () => {
    const fetchQuery = async () => [photo]
    const result = await loadPhotos({ projectId: 'p', dataset: 'd' }, { fetchQuery })
    assert.deepEqual(result.body.photos, [photo])
  })
})

describe('content routes', () => {
  const ok = async () => ({ status: 200, body: { photos: [photo] } })

  it('caches a successful read and ignores a query string', async () => {
    resetContentGuard()
    const result = await runContentRequest(
      { method: 'GET', url: '/api/photos?query=*[]' },
      ok,
      'photos',
    )
    assert.equal(result.status, 200)
    assert.equal(result.headers['Cache-Control'], CONTENT_CACHE_CONTROL)
    assert.equal(result.headers['Access-Control-Allow-Origin'], undefined)
    assert.deepEqual(result.body.photos, [photo])
    assert.equal(result.body.query, undefined)
  })

  it('rejects methods other than GET', async () => {
    resetContentGuard()
    const result = await runContentRequest(
      { method: 'POST', url: '/api/about' },
      ok,
      'about',
    )
    assert.equal(result.status, 405)
    assert.equal(result.headers.Allow, 'GET')
    assert.equal(result.headers['Cache-Control'], undefined)
  })

  it('does not cache a failed read', async () => {
    resetContentGuard()
    const result = await runContentRequest(
      { method: 'GET', url: '/api/posts' },
      async () => {
        throw new Error('sanity down')
      },
      'posts',
    )
    assert.equal(result.status, 500)
    assert.equal(result.headers['Cache-Control'], undefined)
    assert.match(result.body.detail, /sanity down/)
  })

  it('rate limits one address', async () => {
    resetContentGuard()
    const req = {
      method: 'GET',
      url: '/api/photos',
      headers: { 'x-forwarded-for': '203.0.113.9' },
    }
    for (let i = 0; i < 40; i += 1) {
      const result = await runContentRequest(req, ok, 'photos')
      assert.equal(result.status, 200)
    }
    const blocked = await runContentRequest(req, ok, 'about')
    assert.equal(blocked.status, 429)
    assert.equal(blocked.headers['Retry-After'], '60')
    assert.equal(blocked.headers['Cache-Control'], undefined)
  })
})
