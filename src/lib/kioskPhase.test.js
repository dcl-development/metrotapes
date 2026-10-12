import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { completeZapPhase, shouldOpenKiosk } from './kioskPhase.js'

const openBase = {
  pov: 'kiosk',
  zoom: 'close',
  zap: 'closed',
  live: true,
  arrived: true,
  dimmed: false,
  reduced: false,
  suppress: false,
}

describe('shouldOpenKiosk', () => {
  it('opens once the close-up kiosk has arrived', () => {
    assert.equal(shouldOpenKiosk(openBase), 'opening')
  })

  it('snaps open when motion is reduced', () => {
    assert.equal(shouldOpenKiosk({ ...openBase, reduced: true }), 'open')
  })

  it('does not reopen while a leave navigation is in flight', () => {
    assert.equal(shouldOpenKiosk({ ...openBase, suppress: true }), false)
  })

  it('stays shut while the camera is looking aside', () => {
    assert.equal(shouldOpenKiosk({ ...openBase, zoom: 'right' }), false)
  })

  it('does not restart an open or closing screen', () => {
    assert.equal(shouldOpenKiosk({ ...openBase, zap: 'open' }), false)
    assert.equal(shouldOpenKiosk({ ...openBase, zap: 'closing' }), false)
  })

  it('turns the screen on during the intro without waiting to arrive', () => {
    assert.equal(shouldOpenKiosk({
      ...openBase,
      dimmed: true,
      live: false,
      arrived: false,
    }), 'open')
  })
})

describe('completeZapPhase', () => {
  it('finishes opening on the menu', () => {
    assert.deepEqual(completeZapPhase({ phase: 'opening', pending: null }), {
      ignore: false,
      zap: 'open',
      navigateTo: null,
      suppress: false,
      clearPending: false,
    })
  })

  it('leaves for the pending route and holds the plate shut', () => {
    assert.deepEqual(completeZapPhase({ phase: 'closing', pending: '/about' }), {
      ignore: false,
      zap: 'closed',
      navigateTo: '/about',
      suppress: true,
      clearPending: true,
    })
  })

  it('closes without navigating when nothing was pending', () => {
    const result = completeZapPhase({ phase: 'closing', pending: null })
    assert.equal(result.zap, 'closed')
    assert.equal(result.navigateTo, null)
    assert.equal(result.suppress, false)
  })

  it('ignores phases that are not transitions', () => {
    assert.equal(completeZapPhase({ phase: 'open', pending: '/about' }).ignore, true)
  })
})
