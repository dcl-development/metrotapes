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

export function makeBoardLabel(title, accent) {
  const w = 512
  const h = 96
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, 10, h)
  ctx.fillStyle = '#fff'
  ctx.font = `bold 48px ${FONT}`
  ctx.letterSpacing = '-2px'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, 28, h * 0.54)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}
