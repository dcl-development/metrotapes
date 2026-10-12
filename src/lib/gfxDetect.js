/** GPU budgets. Visual numbers stay on the tier objects; selection lives here. */

export const GFX = {
  low: {
    dpr: [1, 1.5],
    bloom: false,
    antialias: false,
    grain: false,
    grainOpacity: 0.18,
    ca: false,
    softScreens: true,
    extras: false,
    lights: 1,
    physicalWalls: false,
    trainFront: 512,
    trainSide: [1280, 320],
    powerPreference: 'low-power',
    exposure: 1.55,
    hemi: 0.98,
    ambient: 0.52,
    tube: 9.4,
    kioskFill: 8.4,
    fog: 0.022,
    idleMotion: false,
    mapPx: 256,
    ceilingPx: 512,
    columnPx: 64,
    aniso: 4,
    propPx: 256,
    woodPx: 512,
    labelPx: 512,
    cheapGlow: true,
  },
  mid: {
    dpr: [1, 1.25],
    bloom: false,
    antialias: true,
    grain: true,
    grainOpacity: 0.12,
    ca: true,
    softScreens: false,
    extras: true,
    lights: 2,
    physicalWalls: false,
    trainFront: 1024,
    trainSide: [2048, 512],
    powerPreference: 'low-power',
    exposure: 1.52,
    hemi: 0.92,
    ambient: 0.46,
    tube: 9.2,
    kioskFill: 8.2,
    fog: 0.02,
    mapPx: 512,
    ceilingPx: 768,
    columnPx: 128,
    aniso: 8,
    propPx: 512,
    woodPx: 768,
    labelPx: 1024,
    cheapGlow: true,
  },
  high: {
    dpr: [1, 1.5],
    bloom: true,
    antialias: false,
    grain: true,
    grainOpacity: 0.1,
    ca: false,
    softScreens: false,
    extras: true,
    lights: 3,
    physicalWalls: true,
    trainFront: 1280,
    trainSide: [2560, 640],
    powerPreference: 'high-performance',
    exposure: 1.32,
    hemi: 0.52,
    ambient: 0.22,
    tube: 5.4,
    kioskFill: 8.2,
    fog: 0.024,
    mapPx: 1024,
    ceilingPx: 1024,
    columnPx: 160,
    aniso: 16,
    propPx: 768,
    woodPx: 1024,
    labelPx: 1536,
    cheapGlow: false,
  },
}

export const FPS_DROP = 36
export const FPS_PROMOTE = 54
export const FPS_CATASTROPHE = 20
export const HITCH_DROP = 1.6
export const HITCH_PROMOTE_MAX = 0.4
export const PROMOTE_AFTER_DROP_SEC = 8
export const DROP_AFTER_PROMOTE_SEC = 6

const SOFTWARE_RE = /swiftshader|llvmpipe|softpipe|software|microsoft basic render|mesa offscreen/i
const WEAK_GPU_RE = /mali-4|mali-t|adreno\s*(?:\(tm\)\s*)?[34]\d{2}|intel\(r\)\s*hd\s*graphics|powervr|sgx|videocore/i
const STRONG_GPU_RE = /apple\s*(gpu|m\d)|nvidia|geforce|rtx|gtx|radeon|adreno\s*(?:\(tm\)\s*)?[6-9]\d{2}|mali-g(?:[7-9]|1\d)|angle \(apple/i

export function isSoftwareRendererString(renderer) {
  return SOFTWARE_RE.test(String(renderer || ''))
}

export function isSlowConnection({ saveData = false, effectiveType = '' } = {}) {
  if (saveData) return true
  return effectiveType === '2g' || effectiveType === 'slow-2g'
}

/** True when we should shrink preload / prefer low bandwidth. */
export function shouldConserveBandwidth(conn) {
  if (conn) return isSlowConnection(conn)
  if (typeof navigator === 'undefined') return false
  const live = navigator.connection
  if (!live) return false
  return isSlowConnection({
    saveData: live.saveData,
    effectiveType: live.effectiveType,
  })
}

export function tierRank(tier) {
  if (tier === 'high') return 2
  if (tier === 'mid') return 1
  return 0
}

export function stepDown(tier) {
  if (tier === 'high') return 'mid'
  if (tier === 'mid') return 'low'
  return 'low'
}

export function stepUp(tier) {
  if (tier === 'low') return 'mid'
  if (tier === 'mid') return 'high'
  return 'high'
}

/**
 * Weak / strong / unknown from the renderer string and max texture size.
 * Screen width is not an input.
 * @returns {'low'|'mid'}
 */
export function classifyGpu(renderer, maxTextureSize = 0) {
  const name = String(renderer || '')
  if (isSoftwareRendererString(name) || WEAK_GPU_RE.test(name)) return 'low'
  if (STRONG_GPU_RE.test(name)) return 'mid'
  if (maxTextureSize >= 8192) return 'mid'
  if (maxTextureSize > 0 && maxTextureSize < 4096) return 'low'
  return 'mid'
}

/**
 * Starting tier and the highest tier this session may step back up to.
 * High is only the `?gfx=high` opt-in, so a normal desktop does not gain bloom.
 */
export function detectGfxTier({
  forced = null,
  software = false,
  reduced = false,
  saveData = false,
  effectiveType = '',
  renderer = '',
  maxTextureSize = 0,
  deviceMemory,
} = {}) {
  if (forced === 'low' || forced === 'mid' || forced === 'high') {
    return {
      tier: forced,
      ceiling: forced,
      locked: forced === 'low',
      warmCorrectable: false,
      software: Boolean(software),
      reason: 'query',
    }
  }

  const softwareGpu = Boolean(software) || isSoftwareRendererString(renderer)
  if (softwareGpu) {
    return {
      tier: 'low',
      ceiling: 'low',
      locked: true,
      warmCorrectable: false,
      software: true,
      reason: 'software',
    }
  }

  if (reduced) {
    return {
      tier: 'low',
      ceiling: 'low',
      locked: true,
      warmCorrectable: false,
      software: false,
      reason: 'reduced',
    }
  }

  if (isSlowConnection({ saveData, effectiveType })) {
    return {
      tier: 'low',
      ceiling: 'low',
      locked: true,
      warmCorrectable: false,
      software: false,
      reason: 'network',
    }
  }

  // 2GB-class devices stay low. 4GB is common on phones with a real GPU,
  // so it is not an automatic low.
  if (typeof deviceMemory === 'number' && deviceMemory > 0 && deviceMemory <= 2) {
    return {
      tier: 'low',
      ceiling: 'low',
      locked: true,
      warmCorrectable: false,
      software: false,
      reason: 'memory',
    }
  }

  const gpu = classifyGpu(renderer, maxTextureSize)
  if (gpu === 'low') {
    return {
      tier: 'low',
      ceiling: 'low',
      locked: false,
      warmCorrectable: true,
      software: false,
      reason: 'gpu',
    }
  }

  return {
    tier: 'mid',
    ceiling: 'mid',
    locked: false,
    warmCorrectable: false,
    software: false,
    reason: 'gpu',
  }
}

/**
 * One measured window. Soften DPR, then drop. Promote only with headroom,
 * never above the ceiling, and not inside the hysteresis window.
 * A pessimistic GPU probe may raise the ceiling low → mid on the first
 * healthy sample (`warmCorrectable`).
 */
export function decideQualityStep({
  fps,
  hitchRate,
  tier,
  ceiling,
  canSoften,
  locked = false,
  sinceDrop = Number.POSITIVE_INFINITY,
  sincePromote = Number.POSITIVE_INFINITY,
  cool = 0,
  warmCorrectable = false,
}) {
  const bad = fps < FPS_DROP || hitchRate >= HITCH_DROP
  const catastrophic = fps < FPS_CATASTROPHE
  const healthy = fps > FPS_PROMOTE && hitchRate <= HITCH_PROMOTE_MAX
  const next = stepUp(tier)
  const withinCeiling = tierRank(next) <= tierRank(ceiling)
  const warmLift = Boolean(
    warmCorrectable && tier === 'low' && ceiling === 'low' && next === 'mid',
  )
  const canPromote = !locked && next !== tier && (withinCeiling || warmLift)

  if (cool > 0 && !catastrophic) {
    return { action: 'hold', warmCorrectable }
  }

  const dropBlocked = sincePromote < DROP_AFTER_PROMOTE_SEC && !catastrophic
  if (bad && !dropBlocked) {
    if (canSoften) return { action: 'soften', cool: 2.4, warmCorrectable: false }
    if (!locked && tier !== 'low') return { action: 'drop', cool: 3.6, warmCorrectable: false }
    return { action: 'hold', warmCorrectable: false }
  }

  if (healthy && canPromote && sinceDrop >= PROMOTE_AFTER_DROP_SEC) {
    return {
      action: 'promote',
      cool: 4,
      raiseCeiling: warmLift,
      warmCorrectable: false,
    }
  }

  return { action: 'hold', warmCorrectable: false }
}
