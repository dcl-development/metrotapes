import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { withTimeout } from './bootGate.js'

describe('withTimeout', () => {
  it('finishes when the work resolves', async () => {
    assert.equal(await withTimeout(Promise.resolve('ok'), 50), 'done')
  })

  it('finishes when the work rejects', async () => {
    assert.equal(await withTimeout(Promise.reject(new Error('nope')), 50), 'done')
  })

  it('does not wait forever when the work never settles', async () => {
    assert.equal(await withTimeout(new Promise(() => {}), 30), 'timeout')
  })
})
