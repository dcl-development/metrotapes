import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GFX,
  classifyGpu,
  decideQualityStep,
  detectGfxTier,
  stepDown,
  stepUp,
} from './gfxDetect.js'

test('low stays light, mid and high paint sharper, and bloom stays high-only', () => {
  assert.equal(GFX.low.mapPx, 256)
  assert.equal(GFX.low.cheapGlow, true)
  assert.equal(GFX.low.bloom, false)
  assert.ok(GFX.mid.mapPx > GFX.low.mapPx)
  assert.equal(GFX.mid.cheapGlow, true)
  assert.equal(GFX.mid.bloom, false)
  assert.ok(GFX.high.mapPx > GFX.mid.mapPx)
  assert.equal(GFX.high.cheapGlow, false)
  assert.equal(GFX.high.bloom, true)
  assert.ok(GFX.high.aniso >= GFX.mid.aniso)
  assert.ok(GFX.mid.aniso > GFX.low.aniso)
})

test('software, reduced motion, and data saver stay low and locked', () => {
  for (const input of [
    { software: true, renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device)' },
    { reduced: true, renderer: 'Apple GPU' },
    { saveData: true, renderer: 'NVIDIA GeForce RTX 3060' },
    { effectiveType: '2g', renderer: 'Apple GPU' },
    { deviceMemory: 2, renderer: 'Apple GPU' },
  ]) {
    const found = detectGfxTier(input)
    assert.equal(found.tier, 'low')
    assert.equal(found.ceiling, 'low')
    assert.equal(found.locked, true)
    assert.equal(found.warmCorrectable, false)
  }
})

test('a phone-class GPU can start at mid without looking at screen width', () => {
  const found = detectGfxTier({
    renderer: 'Adreno (TM) 640',
    maxTextureSize: 4096,
    deviceMemory: 4,
  })
  assert.equal(found.tier, 'mid')
  assert.equal(found.ceiling, 'mid')
  assert.equal(found.warmCorrectable, false)
})

test('weak GPUs start low but a healthy warm-up may lift them to mid', () => {
  const found = detectGfxTier({
    renderer: 'Mali-T720',
    maxTextureSize: 4096,
    deviceMemory: 4,
  })
  assert.equal(found.tier, 'low')
  assert.equal(found.warmCorrectable, true)
  assert.equal(classifyGpu('Intel(R) HD Graphics 4000', 8192), 'low')
  assert.equal(classifyGpu('Apple M2', 16384), 'mid')
  assert.equal(classifyGpu('', 8192), 'mid')
  assert.equal(classifyGpu('', 2048), 'low')
})

test('high is opt-in and stays the ceiling', () => {
  const found = detectGfxTier({ forced: 'high', renderer: 'Mali-T720' })
  assert.equal(found.tier, 'high')
  assert.equal(found.ceiling, 'high')
  assert.equal(found.locked, false)
  assert.equal(detectGfxTier({ forced: 'low' }).locked, true)
})

test('promote stays inside the ceiling and the hysteresis window', () => {
  const healthy = { fps: 58, hitchRate: 0.1, sinceDrop: 99, sincePromote: 99, cool: 0 }
  assert.equal(
    decideQualityStep({ ...healthy, tier: 'low', ceiling: 'mid', canSoften: false }).action,
    'promote',
  )
  assert.equal(
    decideQualityStep({ ...healthy, tier: 'mid', ceiling: 'mid', canSoften: false }).action,
    'hold',
  )
  assert.equal(
    decideQualityStep({ ...healthy, tier: 'low', ceiling: 'mid', sinceDrop: 3, canSoften: false }).action,
    'hold',
  )
  const lift = decideQualityStep({
    ...healthy,
    tier: 'low',
    ceiling: 'low',
    warmCorrectable: true,
    canSoften: false,
  })
  assert.equal(lift.action, 'promote')
  assert.equal(lift.raiseCeiling, true)
  assert.equal(
    decideQualityStep({
      ...healthy,
      tier: 'low',
      ceiling: 'low',
      warmCorrectable: false,
      canSoften: false,
    }).action,
    'hold',
  )
})

test('drops still happen, and a recent promote ignores mild jank', () => {
  assert.equal(
    decideQualityStep({
      fps: 28,
      hitchRate: 0,
      tier: 'mid',
      ceiling: 'mid',
      canSoften: true,
      sincePromote: 99,
      cool: 0,
    }).action,
    'soften',
  )
  assert.equal(
    decideQualityStep({
      fps: 28,
      hitchRate: 0,
      tier: 'mid',
      ceiling: 'mid',
      canSoften: false,
      sincePromote: 99,
      cool: 0,
    }).action,
    'drop',
  )
  assert.equal(
    decideQualityStep({
      fps: 28,
      hitchRate: 2,
      tier: 'mid',
      ceiling: 'mid',
      canSoften: false,
      sincePromote: 2,
      cool: 0,
    }).action,
    'hold',
  )
  assert.equal(
    decideQualityStep({
      fps: 12,
      hitchRate: 2,
      tier: 'mid',
      ceiling: 'mid',
      canSoften: false,
      sincePromote: 1,
      cool: 2,
    }).action,
    'drop',
  )
  assert.equal(
    decideQualityStep({
      fps: 20,
      hitchRate: 0,
      tier: 'low',
      ceiling: 'low',
      locked: true,
      canSoften: false,
      cool: 0,
    }).action,
    'hold',
  )
  assert.equal(stepDown('high'), 'mid')
  assert.equal(stepUp('low'), 'mid')
  assert.equal(stepUp('mid'), 'high')
})
