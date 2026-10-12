import assert from 'node:assert/strict'
import test from 'node:test'
import { pageMount, stationEnabled } from './pageMount.js'

test('2D mode renders every route in the document', () => {
  for (const pathname of ['/', '/photo', '/video', '/about', '/blog']) {
    assert.equal(pageMount({ station: false, pathname }), 'document')
  }
})

test('3D home hides the flat page and walls live in the station', () => {
  assert.equal(pageMount({ station: true, pathname: '/' }), 'hidden')
  assert.equal(pageMount({ station: true, pathname: '/photo' }), 'station')
  assert.equal(pageMount({ station: true, pathname: '/video' }), 'station')
  assert.equal(pageMount({ station: true, pathname: '/about' }), 'station')
  assert.equal(pageMount({ station: true, pathname: '/blog' }), 'document')
})

test('the station runs with WebGL and a live context', () => {
  assert.equal(stationEnabled({ webgl: true, contextLost: false }), true)
  assert.equal(stationEnabled({ webgl: false, contextLost: false }), false)
  assert.equal(stationEnabled({ webgl: true, contextLost: true }), false)
})
