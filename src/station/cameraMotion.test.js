import assert from 'node:assert/strict'
import test from 'node:test'
import { KIOSK_PAN_SEC, smootherstep, stepFlight } from './cameraMotion.js'

test('kiosk side pan is a short ease-in-out that ends on the clock', () => {
  assert.ok(KIOSK_PAN_SEC >= 0.6 && KIOSK_PAN_SEC <= 0.9)
  assert.equal(smootherstep(0), 0)
  assert.equal(smootherstep(1), 1)
  assert.equal(smootherstep(0.5), 0.5)
  assert.ok(smootherstep(0.25) < 0.25)
  assert.ok(smootherstep(0.75) > 0.75)

  const dt = 1 / 60
  let t = 0
  let frames = 0
  while (t < 1 && frames < 180) {
    const prev = t
    t = stepFlight(t, dt, KIOSK_PAN_SEC)
    frames += 1
    if (t < 1) assert.ok(t > prev)
  }
  assert.equal(t, 1)
  assert.equal(frames, Math.round(KIOSK_PAN_SEC / dt))
  // Still short of the goal just before the last frame — no early snap.
  assert.ok(stepFlight(0, KIOSK_PAN_SEC - dt, KIOSK_PAN_SEC) < 1)
})

test('one long frame cannot skip the kiosk pan', () => {
  const jumped = stepFlight(0, 1, KIOSK_PAN_SEC)
  assert.ok(jumped < 0.2)
  assert.ok(jumped > 0)
})
