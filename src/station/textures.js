import * as THREE from 'three'
import { EXIT_RED, FLOOR_W, FONT, LEN, TILE, TRACK_W, TRAIN_Z, WALL_ROWS, hash01 } from './space'
import { useLayoutEffect, useMemo } from 'react'

export function makeCanvasTexture(paint, size, colorSpace) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  paint(canvas.getContext('2d'), size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = colorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

function makeColumnTexture(paint, tilePx, rows, colorSpace) {
  const canvas = document.createElement('canvas')
  canvas.width = tilePx
  canvas.height = tilePx * rows
  paint(canvas.getContext('2d'), tilePx, rows)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = colorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

function paintSubwayColumn(ctx, tile, rows, kind) {
  const grout = Math.max(2, Math.round(tile * 0.1))
  const topWhite = 2
  const bandBlack = 1
  const bandGreen = 3
  const fillFor = (r) => {
    if (r < topWhite) return 'white'
    if (r < topWhite + bandBlack) return 'black'
    if (r < topWhite + bandBlack + bandGreen) return 'green'
    if (r < topWhite + bandBlack + bandGreen + bandBlack) return 'black'
    return 'white'
  }
  // Dirtier base than fresh MTA tile
  const color = {
    white: '#d8d2c6',
    black: '#121214',
    green: '#a8b8a0',
  }
  const groutC = {
    white: '#8a8478',
    black: '#08080a',
    green: '#6a7a62',
  }
  const bumpFace = { white: '#e0e0e0', black: '#c8c8c8', green: '#d8d8d8' }
  const bumpGrout = { white: '#1a1a1a', black: '#101010', green: '#222222' }
  const roughFace = { white: '#4a4a4a', black: '#3a3a3a', green: '#454545' }
  const roughGrout = { white: '#d0d0d0', black: '#b8b8b8', green: '#c4c4c4' }

  for (let r = 0; r < rows; r += 1) {
    const y = r * tile
    const type = fillFor(r)
    // Heavier grime toward floor + a bit near ceiling
    const floorGrime = Math.max(0, (r - rows * 0.55) / (rows * 0.45))
    const ceilingGrime = Math.max(0, 1 - r / (rows * 0.22))
    const zone = Math.min(1, floorGrime * 0.85 + ceilingGrime * 0.25)

    if (kind === 'color') {
      ctx.fillStyle = groutC[type]
      ctx.fillRect(0, y, tile, tile)
      ctx.fillStyle = color[type]
      ctx.fillRect(grout, y + grout, tile - grout * 2, tile - grout * 2)

      // Tile-to-tile brightness variation
      const shade = ((r * 17 + 9) % 11) / 11
      ctx.fillStyle = `rgba(40, 34, 26, ${0.04 + shade * 0.1 + zone * 0.14})`
      ctx.fillRect(grout, y + grout, tile - grout * 2, tile - grout * 2)

      // Speckle / water spots on light tiles
      if (type === 'white' || type === 'green') {
        for (let k = 0; k < 6; k += 1) {
          const px = grout + 2 + ((r * 13 + k * 19) % Math.max(1, tile - grout * 2 - 4))
          const py = y + grout + 2 + ((r * 29 + k * 11) % Math.max(1, tile - grout * 2 - 4))
          ctx.fillStyle = `rgba(55, 48, 38, ${0.12 + (k % 3) * 0.06})`
          ctx.fillRect(px, py, 1 + (k % 2), 1)
        }
        // Soft vertical drip / wash
        if ((r * 7) % 5 === 0) {
          const dx = grout + 4 + (r * 11) % Math.max(1, tile - grout * 2 - 8)
          const drip = ctx.createLinearGradient(dx, y + grout, dx, y + tile - grout)
          drip.addColorStop(0, 'rgba(30, 26, 20, 0)')
          drip.addColorStop(0.4, `rgba(30, 26, 20, ${0.08 + zone * 0.1})`)
          drip.addColorStop(1, `rgba(25, 22, 16, ${0.16 + zone * 0.12})`)
          ctx.fillStyle = drip
          ctx.fillRect(dx, y + grout, 2 + (r % 2), tile - grout * 2)
        }
      }

      // Hand-height / lower band scum line
      if (floorGrime > 0.15 && type === 'white') {
        ctx.fillStyle = `rgba(70, 58, 40, ${0.08 + floorGrime * 0.18})`
        ctx.fillRect(grout, y + tile * 0.55, tile - grout * 2, tile * 0.35)
      }

      // Grout packed with dirt
      ctx.fillStyle = `rgba(25, 20, 14, ${0.15 + zone * 0.2})`
      ctx.fillRect(0, y, tile, grout)
      ctx.fillRect(0, y + tile - grout, tile, grout)
      ctx.fillRect(0, y, grout, tile)
      ctx.fillRect(tile - grout, y, grout, tile)
    } else if (kind === 'bump') {
      ctx.fillStyle = bumpGrout[type]
      ctx.fillRect(0, y, tile, tile)
      ctx.fillStyle = bumpFace[type]
      ctx.fillRect(grout, y + grout, tile - grout * 2, tile - grout * 2)
      // Extra micro pitting
      ctx.fillStyle = '#909090'
      for (let k = 0; k < 4; k += 1) {
        ctx.fillRect(
          grout + ((r * 5 + k * 9) % (tile - grout * 2)),
          y + grout + ((r * 3 + k * 7) % (tile - grout * 2)),
          1,
          1,
        )
      }
    } else {
      // Roughness: grimier tiles = rougher
      const roughBoost = Math.floor(zone * 50)
      const rf = roughFace[type]
      ctx.fillStyle = roughGrout[type]
      ctx.fillRect(0, y, tile, tile)
      ctx.fillStyle = rf
      ctx.fillRect(grout, y + grout, tile - grout * 2, tile - grout * 2)
      if (roughBoost > 0) {
        ctx.fillStyle = `rgb(${80 + roughBoost},${80 + roughBoost},${80 + roughBoost})`
        ctx.fillRect(grout, y + grout, tile - grout * 2, tile - grout * 2)
      }
    }
  }
}

function paintConcrete(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const x = i % n
    const y = (i / n) | 0
    // Speckled transit rubber — darker base, uneven grit
    const speck = ((x * 13 + y * 37) >>> 3) % 9
    const noise = ((i * 16807) >>> 8) % 38
    const blotch = Math.sin(x * 0.07 + y * 0.05) * 8 + Math.sin(x * 0.021 - y * 0.03) * 10
    const v = Math.max(28, Math.min(78, 48 + noise - speck * 3 + blotch))
    // Slight brown/olive cast in the muck
    data[j] = v + 4
    data[j + 1] = v + 1
    data[j + 2] = Math.max(22, v - 6)
      data[j + 3] = 255
    }
  ctx.putImageData(img, 0, 0)

  // Long scuff / mop streaks
  for (let k = 0; k < 22; k += 1) {
    ctx.fillStyle = `rgba(12, 10, 8, ${0.08 + (k % 5) * 0.03})`
    ctx.fillRect((k * 73) % n, (k * 41) % n, 40 + (k % 7) * 14, 1 + (k % 3))
  }
  // Gum / oil spots
  for (let k = 0; k < 28; k += 1) {
    const gx = (k * 97 + 13) % n
    const gy = (k * 53 + 29) % n
    const gr = 3 + (k % 6)
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
    g.addColorStop(0, k % 3 === 0 ? 'rgba(55, 42, 28, 0.55)' : 'rgba(20, 18, 14, 0.45)')
    g.addColorStop(1, 'rgba(20, 18, 14, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(gx, gy, gr, 0, Math.PI * 2)
    ctx.fill()
  }
  // Wet / damp patches
  for (let k = 0; k < 8; k += 1) {
    const wx = (k * 61 + 7) % n
    const wy = (k * 89 + 19) % n
    const g = ctx.createRadialGradient(wx, wy, 2, wx, wy, 18 + (k % 5) * 6)
    g.addColorStop(0, 'rgba(8, 10, 12, 0.35)')
    g.addColorStop(1, 'rgba(8, 10, 12, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(wx, wy, 22 + (k % 4) * 5, 0, Math.PI * 2)
    ctx.fill()
  }
  // Pale salt / grit flecks
  ctx.fillStyle = 'rgba(160, 155, 145, 0.12)'
  for (let k = 0; k < 90; k += 1) {
    ctx.fillRect((k * 47 + 3) % n, (k * 29 + 11) % n, 1, 1)
  }
}

function paintCeiling(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const x = i % n
    const y = (i / n) | 0
    const a = hash01(i)
    const b = hash01(i * 3 + x * 17)
    const c = hash01(y * 91 + x * 13 + 7)
    const blotch = hash01((x >> 3) * 131 + (y >> 4) * 197) * 22 - 8
    const v = Math.max(8, Math.min(58, 16 + a * 28 + b * 10 + blotch + c * 6))
    data[j] = v + 8
    data[j + 1] = v + 1
    data[j + 2] = Math.max(6, v - 7)
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  for (let k = 0; k < 22; k += 1) {
    const x = Math.floor(hash01(k * 19 + 3) * n)
    const len = Math.floor(n * (0.25 + hash01(k * 41) * 0.75))
    const y0 = Math.floor(hash01(k * 73 + 11) * (n - len))
    const w = 1 + (k % 4)
    const g = ctx.createLinearGradient(x, y0, x, y0 + len)
    g.addColorStop(0, `rgba(${70 + (k % 40)}, ${36 + (k % 18)}, 16, ${0.28 + hash01(k) * 0.3})`)
    g.addColorStop(1, 'rgba(18, 12, 8, 0)')
    ctx.fillStyle = g
    ctx.fillRect(x, y0, w, len)
  }
  for (let k = 0; k < 28; k += 1) {
    const cx = Math.floor(hash01(k * 29 + 5) * n)
    const cy = Math.floor(hash01(k * 47 + 9) * n)
    const r = 10 + hash01(k * 11) * 36
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, `rgba(4, 4, 5, ${0.35 + hash01(k * 3) * 0.35})`)
    g.addColorStop(1, 'rgba(8, 8, 8, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(160, 120, 82, 0.14)'
  for (let k = 0; k < 90; k += 1) {
    ctx.fillRect(Math.floor(hash01(k * 53) * n), Math.floor(hash01(k * 71 + 2) * n), 1 + (k % 2), 1)
  }
}

function paintSteel(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const a = hash01(i)
    const b = hash01(i * 5 + 11)
    const v = 28 + a * 22 + b * 10
    data[j] = v + 8
    data[j + 1] = v
    data[j + 2] = Math.max(16, v - 8)
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  for (let k = 0; k < 16; k += 1) {
    const x = Math.floor(hash01(k * 23) * n)
    const h = Math.floor(n * (0.35 + hash01(k * 17) * 0.65))
    const y = Math.floor(hash01(k * 31 + 4) * (n - h * 0.2))
    ctx.fillStyle = `rgba(${100 + (k % 50)}, ${42 + (k % 20)}, 12, ${0.18 + hash01(k) * 0.28})`
    ctx.fillRect(x, y, 1 + (k % 3), h)
  }
  for (let k = 0; k < 18; k += 1) {
    const cx = Math.floor(hash01(k * 43) * n)
    const cy = Math.floor(hash01(k * 59) * n)
    const r = 4 + hash01(k * 7) * 14
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, 'rgba(128, 44, 14, 0.62)')
    g.addColorStop(1, 'rgba(60, 28, 12, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let k = 0; k < 10; k += 1) {
    ctx.fillStyle = `rgba(6, 6, 8, ${0.12 + hash01(k * 9) * 0.18})`
    ctx.fillRect(
      Math.floor(hash01(k * 37) * n),
      Math.floor(hash01(k * 41 + 1) * n),
      12 + (k % 14),
      3 + (k % 6),
    )
  }
}

function paintRiser(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const x = i % n
    const y = (i / n) | 0
    const a = hash01(i)
    const b = hash01((y >> 2) * 67 + (x >> 3) * 19)
    const v = Math.max(18, Math.min(62, 30 + a * 22 + b * 12 - 6))
    data[j] = v + 6
    data[j + 1] = v
    data[j + 2] = Math.max(14, v - 8)
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  for (let k = 0; k < 18; k += 1) {
    const x = Math.floor(hash01(k * 21 + 8) * n)
    const g = ctx.createLinearGradient(x, 0, x, n)
    g.addColorStop(0, `rgba(${80 + (k % 30)}, ${40 + (k % 12)}, 16, ${0.35 + hash01(k) * 0.25})`)
    g.addColorStop(0.55, 'rgba(30, 20, 12, 0.18)')
    g.addColorStop(1, 'rgba(12, 10, 8, 0)')
    ctx.fillStyle = g
    ctx.fillRect(x, 0, 2 + (k % 3), n)
  }
  for (let k = 0; k < 14; k += 1) {
    const cy = Math.floor(hash01(k * 33) * n * 0.55)
    const cx = Math.floor(hash01(k * 51 + 2) * n)
    const r = 12 + hash01(k * 13) * 28
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, 'rgba(8, 8, 8, 0.5)')
    g.addColorStop(1, 'rgba(8, 8, 8, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function paintTactile(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const grit = hash01(i) * 18 - 8
    const speck = hash01(i * 5 + 3) > 0.92 ? -14 : 0
    data[j] = Math.max(186, Math.min(228, 214 + grit + speck))
    data[j + 1] = Math.max(148, Math.min(190, 172 + grit * 0.7))
    data[j + 2] = Math.max(8, Math.min(32, 16 + grit * 0.15))
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  for (let k = 0; k < 10; k += 1) {
    ctx.fillStyle = `rgba(40, 32, 12, ${0.04 + hash01(k) * 0.05})`
    ctx.fillRect(0, Math.floor(hash01(k * 47) * n), n, 1)
  }
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, rad)
  else ctx.rect(x, y, w, h)
  ctx.fill()
}

function glassPane(ctx, x, y, w, h) {
  ctx.fillStyle = '#1c1c1e'
  rr(ctx, x - 5, y - 5, w + 10, h + 10, 6)
  // Warm cabin light through windshield
  const lit = ctx.createLinearGradient(x, y, x, y + h)
  lit.addColorStop(0, '#f5ecd8')
  lit.addColorStop(0.55, '#d4b888')
  lit.addColorStop(1, '#8a7050')
  ctx.fillStyle = lit
  rr(ctx, x, y, w, h, 4)
  const sheen = ctx.createLinearGradient(x, y, x, y + h)
  sheen.addColorStop(0, 'rgba(255, 250, 240, 0.28)')
  sheen.addColorStop(0.4, 'rgba(210, 220, 230, 0.04)')
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0.22)')
  ctx.fillStyle = sheen
  rr(ctx, x, y, w, h, 4)
}

function paintLamp(ctx, x, y, r, inner, outer) {
  ctx.beginPath()
  ctx.arc(x, y, r + 4, 0, Math.PI * 2)
    ctx.fillStyle = '#111416'
    ctx.fill()
  const lens = ctx.createRadialGradient(x - r * 0.18, y - r * 0.18, r * 0.05, x, y, r)
  lens.addColorStop(0, inner)
  lens.addColorStop(0.45, outer)
  lens.addColorStop(1, '#2a1c10')
    ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = lens
    ctx.fill()
    ctx.beginPath()
  ctx.arc(x - r * 0.22, y - r * 0.22, r * 0.22, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fill()
}

export const TRAIN_LINES = [
  { id: 'R', color: '#FCCC0A', fg: '#000000' },
  { id: 'F', color: '#FF6319', fg: '#ffffff' },
]

export const TRAIN_CAR_N = 3
export const TRAIN_CAR_L = 15.6
export const TRAIN_COUPLE = 0.08
export const TRAIN_UNIT = TRAIN_CAR_L + TRAIN_COUPLE
export const TRAIN_DEPART_Z = 52
export const TRAIN_ARRIVE_Z = TRAIN_Z - 78

export function paintCarFront(ctx, w, h, line = TRAIN_LINES[0]) {
  const img = ctx.createImageData(w, h)
  const { data } = img
  for (let py = 0; py < h; py += 1) {
    const dirt = py > h * 0.82 ? -26 : py > h * 0.58 ? -8 : 0
    for (let px = 0; px < w; px += 1) {
      const j = (py * w + px) * 4
      const brush = Math.sin(px * 0.28) * 5
      const grain = ((px * 13 + py) >>> 4) % 6
      const v = Math.max(70, 166 + brush + grain + dirt)
      data[j] = v + 8
      data[j + 1] = v + 6
      data[j + 2] = v + 2
      data[j + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  for (let i = 0; i < 18; i += 1) {
    const sx = w * (0.03 + i * 0.052)
    const streak = ctx.createLinearGradient(0, 0, 0, h)
    streak.addColorStop(0, 'rgba(22,18,12,0)')
    streak.addColorStop(0.4, 'rgba(22,18,12,0.04)')
    streak.addColorStop(1, 'rgba(16,12,8,0.2)')
    ctx.fillStyle = streak
    ctx.fillRect(sx, h * 0.06, 2 + (i % 3), h * 0.84)
  }

  const cabY = h * 0.13
  const cabH = h * 0.27
  const cabW = w * 0.27
  const cabL = w * 0.055
  const cabR = w * 0.675
  glassPane(ctx, cabL, cabY, cabW, cabH)
  glassPane(ctx, cabR, cabY, cabW, cabH)

  const doorX = w * 0.385
  const doorY = h * 0.11
  const doorW = w * 0.23
  const doorH = h * 0.74
  ctx.fillStyle = 'rgba(24,20,16,0.5)'
  ctx.fillRect(doorX - 4, doorY - 4, doorW + 8, doorH + 8)
  ctx.fillStyle = 'rgba(30,28,24,0.22)'
  ctx.fillRect(doorX, doorY, doorW, doorH)
  ctx.strokeStyle = 'rgba(210,200,180,0.14)'
  ctx.lineWidth = 2
  ctx.strokeRect(doorX + 2, doorY + 2, doorW - 4, doorH - 4)
  ctx.fillStyle = 'rgba(12,10,8,0.55)'
  ctx.fillRect(doorX + doorW * 0.5 - 1, doorY + 6, 2, doorH - 12)
  glassPane(ctx, doorX + doorW * 0.16, doorY + doorH * 0.07, doorW * 0.68, doorH * 0.26)

  ctx.fillStyle = '#3a3e42'
  ctx.fillRect(doorX - 11, doorY, 7, doorH)
  ctx.fillRect(doorX + doorW + 4, doorY, 7, doorH)
  ctx.fillStyle = '#2a2e32'
  ctx.fillRect(doorX + doorW * 0.7, doorY + doorH * 0.44, doorW * 0.16, 7)
  ctx.fillRect(doorX + doorW * 0.7, doorY + doorH * 0.58, doorW * 0.16, 7)

  ctx.strokeStyle = 'rgba(110,114,118,0.8)'
  ctx.lineWidth = Math.max(2, w * 0.004)
  ctx.setLineDash([w * 0.012, w * 0.008])
    ctx.beginPath()
  ctx.moveTo(doorX + 4, doorY + 10)
  ctx.lineTo(doorX + doorW - 4, doorY + doorH * 0.52)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(doorX + doorW - 4, doorY + 10)
  ctx.lineTo(doorX + 4, doorY + doorH * 0.52)
  ctx.stroke()
  ctx.setLineDash([])

  const br = cabW * 0.3
  const bx = cabR + cabW * 0.5
  const by = cabY + cabH * 0.52
    ctx.beginPath()
  ctx.arc(bx, by, br, 0, Math.PI * 2)
  ctx.fillStyle = line.color
    ctx.fill()
  ctx.fillStyle = line.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(br * 1.28)}px ${FONT}`
  ctx.fillText(line.id, bx, by + br * 0.05)

  const redR = w * 0.028
  const hlR = w * 0.055
  const stackXs = [doorX - w * 0.075, doorX + doorW + w * 0.075]
  stackXs.forEach((sx) => {
    paintLamp(ctx, sx, h * 0.48, redR, '#ff6868', '#b01010')
    paintLamp(ctx, sx, h * 0.62, hlR, '#f0e8c8', '#b8a870')
  })

  ctx.fillStyle = 'rgba(18,18,20,0.72)'
  ctx.fillRect(0, h * 0.88, w, h * 0.12)
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i % 2 ? '#3a4044' : '#2a3034'
    ctx.fillRect(w * 0.06 + i * w * 0.11, h * 0.855, w * 0.09, h * 0.035)
  }
  ctx.fillStyle = '#141618'
  ctx.fillRect(w * 0.38, h * 0.91, w * 0.24, h * 0.055)
}

export function paintCarSide(ctx, w, h, { reverse = false } = {}) {
  const skirtStart = 0.52
  const skirtY = Math.round(h * skirtStart)
  const img = ctx.createImageData(w, h)
  const { data } = img
  for (let py = 0; py < h; py += 1) {
    const frac = py / h
    const inSkirt = frac >= skirtStart
    const rib = inSkirt ? Math.sin(py * 1.35) * 22 : 0
    const base = inSkirt ? 128 : 178
    const dirt = frac > 0.9 ? -28 : frac > 0.78 ? -10 : 0
    const row = base + rib + dirt + ((py * 11) % 4)
    for (let px = 0; px < w; px += 1) {
      const j = (py * w + px) * 4
      const brush = inSkirt
        ? ((px * 3) >>> 4) % 3
        : Math.sin(px * 0.22) * 4 + (((px * 7) >>> 5) % 4)
      const v = Math.min(255, Math.max(55, row + brush))
      data[j] = v + (inSkirt ? 6 : 10)
      data[j + 1] = v + (inSkirt ? 5 : 8)
      data[j + 2] = v + (inSkirt ? 3 : 5)
      data[j + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  // Soft sheen on upper stainless
  const sheen = ctx.createLinearGradient(0, 0, 0, skirtY)
  sheen.addColorStop(0, 'rgba(255,255,255,0.14)')
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.02)')
  sheen.addColorStop(1, 'rgba(0,0,0,0.08)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, w, skirtY)

  // Seam between smooth upper and ribbed skirt
  ctx.fillStyle = 'rgba(30,28,26,0.35)'
  ctx.fillRect(0, skirtY - 1, w, 2)
  ctx.fillStyle = 'rgba(220,220,215,0.12)'
  ctx.fillRect(0, skirtY + 1, w, 1)

  const doorH = h * 0.72
  const doorY = h * 0.1
  const doorW = w * 0.058
  const winH = h * 0.34
  const winW = w * 0.084
  const winY = doorY + doorH * 0.12
  const panelW = w * 0.038
  // Default L→R = front→rear. `reverse` paints rear→front so the
  // platform-side mesh can stay unflipped (scale.x=-1 was mirroring the badge).
  const units = [
    { kind: 'badge' },
    { kind: 'win' },
    { kind: 'mta' },
    { kind: 'door' },
    { kind: 'win' },
    { kind: 'door' },
    { kind: 'mta' },
    { kind: 'win' },
    { kind: 'door' },
    { kind: 'mta' },
    { kind: 'door' },
  ]
  const ordered = reverse ? [...units].reverse() : units
  const contentW =
    doorW * units.filter((u) => u.kind === 'door').length +
    winW * units.filter((u) => u.kind === 'win').length +
    panelW * units.filter((u) => u.kind === 'badge' || u.kind === 'mta').length
  const gap = (w - contentW) / (units.length + 1)
  let x = gap

  const drawDoor = (dx) => {
    // Double door panels — same stainless family
    ctx.fillStyle = 'rgba(40,42,44,0.18)'
    ctx.fillRect(dx, doorY, doorW, doorH)
    ctx.strokeStyle = 'rgba(20,20,22,0.55)'
    ctx.lineWidth = 2
    ctx.strokeRect(dx + 1, doorY + 1, doorW - 2, doorH - 2)
    const seam = dx + doorW * 0.5
    ctx.fillStyle = 'rgba(10,10,12,0.75)'
    ctx.fillRect(seam - 1.5, doorY + 3, 3, doorH - 6)
    // Pill windows on each leaf — lit cabin showing through
    ;[0.22, 0.72].forEach((fx) => {
      const pw = doorW * 0.18
      const ph = doorH * 0.22
      const px = dx + doorW * fx - pw * 0.5
      const py = doorY + doorH * 0.18
      ctx.fillStyle = '#0e1012'
      rr(ctx, px - 2, py - 2, pw + 4, ph + 4, ph * 0.45)
      const lit = ctx.createLinearGradient(px, py, px, py + ph)
      lit.addColorStop(0, '#fff6e0')
      lit.addColorStop(0.45, '#f0d8a8')
      lit.addColorStop(0.72, '#e09040')
      lit.addColorStop(1, '#c86828')
      ctx.fillStyle = lit
      rr(ctx, px, py, pw, ph, ph * 0.4)
      ctx.fillStyle = 'rgba(255, 248, 230, 0.35)'
      rr(ctx, px + pw * 0.1, py + ph * 0.08, pw * 0.8, ph * 0.22, 2)
    })
    // Kick plate
    ctx.fillStyle = 'rgba(25,22,18,0.4)'
    ctx.fillRect(dx, doorY + doorH * 0.9, doorW, doorH * 0.1)
  }

  const drawWin = (dx) => {
    ctx.fillStyle = '#1a1c1e'
    rr(ctx, dx - 4, winY - 4, winW + 8, winH + 8, 8)
    // Lit interior: ceiling fluorescents → warm cabin → orange seat band
    const lit = ctx.createLinearGradient(dx, winY, dx, winY + winH)
    lit.addColorStop(0, '#fff8ea')
    lit.addColorStop(0.18, '#f5e6c8')
    lit.addColorStop(0.42, '#e8d0a0')
    lit.addColorStop(0.62, '#d89048')
    lit.addColorStop(0.82, '#e07030')
    lit.addColorStop(1, '#a84820')
    ctx.fillStyle = lit
    rr(ctx, dx, winY, winW, winH, 5)
    // Soft glass sheen
    const g = ctx.createLinearGradient(dx, winY, dx, winY + winH)
    g.addColorStop(0, 'rgba(255,255,255,0.28)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.04)')
    g.addColorStop(1, 'rgba(0,0,0,0.18)')
    ctx.fillStyle = g
    rr(ctx, dx, winY, winW, winH, 5)
    // Destination strip still dark
    ctx.fillStyle = 'rgba(8,10,12,0.82)'
    ctx.fillRect(dx + winW * 0.08, winY + winH * 0.08, winW * 0.84, winH * 0.14)
  }

  const drawMta = (cx, cy, r) => {
      ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2)
    ctx.strokeStyle = '#0039A6'
    ctx.lineWidth = Math.max(2, r * 0.08)
      ctx.stroke()
    ctx.fillStyle = '#0039A6'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${Math.round(r * 0.55)}px ${FONT}`
    ctx.fillText('MTA', cx, cy - r * 0.08)
    ctx.font = `600 ${Math.round(r * 0.16)}px ${FONT}`
    ctx.fillText('New York City Subway', cx, cy + r * 0.38)
  }

  const drawFlag = (fx, fy, fw, fh) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(fx, fy, fw, fh)
    const stripeH = fh / 13
    for (let i = 0; i < 13; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#B22234' : '#ffffff'
      ctx.fillRect(fx, fy + i * stripeH, fw, stripeH + 0.5)
    }
    ctx.fillStyle = '#3C3B6E'
    ctx.fillRect(fx, fy, fw * 0.4, stripeH * 7)
  }

  const drawBadge = (dx) => {
    // Number (white on black) above American flag
    const bx = dx + panelW * 0.08
    const bw = panelW * 0.84
    const nh = h * 0.08
    const ny = doorY + doorH * 0.16
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(bx, ny, bw, nh)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${Math.round(nh * 0.68)}px ${FONT}`
    ctx.fillText('4804', bx + bw * 0.5, ny + nh * 0.55)
    const fh = h * 0.07
    const fw = bw * 0.92
    drawFlag(bx + (bw - fw) * 0.5, ny + nh + h * 0.025, fw, fh)
  }

  const drawMtaPanel = (dx) => {
    drawMta(dx + panelW * 0.5, doorY + doorH * 0.28, panelW * 0.38)
  }

  ordered.forEach((u) => {
    if (u.kind === 'badge') {
      drawBadge(x)
      x += panelW + gap
    } else if (u.kind === 'mta') {
      drawMtaPanel(x)
      x += panelW + gap
    } else if (u.kind === 'door') {
      drawDoor(x)
      x += doorW + gap
    } else if (u.kind === 'win') {
      drawWin(x)
      x += winW + gap
    }
  })
}

export function makeLabelTexture(draw, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d'), width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

export function lumaAsAlpha(img) {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = id.data
  let minX = canvas.width
  let minY = canvas.height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4
      const a = Math.max(d[i], d[i + 1], d[i + 2])
      d[i] = 255
      d[i + 1] = 255
      d[i + 2] = 255
      d[i + 3] = a
      if (a > 24) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  ctx.putImageData(id, 0, 0)
  if (maxX <= minX || maxY <= minY) return canvas
  const pad = 2
  const sx = Math.max(0, minX - pad)
  const sy = Math.max(0, minY - pad)
  const sw = Math.min(canvas.width - sx, maxX - minX + 1 + pad * 2)
  const sh = Math.min(canvas.height - sy, maxY - minY + 1 + pad * 2)
  const cropped = document.createElement('canvas')
  cropped.width = sw
  cropped.height = sh
  cropped.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
  return cropped
}

export function paintExitSign(ctx, w, h, metalImg, arrowImg) {
  if (metalImg) {
    const scale = Math.max(w / metalImg.width, h / metalImg.height)
    const dw = metalImg.width * scale
    const dh = metalImg.height * scale
    ctx.drawImage(metalImg, (w - dw) / 2, (h - dh) / 2, dw, dh)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)'
    ctx.fillRect(0, 0, w, h)
    const sheen = ctx.createLinearGradient(0, 0, 0, h)
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
    sheen.addColorStop(0.4, 'rgba(255, 255, 255, 0)')
    sheen.addColorStop(1, 'rgba(0, 0, 0, 0.28)')
    ctx.fillStyle = sheen
    ctx.fillRect(0, 0, w, h)
  } else {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, w, h)
  }

  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'

  const lineH = Math.max(3, Math.round(h * 0.014))
  const lineY = Math.round(h * 0.026)
  const top = lineY + lineH
  const bot = h - lineY - lineH
  const inner = bot - top
  const gap = Math.round(w * 0.016)
  const left = Math.round(w * 0.022)
  const right = w - Math.round(w * 0.028)

  const glyph = (size, text) => {
    ctx.font = `700 ${Math.round(size)}px ${FONT}`
    const m = ctx.measureText(text)
    const a = m.actualBoundingBoxAscent
    const d = m.actualBoundingBoxDescent
    return {
      width: Math.max(m.width, 1),
      ascent: a > size * 0.45 && a < size * 1.1 ? a : size * 0.72,
      descent: d >= 0 && d < size * 0.3 ? d : size * 0.05,
    }
  }

  const arrowSize = inner
  if (arrowImg) {
    const aw = arrowImg.width
    const ah = arrowImg.height
    const scale = arrowSize / Math.max(aw, ah)
    const dw = aw * scale
    const dh = ah * scale
    const ax = left + (arrowSize - dw) / 2
    const ay = top + (arrowSize - dh) / 2
    ctx.save()
    ctx.translate(ax + dw / 2, ay + dh / 2)
    ctx.scale(1, -1)
    ctx.drawImage(arrowImg, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()
  }

  const redX = left + arrowSize + gap
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  if ('letterSpacing' in ctx) ctx.letterSpacing = '-0.055em'
  const bottomPad = Math.max(2, Math.round(inner * 0.016))
  let exitSize = inner
  let exit = glyph(exitSize, 'Exit')
  exitSize *= (inner - bottomPad) / (exit.ascent + exit.descent)
  exit = glyph(exitSize, 'Exit')

  const exitPadX = Math.round(inner * 0.045)
  const exitPadRight = Math.round(inner * 0.1)
  const maxRedW = Math.round(w * 0.48) - redX
  let redW = exit.width + exitPadX + exitPadRight
  if (redW > maxRedW) {
    exitSize *= (maxRedW - exitPadX - exitPadRight) / exit.width
    exit = glyph(exitSize, 'Exit')
    redW = maxRedW
  }
  ctx.fillStyle = EXIT_RED
  ctx.fillRect(redX, top, redW, inner)
  ctx.fillStyle = '#ffffff'
  ctx.fillText('Exit', redX + exitPadX, top + exit.ascent)

  const tx = redX + redW + Math.round(gap * 1.8)
  const maxName = right - tx
  if ('letterSpacing' in ctx) ctx.letterSpacing = '-0.05em'
  const namePadY = Math.max(8, Math.round(inner * 0.08))
  let nameSize = inner * 0.88
  let name = glyph(nameSize, 'metrotapes')
  const bulletR = (size) => size * 0.26
  const stackH = (nm, size) => nm.ascent + nm.descent + bulletR(size) * 2.55
  while (
    (name.width > maxName || stackH(name, nameSize) + namePadY > inner - 6) &&
    nameSize > 18
  ) {
    nameSize -= 2
    name = glyph(nameSize, 'metrotapes')
  }
  const br = bulletR(nameSize)
  ctx.fillText('metrotapes', tx, top + namePadY + name.ascent)

  const by = top + namePadY + name.ascent + name.descent + br * 1.15
  const bulletGap = Math.max(12, Math.round(br * 0.85))
  const bullets = [
    { x: tx + br, color: '#FCCC0A', letter: 'R', fg: '#000000' },
    { x: tx + br * 3 + bulletGap, color: '#FF6319', letter: 'F', fg: '#ffffff' },
  ]
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  bullets.forEach(({ x, color, letter, fg }) => {
    ctx.beginPath()
    ctx.arc(x, by, br, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.fillStyle = fg
    ctx.font = `700 ${Math.round(br * 1.28)}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(letter, x, by + br * 0.04)
  })

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, lineY, w, lineH)
  ctx.fillRect(0, bot, w, lineH)
}

export const STATION_MAP_REV = 6

export function useStationMaps() {
  const maps = useMemo(() => {
    const wallMap = makeColumnTexture(
      (ctx, tile, rows) => paintSubwayColumn(ctx, tile, rows, 'color'),
      64,
      WALL_ROWS,
      THREE.SRGBColorSpace,
    )
    wallMap.repeat.set(LEN / TILE, 1)

    const wallBump = makeColumnTexture(
      (ctx, tile, rows) => paintSubwayColumn(ctx, tile, rows, 'bump'),
      64,
      WALL_ROWS,
      THREE.NoColorSpace,
    )
    wallBump.repeat.set(LEN / TILE, 1)

    const wallRough = makeColumnTexture(
      (ctx, tile, rows) => paintSubwayColumn(ctx, tile, rows, 'rough'),
      64,
      WALL_ROWS,
      THREE.NoColorSpace,
    )
    wallRough.repeat.set(LEN / TILE, 1)

    const floorMap = makeCanvasTexture(paintConcrete, 256, THREE.SRGBColorSpace)
    floorMap.repeat.set(FLOOR_W / 1.8, LEN / 1.8)

    const ceilingMap = makeCanvasTexture(paintCeiling, 512, THREE.SRGBColorSpace)
    ceilingMap.repeat.set(FLOOR_W / 7.2, LEN / 13)
    ceilingMap.offset.set(0.17, 0.31)

    const steelMap = makeCanvasTexture(paintSteel, 256, THREE.SRGBColorSpace)
    steelMap.repeat.set(1.15, 0.9)

    const riserMap = makeCanvasTexture(paintRiser, 256, THREE.SRGBColorSpace)
    riserMap.repeat.set(LEN / 4.8, 1.15)

    const ballastMap = makeCanvasTexture(paintBallast, 256, THREE.SRGBColorSpace)
    ballastMap.repeat.set(TRACK_W / 2.2, LEN / 3.4)

    const yellowMap = makeCanvasTexture(paintTactile, 256, THREE.SRGBColorSpace)
    yellowMap.repeat.set(1.1, LEN / 2.6)

    return {
      wallMap,
      wallBump,
      wallRough,
      floorMap,
      ceilingMap,
      steelMap,
      riserMap,
      ballastMap,
      yellowMap,
      dispose() {
        wallMap.dispose()
        wallBump.dispose()
        wallRough.dispose()
        floorMap.dispose()
        ceilingMap.dispose()
        steelMap.dispose()
        riserMap.dispose()
        ballastMap.dispose()
        yellowMap.dispose()
      },
    }
  }, [])

  useLayoutEffect(() => () => maps.dispose(), [maps])
  return maps
}

function paintBallast(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const x = i % n
    const y = (i / n) | 0
    const a = hash01(i)
    const stone = hash01((x >> 2) * 89 + (y >> 2) * 47)
    const grit = hash01(i * 7 + 3)
    const v = 14 + a * 26 + stone * 12 + grit * 8
    data[j] = v + 10
    data[j + 1] = v + 2
    data[j + 2] = Math.max(8, v - 6)
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  for (let k = 0; k < 28; k += 1) {
    const x = Math.floor(hash01(k * 17) * n)
    const y = Math.floor(hash01(k * 29 + 4) * n)
    ctx.fillStyle = `rgba(8,6,4,${0.2 + hash01(k) * 0.22})`
    ctx.beginPath()
    ctx.ellipse(x, y, 6 + (k % 10), 3 + (k % 6), hash01(k * 3) * 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(92, 68, 42, 0.22)'
  for (let k = 0; k < 50; k += 1) {
    ctx.fillRect(Math.floor(hash01(k * 61) * n), Math.floor(hash01(k * 43 + 2) * n), 1 + (k % 2), 1)
  }
}

export function paintRoofRibs(ctx, n) {
  for (let y = 0; y < n; y += 1) {
    const rib = Math.sin(y * 0.55) * 14
    // Lighter silver so the roof reads against the dark station ceiling
    const v = Math.max(120, 178 + rib + ((y * 7) % 5))
    ctx.fillStyle = `rgb(${v + 6},${v + 5},${v + 2})`
    ctx.fillRect(0, y, n, 1)
  }
  // Soft highlight band down the crown
  const sheen = ctx.createLinearGradient(0, 0, n, 0)
  sheen.addColorStop(0, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.22)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, n, n)
  // Seam / dirt lines along length (keep subtle)
  ctx.fillStyle = 'rgba(40,36,32,0.12)'
  for (let i = 0; i < 6; i += 1) {
    ctx.fillRect(0, (i * 41) % n, n, 2)
  }
}

export function paintWood(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const y = (i / n) | 0
    const x = i % n
    const stripe = Math.sin(y * 0.07) * 32 + Math.sin(y * 0.22 + x * 0.012) * 14
    const pore = hash01(i) * 18 - 8
    const band = hash01((y >> 3) * 23) * 16 - 7
    const v = 112 + stripe + pore + band
    data[j] = Math.max(78, Math.min(210, v + 34))
    data[j + 1] = Math.max(58, Math.min(158, v - 2))
    data[j + 2] = Math.max(22, Math.min(72, v - 68))
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  ctx.lineCap = 'round'
  for (let k = 0; k < 14; k += 1) {
    const x = 8 + (k * 41) % (n - 16)
    ctx.strokeStyle = `rgba(62, 34, 12, ${0.18 + (k % 5) * 0.07})`
    ctx.lineWidth = 1.4 + (k % 4) * 0.9
    ctx.beginPath()
    ctx.moveTo(x, 0)
    for (let y = 0; y <= n; y += 6) {
      ctx.lineTo(x + Math.sin(y * 0.022 + k * 1.1) * 5.5, y)
    }
    ctx.stroke()
  }
  for (let k = 0; k < 9; k += 1) {
    const cx = Math.floor(hash01(k * 41) * n)
    const cy = Math.floor(hash01(k * 17 + 3) * n)
    const r = 8 + hash01(k * 7) * 14
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, 'rgba(52, 30, 12, 0.55)')
    g.addColorStop(0.4, 'rgba(96, 58, 24, 0.28)')
    g.addColorStop(1, 'rgba(110, 72, 32, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(cx, cy, r * 0.5, r, hash01(k) * 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(228, 190, 118, 0.2)'
  for (let k = 0; k < 12; k += 1) {
    ctx.fillRect(Math.floor(hash01(k * 19) * n), Math.floor(hash01(k * 31) * n), 28 + (k % 18), 3 + (k % 4))
  }
}

/** Painted kiosk plastic — grain + scuffs, not a photo wrap. */
export function paintKioskPlastic(ctx, n) {
  ctx.fillStyle = '#b7b8b2'
  ctx.fillRect(0, 0, n, n)
  const img = ctx.getImageData(0, 0, n, n)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const speckle = (Math.random() - 0.5) * 28
    d[i] = Math.max(0, Math.min(255, d[i] + speckle))
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + speckle))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + speckle * 0.8))
  }
  ctx.putImageData(img, 0, 0)
  ctx.lineCap = 'round'
  for (let k = 0; k < 22; k += 1) {
    ctx.strokeStyle = `rgba(24,24,22,${0.07 + (k % 4) * 0.035})`
    ctx.lineWidth = 0.6 + (k % 3) * 0.45
    const x = (k * 37) % n
    ctx.beginPath()
    ctx.moveTo(x, 0)
    for (let y = 0; y <= n; y += 8) {
      ctx.lineTo(x + Math.sin(y * 0.045 + k) * 3.2, y)
    }
    ctx.stroke()
  }
}

export function paintKioskRough(ctx, n) {
  ctx.fillStyle = '#8c8c88'
  ctx.fillRect(0, 0, n, n)
  for (let i = 0; i < 1400; i += 1) {
    const light = Math.random() > 0.45
    ctx.fillStyle = light
      ? `rgba(230,230,224,${0.08 + Math.random() * 0.12})`
      : `rgba(22,22,20,${0.1 + Math.random() * 0.14})`
    ctx.fillRect(Math.random() * n, Math.random() * n, 1 + Math.random() * 3, 1)
  }
  for (let k = 0; k < 28; k += 1) {
    ctx.strokeStyle = `rgba(18,18,16,${0.16 + (k % 3) * 0.1})`
    ctx.lineWidth = 0.5
    const x = (k * 29) % n
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + (k % 5 - 2) * 10, n)
    ctx.stroke()
  }
}

export const HOSE = { color: '#2c1c12', roughness: 0.78, metalness: 0.22 }
