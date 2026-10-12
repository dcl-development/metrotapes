import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { frameloopFor, idlePumpMs } from './renderLoop.js'

describe('frameloopFor', () => {
  it('renders every frame during a flight or a gesture', () => {
    assert.equal(frameloopFor({ moving: true }), 'always')
    assert.equal(frameloopFor({ interacting: true }), 'always')
  })

  it('stops when the shot is a wall page or the tab is hidden', () => {
    assert.equal(frameloopFor({ pageView: true, moving: true }), 'never')
    assert.equal(frameloopFor({ hidden: true }), 'never')
  })

  it('does not spin at full rate once the kiosk is parked', () => {
    assert.equal(frameloopFor({}), 'demand')
  })
})

describe('idlePumpMs', () => {
  it('keeps idle motion moving without a second clock during a flight', () => {
    assert.equal(idlePumpMs({ idleMotion: true }), 34)
    assert.equal(idlePumpMs({ extras: true, moving: true }), 0)
  })

  it('stays off on the low tier and when motion is reduced', () => {
    assert.equal(idlePumpMs({ idleMotion: false, extras: false }), 0)
    assert.equal(idlePumpMs({ extras: true, reducedMotion: true }), 0)
    assert.equal(idlePumpMs({ extras: true, pageView: true }), 0)
  })
})
