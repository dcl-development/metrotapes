import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { imageUrl, photoSources, stripThumb } from './sanityImage.js'

const photo = {
  width: 1296,
  height: 1620,
  asset: { _ref: 'image-d969a63e1f773d4ee8df2049c068c862037e0077-1296x1620-jpg' },
}

describe('imageUrl', () => {
  it('asks Sanity for a modern format at the requested width', () => {
    const url = imageUrl(photo, { width: 960 })
    assert.match(url, /auto=format/)
    assert.match(url, /w=960/)
    assert.match(url, /q=72/)
    assert.equal(url.includes('w=1200'), false)
    assert.equal(url.includes('w=1600'), false)
  })

  it('returns an empty string when there is no asset', () => {
    assert.equal(imageUrl(null), '')
    assert.equal(imageUrl({}), '')
  })
})

describe('photoSources', () => {
  it('does not ask for a width larger than the file', () => {
    const sources = photoSources(photo)
    assert.match(sources.src, /w=960/)
    assert.equal(sources.srcSet.includes('1600w'), false)
    assert.match(sources.srcSet, /640w/)
    assert.match(sources.srcSet, /1280w/)
    assert.equal(sources.width, 1296)
    assert.equal(sources.height, 1620)
  })
})

describe('stripThumb', () => {
  it('crops a small thumb instead of the full photo', () => {
    const thumb = stripThumb(photo)
    assert.match(thumb.src, /w=240/)
    assert.match(thumb.src, /h=180/)
    assert.match(thumb.src, /fit=crop/)
    assert.equal(thumb.width, 240)
    assert.equal(thumb.height, 180)
  })
})
