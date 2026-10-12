import * as THREE from 'three'
import { FONT, WALL_BOARD_Z0 } from './space'
import { getWallFace } from '../lib/wallSize'

export function wallBoardList() {
  const { pitch } = getWallFace()
  return [
    { id: 'photo', z: WALL_BOARD_Z0, title: 'PHOTO', accent: '#0039A6' },
    { id: 'video', z: WALL_BOARD_Z0 - pitch, title: 'VIDEO', accent: '#00933C' },
    { id: 'about', z: WALL_BOARD_Z0 - pitch * 2, title: 'ABOUT', accent: '#996633' },
  ]
}

export function makeBoardLabel(title, accent, w = 512, h = 96, aniso = 4) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = accent
  const bar = Math.max(10, Math.round(w * 0.02))
  ctx.fillRect(0, 0, bar, h)
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${Math.round(h * 0.5)}px ${FONT}`
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(h * -0.02)}px`
  ctx.textBaseline = 'middle'
  ctx.fillText(title, bar + Math.round(w * 0.035), h * 0.54)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = aniso
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}
