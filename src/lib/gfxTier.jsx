import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GFX,
  detectGfxTier,
  isSlowConnection,
  isSoftwareRendererString,
  stepDown,
  stepUp,
  tierRank,
} from './gfxDetect.js'
import { GfxContext } from './gfxContext.js'

let softwareGpu = false

function readGpuSignals() {
  if (typeof document === 'undefined') {
    return { renderer: '', maxTextureSize: 0, software: false }
  }
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return { renderer: '', maxTextureSize: 0, software: false }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '')
      : String(gl.getParameter(gl.RENDERER) || '')
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return {
      renderer,
      maxTextureSize,
      software: isSoftwareRendererString(renderer),
    }
  } catch {
    return { renderer: '', maxTextureSize: 0, software: false }
  }
}

function probeGfxTier() {
  if (typeof window === 'undefined') return detectGfxTier({})
  const gpu = readGpuSignals()
  softwareGpu = gpu.software
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const conn = navigator.connection
  const forced = new URLSearchParams(window.location.search).get('gfx')
  return detectGfxTier({
    forced,
    software: gpu.software,
    reduced,
    saveData: Boolean(conn?.saveData),
    effectiveType: conn?.effectiveType || '',
    renderer: gpu.renderer,
    maxTextureSize: gpu.maxTextureSize,
    deviceMemory: navigator.deviceMemory,
  })
}

function tierDprMax(tier) {
  const dpr = GFX[tier].dpr
  return Array.isArray(dpr) ? dpr[1] : dpr
}

export function GfxProvider({ children }) {
  const [probed] = useState(probeGfxTier)
  const [tier, setTier] = useState(probed.tier)
  const [ceiling, setCeiling] = useState(probed.ceiling)
  const [dprMax, setDprMax] = useState(null)
  const [warmCorrectable, setWarmCorrectable] = useState(probed.warmCorrectable)
  const startRef = useRef(probed.tier)
  const ceilingRef = useRef(probed.ceiling)
  const lockedRef = useRef(probed.locked)
  const forcedRef = useRef(probed.reason === 'query' ? probed.tier : null)
  ceilingRef.current = ceiling
  lockedRef.current = probed.locked

  const soften = useCallback(() => {
    setDprMax((prev) => {
      const cap = prev ?? tierDprMax(tier)
      if (cap <= 1) return 1
      return Math.max(1, Math.round((cap - 0.25) * 100) / 100)
    })
  }, [tier])

  const drop = useCallback(() => {
    if (lockedRef.current) return
    setTier((current) => {
      const next = stepDown(current)
      if (next === current) return current
      setDprMax(null)
      return next
    })
  }, [])

  const promote = useCallback((raiseCeiling) => {
    if (lockedRef.current) return
    const raised = raiseCeiling && tierRank(ceilingRef.current) < tierRank('mid')
    if (raised) setCeiling('mid')
    setTier((current) => {
      const cap = raised ? 'mid' : ceilingRef.current
      const next = stepUp(current)
      if (tierRank(next) > tierRank(cap)) return current
      if (next === current) return current
      setDprMax(null)
      return next
    })
  }, [])

  const finishWarm = useCallback(() => {
    setWarmCorrectable(false)
  }, [])

  useEffect(() => {
    const conn = typeof navigator !== 'undefined' ? navigator.connection : null
    if (!conn || forcedRef.current) return undefined
    const apply = () => {
      if (!isSlowConnection({
        saveData: conn.saveData,
        effectiveType: conn.effectiveType,
      })) return
      setTier('low')
      setCeiling('low')
      setDprMax(null)
      setWarmCorrectable(false)
    }
    apply()
    conn.addEventListener('change', apply)
    return () => conn.removeEventListener('change', apply)
  }, [])

  const settings = useMemo(() => {
    const base = GFX[tier]
    const min = Array.isArray(base.dpr) ? base.dpr[0] : 1
    let max = dprMax ?? (Array.isArray(base.dpr) ? base.dpr[1] : base.dpr)
    if (softwareGpu) max = Math.min(max, 1)
    return {
      ...base,
      dpr: [min, Math.max(min, max)],
    }
  }, [tier, dprMax])

  const effectiveMax = settings.dpr[1]
  const canSoften = effectiveMax > 1.01
  const canDrop = !probed.locked && tier !== 'low'
  const canPromote = !probed.locked && (
    tierRank(tier) < tierRank(ceiling)
    || (warmCorrectable && tier === 'low')
  )

  const value = useMemo(() => ({
    tier,
    ceiling,
    settings,
    startSettings: GFX[startRef.current],
    soften,
    drop,
    promote,
    finishWarm,
    canSoften,
    canDrop,
    canPromote,
    warmCorrectable,
    locked: probed.locked,
  }), [
    tier,
    ceiling,
    settings,
    soften,
    drop,
    promote,
    finishWarm,
    canSoften,
    canDrop,
    canPromote,
    warmCorrectable,
    probed.locked,
  ])

  return <GfxContext.Provider value={value}>{children}</GfxContext.Provider>
}
