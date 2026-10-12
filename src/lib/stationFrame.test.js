import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  composerBufferStale,
  css3dBoxChanged,
  fitFrame,
  photoAutoplayAllowed,
  preserveDrawingBuffer,
} from './stationFrame.js'

describe('preserveDrawingBuffer', () => {
  it('keeps the frame when film grain or the CA fringe blend over the canvas', () => {
    assert.equal(preserveDrawingBuffer({ grain: true, ca: false }), true)
    assert.equal(preserveDrawingBuffer({ grain: false, ca: true }), true)
  })

  it('leaves the low tier alone — no grain, no fringe', () => {
    assert.equal(preserveDrawingBuffer({ grain: false, ca: false }), false)
    assert.equal(preserveDrawingBuffer(null), false)
  })
})

describe('css3dBoxChanged', () => {
  const box = {
    width: '800px',
    height: '600px',
    perspective: '700px',
    perspectiveOrigin: '50% 50%',
  }

  it('skips a rewrite when the stage box already matches', () => {
    assert.equal(css3dBoxChanged(box, 800, 600, '700px', '50% 50%'), false)
  })

  it('rewrites when perspective was cleared for a wall page', () => {
    assert.equal(css3dBoxChanged(
      { ...box, perspective: 'none' },
      800,
      600,
      '700px',
      '50% 50%',
    ), true)
  })
})

describe('photoAutoplayAllowed', () => {
  it('runs only while the photo gallery is open', () => {
    assert.equal(photoAutoplayAllowed('/photo', false), true)
  })

  it('does not advance the strip in the background on other routes', () => {
    assert.equal(photoAutoplayAllowed('/', false), false)
    assert.equal(photoAutoplayAllowed('/about', false), false)
    assert.equal(photoAutoplayAllowed('/video', false), false)
    assert.equal(photoAutoplayAllowed('/photo', true), false)
  })
})

describe('fitFrame', () => {
  it('shrinks a wide frame to the stage width', () => {
    const box = fitFrame(700, 800, 2)
    assert.equal(box.width, 700)
    assert.equal(box.height, 350)
  })

  it('shrinks a tall frame to the stage height', () => {
    const box = fitFrame(700, 400, 0.5)
    assert.equal(box.height, 400)
    assert.equal(box.width, 200)
  })
})

describe('composerBufferStale', () => {
  it('is stale when only the drawing-buffer height changed', () => {
    assert.equal(composerBufferStale(1600, 900, 1600, 750), true)
  })

  it('matches when the bloom targets already equal the drawing buffer', () => {
    assert.equal(composerBufferStale(1000, 800, 1000, 800), false)
  })
})
