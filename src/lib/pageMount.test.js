import assert from 'node:assert/strict'
import test from 'node:test'
import { pageMount, stationEnabled } from './pageMount.js'

test('2D mode renders every route in the document', () => {
  for (const pathname of ['/', '/photo', '/video', '/about', '/blog']) {
    assert.equal(pageMount({ station: false, pathname, slotReady: false }), 'document')
  }
})

test('3D home hides the flat page and walls wait for a single slot', () => {
  assert.equal(pageMount({ station: true, pathname: '/', slotReady: false }), 'hidden')
  assert.equal(pageMount({ station: true, pathname: '/photo', slotReady: false }), 'wait')
  assert.equal(pageMount({ station: true, pathname: '/photo', slotReady: true }), 'portal')
  assert.equal(pageMount({ station: true, pathname: '/blog', slotReady: true }), 'document')
})

test('the station is full mode with WebGL and a live context', () => {
  assert.equal(stationEnabled({ webgl: true, mode: 'full', contextLost: false }), true)
  assert.equal(stationEnabled({ webgl: true, mode: 'lite', contextLost: false }), false)
  assert.equal(stationEnabled({ webgl: false, mode: 'full', contextLost: false }), false)
  assert.equal(stationEnabled({ webgl: true, mode: 'full', contextLost: true }), false)
})
