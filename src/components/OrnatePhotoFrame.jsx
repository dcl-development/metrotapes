import styled from 'styled-components'

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
  /* Fill the stage: as big as container allows while keeping opening aspect. */
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
  filter: drop-shadow(0 18px 40px rgba(0, 0, 0, 0.6));
  transition: width 0.7s ease, aspect-ratio 0.7s ease;

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

  return (
    <Shell
      type="button"
      $frameAspect={frameAspect}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label={ariaLabel}
    >
      <Well>{children}</Well>
      <FrameArt src="/photo-frame.png" alt="" draggable={false} />
      {caption ? <Caption>{caption}</Caption> : null}
    </Shell>
  )
}
