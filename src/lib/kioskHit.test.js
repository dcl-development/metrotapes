import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pickKioskDestination } from './kioskHit.js'

const boxes = [
  { to: '/photo', left: 100, top: 400, right: 300, bottom: 460 },
  { to: '/video', left: 100, top: 470, right: 300, bottom: 530 },
  { to: '/about', left: 100, top: 540, right: 300, bottom: 600 },
]

describe('pickKioskDestination', () => {
  it('returns the button under the pointer', () => {
    assert.equal(pickKioskDestination(180, 500, boxes), '/video')
  })

  it('ignores clicks outside the menu', () => {
    assert.equal(pickKioskDestination(20, 20, boxes), null)
  })

  it('prefers the smaller box when two overlap', () => {
    const nested = [
      { to: '/video', left: 0, top: 0, right: 400, bottom: 800 },
      { to: '/photo', left: 40, top: 500, right: 200, bottom: 560 },
    ]
    assert.equal(pickKioskDestination(80, 520, nested), '/photo')
  })
})
