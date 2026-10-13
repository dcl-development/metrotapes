import { useEffect, useRef } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { KIOSK_PANEL_W, KIOSK_PANEL_H, KIOSK_RADIUS_PX } from '../lib/kioskSize'
import KioskScreen from './KioskScreen'

const ZAP_MS = 520

const MASK_CLOSED = 'radial-gradient(circle at 50% 50%, transparent 0%, #000 0%)'
const MASK_OPEN = 'radial-gradient(circle at 50% 50%, transparent 150%, #000 150%)'

const Root = styled.div`
  position: relative;
  width: ${KIOSK_PANEL_W}px;
  height: ${KIOSK_PANEL_H}px;
  overflow: hidden;
  border-radius: ${KIOSK_RADIUS_PX}px;
  background: #000;
`

const MenuLayer = styled.div`
  position: absolute;
  inset: 0;
`

const zapOpen = keyframes`
  from {
    -webkit-mask-image: ${MASK_CLOSED};
    mask-image: ${MASK_CLOSED};
  }
  to {
    -webkit-mask-image: ${MASK_OPEN};
    mask-image: ${MASK_OPEN};
  }
`

const zapClose = keyframes`
  from {
    -webkit-mask-image: ${MASK_OPEN};
    mask-image: ${MASK_OPEN};
  }
  to {
    -webkit-mask-image: ${MASK_CLOSED};
    mask-image: ${MASK_CLOSED};
  }
`

const Cover = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  pointer-events: ${(p) => (p.$phase === 'open' ? 'none' : 'auto')};
  opacity: ${(p) => (p.$phase === 'open' ? 0 : 1)};
  -webkit-mask-image: ${(p) => {
    if (p.$phase === 'open') return MASK_OPEN
    if (p.$phase === 'closed') return MASK_CLOSED
    return undefined
  }};
  mask-image: ${(p) => {
    if (p.$phase === 'open') return MASK_OPEN
    if (p.$phase === 'closed') return MASK_CLOSED
    return undefined
  }};
  ${(p) => {
    if (p.$reduced) return css`animation: none;`
    if (p.$phase === 'opening') {
      return css`
        animation: ${zapOpen} ${ZAP_MS}ms cubic-bezier(0.2, 0.75, 0.25, 1) forwards;
      `
    }
    if (p.$phase === 'closing') {
      return css`
        animation: ${zapClose} ${ZAP_MS}ms cubic-bezier(0.55, 0.05, 0.7, 0.3) forwards;
      `
    }
    return css`animation: none;`
  }}
`

const Logo = styled.img`
  width: 132px;
  height: auto;
  display: block;
  user-select: none;
  pointer-events: none;
`

/**
 * @param {'closed'|'opening'|'open'|'closing'} phase
 */
export default function KioskZapScreen({
  phase = 'closed',
  live = false,
  reducedMotion = false,
  onPhaseEnd,
}) {
  const ended = useRef(false)

  useEffect(() => {
    ended.current = false
    if (phase !== 'opening' && phase !== 'closing') return undefined
    const ms = reducedMotion ? 0 : ZAP_MS + 40
    const t = window.setTimeout(() => {
      if (ended.current) return
      ended.current = true
      onPhaseEnd?.(phase)
    }, ms)
    return () => window.clearTimeout(t)
  }, [phase, reducedMotion, onPhaseEnd])

  return (
    <Root>
      <MenuLayer>
        <KioskScreen live={live && phase === 'open'} />
      </MenuLayer>
      <Cover
        $phase={phase}
        $reduced={reducedMotion}
        onAnimationEnd={(e) => {
          if (e.target !== e.currentTarget) return
          if (ended.current) return
          ended.current = true
          onPhaseEnd?.(phase)
        }}
      >
        <Logo src="/mta-logo.jpg" alt="MTA" width={132} height={74} />
      </Cover>
    </Root>
  )
}
