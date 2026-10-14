import { useEffect, useMemo, useRef, useState } from 'react'
import styled, { keyframes, css } from 'styled-components'
import { font, station } from '../styles/theme'
import { BOOT_PLAY_MS } from '../lib/bootGate'
import { SUBWAY_LINES } from '../lib/subwayLines'

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`

const Root = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
  background: ${station};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  ${(p) => p.$leaving && css`
    animation: ${fadeOut} 0.55s ease forwards;
    pointer-events: none;
  `}
`

const Frame = styled.div`
  position: relative;
  width: ${(p) => p.$w}px;
  height: ${(p) => p.$h}px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const Rows = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
`

const Row = styled.div`
  display: flex;
  justify-content: center;
  gap: 5px;
`

const Bullet = styled.div`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${font};
  font-weight: 800;
  font-size: ${(p) => (p.$compact ? '0.38rem' : '0.65rem')};
  letter-spacing: ${(p) => (p.$compact ? '-0.05em' : '0')};
  line-height: 1;
  color: ${(p) => p.$fg};
  background: ${(p) => p.$bg};
`

const Outline = styled.svg`
  position: absolute;
  inset: 0;
  overflow: visible;
  pointer-events: none;
`

/** Off-screen label so the loader still announces without visible copy. */
const SrOnly = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`

/** Full current set. Two rows, split in half by the existing ceil. */
const BOOT_LINES = SUBWAY_LINES

const BULLET = 22
const GAP = 5
const PAD_X = 16
const PAD_Y = 14
const INSET = 1.75
const RADIUS = 12
const DIM = '#4a3b0c'
const BRIGHT = '#FCCC0A'

function rowWidth(count) {
  if (count <= 0) return 0
  return count * BULLET + (count - 1) * GAP
}

/** Clockwise rounded rect starting at the top center, so the dash grows from there. */
function outlinePath(x, y, w, h, r) {
  const cx = x + w / 2
  return [
    `M ${cx} ${y}`,
    `H ${x + w - r}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    `H ${cx}`,
  ].join(' ')
}

function outlineLength(w, h, r) {
  return 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r
}

function mixYellow(t) {
  const u = Math.min(1, Math.max(0, t))
  const a = [0x4a, 0x3b, 0x0c]
  const b = [0xfc, 0xcc, 0x0a]
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * u))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

export default function BootScreen({ leaving = false }) {
  const glowRef = useRef(null)
  const [reduced] = useState(() => (
    typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ))
  const topCount = Math.ceil(BOOT_LINES.length / 2)
  const topLines = BOOT_LINES.slice(0, topCount)
  const bottomLines = BOOT_LINES.slice(topCount)
  const frame = useMemo(() => {
    const innerW = Math.max(rowWidth(topLines.length), rowWidth(bottomLines.length))
    const innerH = BULLET * 2 + GAP
    const w = innerW + PAD_X * 2
    const h = innerH + PAD_Y * 2
    const pathW = w - INSET * 2
    const pathH = h - INSET * 2
    return {
      w,
      h,
      d: outlinePath(INSET, INSET, pathW, pathH, RADIUS),
      len: outlineLength(pathW, pathH, RADIUS),
    }
  }, [topLines.length, bottomLines.length])

  useEffect(() => {
    const node = glowRef.current
    if (!node) return undefined
    const { len } = frame
    node.style.strokeDasharray = `${len} ${len}`
    const paint = (p) => {
      const u = Math.min(1, Math.max(0, p))
      node.style.strokeDashoffset = String(len * (1 - u))
      node.setAttribute('stroke', mixYellow(0.35 + u * 0.65))
      node.style.filter = `drop-shadow(0 0 ${2 + u * 3}px rgba(252, 204, 10, ${0.35 + u * 0.6}))`
    }
    if (reduced || leaving) {
      paint(1)
      return undefined
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / BOOT_PLAY_MS)
      paint(1 - (1 - p) ** 2)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame, leaving, reduced])

  return (
    <Root
      $leaving={leaving}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <SrOnly>Loading</SrOnly>
      <Frame $w={frame.w} $h={frame.h}>
        <Outline viewBox={`0 0 ${frame.w} ${frame.h}`} aria-hidden="true">
          <defs>
            <filter id="boot-neon" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d={frame.d}
            fill="none"
            stroke={DIM}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            ref={glowRef}
            d={frame.d}
            fill="none"
            stroke={reduced || leaving ? BRIGHT : DIM}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${frame.len} ${frame.len}`}
            strokeDashoffset={reduced || leaving ? 0 : frame.len}
            filter="url(#boot-neon)"
          />
        </Outline>
        <Rows aria-hidden="true">
          <Row>
            {topLines.map((line) => (
              <Bullet key={line.line} $bg={line.color} $fg={line.textColor} $compact={line.line.length > 1}>
                {line.line}
              </Bullet>
            ))}
          </Row>
          <Row>
            {bottomLines.map((line) => (
              <Bullet key={line.line} $bg={line.color} $fg={line.textColor} $compact={line.line.length > 1}>
                {line.line}
              </Bullet>
            ))}
          </Row>
        </Rows>
      </Frame>
    </Root>
  )
}
