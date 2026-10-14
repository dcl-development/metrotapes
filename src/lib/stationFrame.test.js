import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  composerBufferStale,
  css3dBoxChanged,
  fitFrame,
  nextPhotoIndex,
  panCornerZones,
  panCornerZoom,
  photoAutoplayAllowed,
  photoAutoplayGesture,
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

describe('photoAutoplayGesture', () => {
  it('ignores the pointer resting on the page', () => {
    assert.equal(photoAutoplayGesture('pointerenter'), 'none')
    assert.equal(photoAutoplayGesture('pointerleave'), 'none')
    assert.equal(photoAutoplayGesture('pointermove'), 'none')
  })

  it('pauses on a press and resumes after the release', () => {
    assert.equal(photoAutoplayGesture('pointerdown'), 'pause')
    assert.equal(photoAutoplayGesture('pointerup'), 'resume')
    assert.equal(photoAutoplayGesture('pointercancel'), 'resume')
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

describe('panCornerZones', () => {
  it('keeps both corners on the straight-on kiosk', () => {
    assert.deepEqual(panCornerZones({ pov: 'kiosk', kioskZoom: 'close' }), ['left', 'right'])
  })

  it('keeps the return corner on a full pan', () => {
    assert.deepEqual(panCornerZones({ pov: 'kiosk', kioskZoom: 'left' }), ['right'])
    assert.deepEqual(panCornerZones({ pov: 'kiosk', kioskZoom: 'right' }), ['left'])
    assert.deepEqual(panCornerZones({ pov: 'kiosk', kioskZoom: 'wide' }), ['left'])
  })

  it('stays off the intro and a wall page', () => {
    assert.deepEqual(panCornerZones({ dimmed: true, pov: 'kiosk' }), [])
    assert.deepEqual(panCornerZones({ pageView: true, pov: 'photo', kioskZoom: 'close' }), [])
  })

  it('still offers both corners while a wall shot is in the air', () => {
    assert.deepEqual(panCornerZones({ pov: 'photo', pageView: false }), ['left', 'right'])
  })
})

describe('panCornerZoom', () => {
  it('matches the pan arrows', () => {
    assert.equal(panCornerZoom('close', 'left'), 'left')
    assert.equal(panCornerZoom('close', 'right'), 'right')
    assert.equal(panCornerZoom('left', 'right'), 'right')
    assert.equal(panCornerZoom('right', 'left'), 'left')
  })
})

describe('nextPhotoIndex', () => {
  it('steps along the strip and wraps to the first frame', () => {
    assert.equal(nextPhotoIndex(0, [0, 1, 2]), 1)
    assert.equal(nextPhotoIndex(2, [0, 1, 2]), 0)
  })

  it('restarts at the first strip frame when the current photo is not on it', () => {
    assert.equal(nextPhotoIndex(20, [0, 1, 2]), 0)
    assert.equal(nextPhotoIndex(0, []), 0)
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
