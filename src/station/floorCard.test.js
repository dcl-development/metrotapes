import assert from 'node:assert/strict'
import test from 'node:test'
import { floorCardHoverPose, replayIntroLocation, stepHoverAmount } from './floorCard.js'

test('a resting card stays on the floor', () => {
  const pose = floorCardHoverPose({ hover: 0, time: 1.2, reduced: false })
  assert.deepEqual(pose, { lift: 0, glow: 0 })
})

test('hover lifts into a slow bob', () => {
  const peak = floorCardHoverPose({ hover: 1, time: Math.PI / (2 * 1.7), reduced: false })
  assert.ok(peak.lift > 0.05 && peak.lift < 0.07)
  assert.equal(peak.glow, 1)
  const other = floorCardHoverPose({ hover: 1, time: 0, reduced: false })
  assert.notEqual(other.lift, peak.lift)
})

test('reduced motion glows without leaving the floor', () => {
  const pose = floorCardHoverPose({ hover: 1, time: 2, reduced: true })
  assert.equal(pose.lift, 0)
  assert.equal(pose.glow, 1)
})

test('hover eases in and settles back down', () => {
  let hover = 0
  for (let i = 0; i < 400 && hover !== 1; i += 1) hover = stepHoverAmount(hover, 1, 1 / 60)
  assert.equal(hover, 1)
  for (let i = 0; i < 400 && hover !== 0; i += 1) hover = stepHoverAmount(hover, 0, 1 / 60)
  assert.equal(hover, 0)
})

test('replaying the intro reloads home and navigates there from a wall', () => {
  assert.equal(replayIntroLocation('/'), 'reload')
  assert.equal(replayIntroLocation('/photo'), 'home')
  assert.equal(replayIntroLocation('/video'), 'home')
})
