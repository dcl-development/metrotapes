import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { fitFrame } from '../lib/stationFrame'

/**
 * Carved gold frame PNG (transparent opening), stretched so the
 * opening matches the photo aspect. Fills its parent as large as possible.
 */
const OPEN_W = 0.6106
const OPEN_H = 0.6516
const FRAME_INSET = {
  left: '19.19%',
  right: '19.75%',
  top: '21.19%',
  bottom: '13.64%',
}

const Shell = styled.button`
  position: relative;
  display: block;
  /* Fallback until the stage is measured. JS then fits the box to the stage. */
  width: min(100%, calc(100cqh * ${(p) => p.$frameAspect}));
  max-width: 100%;
  max-height: 100%;
  aspect-ratio: ${(p) => p.$frameAspect};
  height: auto;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.45));
  transition: width 0.7s ease, height 0.7s ease;

  &:focus-visible {
    outline: 2px solid #c4a06a;
    outline-offset: 6px;
  }
`

const Well = styled.div`
  position: absolute;
  left: ${FRAME_INSET.left};
  right: ${FRAME_INSET.right};
  top: ${FRAME_INSET.top};
  bottom: ${FRAME_INSET.bottom};
  background: #0a0806;
  overflow: hidden;
`

const FrameArt = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
  z-index: 3;
  user-select: none;
`

const Caption = styled.div`
  position: absolute;
  left: 50%;
  bottom: 2.2%;
  transform: translateX(-50%);
  z-index: 4;
  padding: 3px 12px 4px;
  background: linear-gradient(180deg, #3a2a18, #1a120c);
  border: 1px solid rgba(196, 160, 106, 0.55);
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #e8d2a8;
  white-space: nowrap;
  pointer-events: none;
`

export default function OrnatePhotoFrame({
  aspect = 4 / 3,
  caption = '',
  children,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  'aria-label': ariaLabel,
}) {
  const photoAspect = Number.isFinite(aspect) && aspect > 0.2 && aspect < 5 ? aspect : 4 / 3
  const frameAspect = photoAspect * (OPEN_H / OPEN_W)
  const shellRef = useRef(null)
  const [box, setBox] = useState(null)

  useEffect(() => {
    const parent = shellRef.current?.parentElement
    if (!parent) return undefined
    const apply = () => {
      const rect = parent.getBoundingClientRect()
      const next = fitFrame(rect.width - 8, rect.height - 8, frameAspect)
      setBox(next.width > 0 ? next : null)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(parent)
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
    }
  }, [frameAspect])

  return (
    <Shell
      ref={shellRef}
      type="button"
      $frameAspect={frameAspect}
      style={box ? { width: `${box.width}px`, height: `${box.height}px`, maxWidth: '100%', maxHeight: '100%' } : undefined}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label={ariaLabel}
    >
      <Well>{children}</Well>
      <FrameArt src="/photo-frame.png?v=5" alt="" width={719} height={821} draggable={false} />
      {caption ? <Caption>{caption}</Caption> : null}
    </Shell>
  )
}
