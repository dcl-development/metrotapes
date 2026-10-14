import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { stepLineBullet } from '../lib/lineBounce'
import { SUBWAY_LINES } from '../lib/subwayLines'

const Field = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
`

const Circle = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: 800;
  font-size: ${(p) => p.$size * (p.$compact ? 0.28 : 0.52)}px;
  letter-spacing: ${(p) => (p.$compact ? '-0.04em' : '0')};
  line-height: 1;
  color: ${(p) => p.$textColor || 'white'};
  background-color: ${(p) => p.$color};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  opacity: 0.72;
`

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * Bouncing MTA line bullets, scoped to a parent box (e.g. MetroCard LCD).
 */
export default function LineBounceField({ size = 16, speed = 1.15 }) {
  const reducedMotion = usePrefersReducedMotion()
  const fieldRef = useRef(null)
  const nodeRefs = useRef([])
  const motionRef = useRef(null)
  const [placed] = useState(() =>
    SUBWAY_LINES.map((line, id) => ({
      ...line,
      id,
      x: Math.random() * 80,
      y: Math.random() * 40,
      vx: (Math.random() - 0.5) * 1.6,
      vy: (Math.random() - 0.5) * 1.6,
    })),
  )

  if (!motionRef.current) {
    motionRef.current = placed.map(({ x, y, vx, vy }) => ({ x, y, vx, vy }))
  }

  useEffect(() => {
    if (reducedMotion) return undefined
    const field = fieldRef.current
    if (!field) return undefined

    let frame = 0
    let alive = true
    const bounds = { width: 0, height: 0, size }

    const tick = () => {
      if (!alive) return
      bounds.width = field.clientWidth
      bounds.height = field.clientHeight
      // display:none (intro, off-screen kiosk) measures 0×0. Stepping then
      // damps every bullet to the corner. Wait for a real box.
      if (bounds.width <= size || bounds.height <= size) return

      const motion = motionRef.current
      for (let i = 0; i < motion.length; i += 1) {
        const next = stepLineBullet(motion[i], bounds, speed)
        motion[i] = next
        const node = nodeRefs.current[i]
        if (node) node.style.transform = `translate(${next.x}px, ${next.y}px)`
      }

      frame = requestAnimationFrame(tick)
    }

    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(tick)
    }

    const observer = new ResizeObserver(onResize)
    observer.observe(field)
    onResize()
    return () => {
      alive = false
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [reducedMotion, size, speed])

  return (
    <Field ref={fieldRef} aria-hidden="true">
      {placed.map((bubble, index) => (
        <Circle
          key={bubble.id}
          ref={(el) => { nodeRefs.current[index] = el }}
          $size={size}
          $color={bubble.color}
          $textColor={bubble.textColor}
          $compact={bubble.line.length > 1}
          style={{ transform: `translate(${bubble.x}px, ${bubble.y}px)` }}
        >
          {bubble.line}
        </Circle>
      ))}
    </Field>
  )
}
