import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { primeMtaPlate, resetMtaPlateForTests } from './mtaPlate.js'

test('the MTA plate is fetched once and cached for the texture loader', async () => {
  resetMtaPlateForTests()
  let calls = 0
  const origFetch = globalThis.fetch
  const OrigImage = globalThis.Image
  globalThis.fetch = async () => {
    calls += 1
    return new Response(new Uint8Array([1, 2, 3, 4]), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    })
  }
  globalThis.Image = class {
    set src(value) {
      this.currentSrc = value
      queueMicrotask(() => this.onload?.())
    }
    get complete() { return true }
  }
  try {
    const [a, b] = await Promise.all([primeMtaPlate(), primeMtaPlate()])
    assert.equal(calls, 1)
    assert.equal(a.href, '/mta-logo.jpg')
    assert.equal(a.blobUrl, b.blobUrl)
    assert.ok(String(a.blobUrl).length > 0)
    const cached = THREE.Cache.get('image:/mta-logo.jpg')
    assert.ok(cached)
    assert.equal(cached.complete, true)
  } finally {
    globalThis.fetch = origFetch
    globalThis.Image = OrigImage
    resetMtaPlateForTests()
  }
})
