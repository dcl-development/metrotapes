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
    trainFront: 768,
    trainSide: [1536, 384],
    powerPreference: 'low-power',
    exposure: 1.52,
    hemi: 0.92,
    ambient: 0.46,
    tube: 9.2,
    kioskFill: 8.2,
    fog: 0.02,
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
    trainFront: 1024,
    trainSide: [2048, 512],
    powerPreference: 'high-performance',
    exposure: 1.32,
    hemi: 0.52,
    ambient: 0.22,
    tube: 5.4,
    kioskFill: 8.2,
    fog: 0.024,
  },
}

export const FPS_DROP = 36
export const FPS_PROMOTE = 54
export const FPS_CATASTROPHE = 20
export const HITCH_DROP = 1.6
export const HITCH_PROMOTE_MAX = 0.4
export const PROMOTE_AFTER_DROP_SEC = 8
export const DROP_AFTER_PROMOTE_SEC = 6
/** After a camera move, ignore frame times for this long. The hitch when
 * the shot lands is not a reason to resize the buffer or rebuild lights. */
export const QUALITY_SETTLE_SEC = 1.75

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

/** A tier change may tighten the pixel cap. It must not open a higher one.
 * Promoting used to clear the cap, so a softened 1.0 jumped back to 1.25
 * and the next dip dropped the tier again — the tracks-view flash. */
export function dprCapAfterDrop(currentCap, nextTierCap) {
  const from = Number(currentCap)
  const to = Number(nextTierCap)
  if (!Number.isFinite(from)) return to
  if (!Number.isFinite(to)) return from
  return Math.min(from, to)
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
 * One measured window. Soften DPR, then drop. Do not step back up to a
 * tier that failed — that bounce is the tracks-view flicker.
 * A pessimistic GPU probe may still raise the ceiling low → mid once
 * (`warmCorrectable`).
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
  const warmLift = Boolean(
    warmCorrectable && tier === 'low' && ceiling === 'low' && next === 'mid',
  )

  if (cool > 0 && !catastrophic) {
    return { action: 'hold', warmCorrectable }
  }

  const dropBlocked = sincePromote < DROP_AFTER_PROMOTE_SEC && !catastrophic
  if (bad && !dropBlocked) {
    if (canSoften) return { action: 'soften', cool: 2.4, warmCorrectable: false }
    if (!locked && tier !== 'low') return { action: 'drop', cool: 3.6, warmCorrectable: false }
    return { action: 'hold', warmCorrectable: false }
  }

  // Only the one-shot probe correction may step up. Promoting back to a
  // tier that just failed is the tracks-view flash: darker, then sharper,
  // then a higher pixel cap when the drop clears the DPR limit.
  if (healthy && warmLift && sinceDrop >= PROMOTE_AFTER_DROP_SEC) {
    return {
      action: 'promote',
      cool: 4,
      raiseCeiling: true,
      warmCorrectable: false,
    }
  }

  return { action: 'hold', warmCorrectable: false }
}

/**
 * Camera motion is not a quality sample. Wipe the open window while the
 * shot is moving, and keep it wiped until QUALITY_SETTLE_SEC of still
 * frames have passed, so the landing hitch cannot soften or drop.
 */
export function trackQualityMotion(state, moving, dt) {
  const frame = Math.min(Math.max(Number(dt) || 0, 0), 0.1)
  const next = {
    t: state?.t || 0,
    n: state?.n || 0,
    hitches: state?.hitches || 0,
    hold: state?.hold || 0,
    sample: true,
  }
  if (moving) {
    next.t = 0
    next.n = 0
    next.hitches = 0
    next.hold = QUALITY_SETTLE_SEC
    next.sample = false
    return next
  }
  if (next.hold > 0) {
    next.hold = Math.max(0, next.hold - frame)
    next.t = 0
    next.n = 0
    next.hitches = 0
    next.sample = false
  }
  return next
}
