import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { stepLineBullet } from './lineBounce.js'

const box = { width: 220, height: 160, size: 15 }

describe('stepLineBullet', () => {
  it('walks a bullet at the given speed inside a real LCD', () => {
    const next = stepLineBullet({ x: 40, y: 20, vx: 1, vy: 0.5 }, box, 1.05)
    assert.equal(next.x, 40 + 1.05)
    assert.ok(Math.abs(next.y - (20 + 0.5 * 1.05)) < 1e-9)
    assert.equal(next.vx, 1)
    assert.equal(next.vy, 0.5)
  })

  it('bounces off the far edge and keeps most of its speed', () => {
    const next = stepLineBullet({ x: 204, y: 40, vx: 2, vy: 0.2 }, box, 1.05)
    assert.equal(next.x, box.width - box.size)
    assert.ok(next.vx < 0)
    assert.ok(Math.abs(next.vx) > 1.5)
  })

  it('does not collapse velocity when the screen has not been laid out', () => {
    const start = { x: 30, y: 12, vx: 0.8, vy: -0.4 }
    let bullet = start
    for (let i = 0; i < 180; i += 1) {
      bullet = stepLineBullet(bullet, { width: 0, height: 0, size: 15 }, 1.05)
    }
    assert.equal(bullet.x, start.x)
    assert.equal(bullet.y, start.y)
    assert.equal(bullet.vx, start.vx)
    assert.equal(bullet.vy, start.vy)
  })
})
