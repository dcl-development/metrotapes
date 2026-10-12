import * as THREE from 'three'

let tubeTex = null
let haloTex = null

/** Soft vertical falloff for a fluorescent tube. One canvas, reused. */
export function tubeGlowTexture() {
  if (tubeTex) return tubeTex
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.38, 'rgba(255,255,255,0.08)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.62, 'rgba(255,255,255,0.08)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 32, 128)
  tubeTex = new THREE.CanvasTexture(canvas)
  tubeTex.colorSpace = THREE.SRGBColorSpace
  tubeTex.needsUpdate = true
  return tubeTex
}

/** Round falloff for signs and the kiosk screen. */
export function haloTexture() {
  if (haloTex) return haloTex
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 126)
  g.addColorStop(0, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.28, 'rgba(255,255,255,0.38)')
  g.addColorStop(0.62, 'rgba(255,255,255,0.08)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  haloTex = new THREE.CanvasTexture(canvas)
  haloTex.colorSpace = THREE.SRGBColorSpace
  haloTex.needsUpdate = true
  return haloTex
}
