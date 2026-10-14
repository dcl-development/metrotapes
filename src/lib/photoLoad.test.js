import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mountPhotoStrip, showFullPhoto } from './photoLoad.js'
import { filmThumb, framePhotoUrl, framePhotoWidth, photoSources } from './sanityImage.js'

const photo = {
  width: 1296,
  height: 1620,
  asset: { _ref: 'image-d969a63e1f773d4ee8df2049c068c862037e0077-1296x1620-jpg' },
}

describe('showFullPhoto', () => {
  it('keeps the home wall on thumbnails', () => {
    assert.equal(showFullPhoto({ pathname: '/' }), false)
    assert.equal(showFullPhoto({ pathname: '/about' }), false)
  })

  it('loads the large still once the route is the photos page', () => {
    assert.equal(showFullPhoto({ pathname: '/photo' }), true)
  })
})

describe('mountPhotoStrip', () => {
  it('waits until the camera has arrived on the wall', () => {
    assert.equal(mountPhotoStrip({ active: false }), false)
    assert.equal(mountPhotoStrip({ active: true }), true)
    assert.equal(mountPhotoStrip({}), false)
  })
})

describe('framePhotoWidth', () => {
  it('stays inside 640–1200', () => {
    assert.equal(framePhotoWidth(390, 2), 960)
    assert.equal(framePhotoWidth(400, 1), 640)
    assert.equal(framePhotoWidth(1440, 2), 1200)
    assert.equal(framePhotoWidth(800, 1), 960)
  })
})

describe('framePhotoUrl', () => {
  it('never asks Sanity for more than 1200', () => {
    const wide = { ...photo, width: 4000, height: 3000 }
    const url = framePhotoUrl(wide, 2000)
    assert.match(url, /w=1200/)
    assert.match(url, /auto=format/)
    assert.equal(url.includes('w=1600'), false)
    assert.equal(url.includes('w=2000'), false)
  })

  it('does not upscale past the file', () => {
    const small = { ...photo, width: 800, height: 600 }
    assert.match(framePhotoUrl(small, 1200), /w=800/)
  })
})

describe('filmThumb', () => {
  it('is a small modern file, not the frame size', () => {
    const url = filmThumb(photo)
    assert.match(url, /w=320/)
    assert.match(url, /q=60/)
    assert.match(url, /auto=format/)
    assert.equal(url.includes('w=960'), false)
    assert.equal(url.includes('w=1200'), false)
  })
})

describe('photoSources cap', () => {
  it('drops the old 1280 and 1600 candidates', () => {
    const sources = photoSources({ ...photo, width: 4000, height: 2600 })
    assert.match(sources.srcSet, /1200w/)
    assert.equal(sources.srcSet.includes('1280w'), false)
    assert.equal(sources.srcSet.includes('1600w'), false)
  })
})
