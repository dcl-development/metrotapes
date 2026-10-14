import styled from 'styled-components'

/**
 * Gilded frame (1378×1142). The opening is the largest fully clear
 * rectangle in the alpha (x 209–1170, y 228–908), not the decorative
 * cutouts above the beading. The photo covers that hole; the ornament
 * sits on top. The shell keeps the file's aspect so it scales without
 * stretching.
 */
const FRAME_W = 1378
const FRAME_H = 1142
const FRAME_ASPECT = FRAME_W / FRAME_H
const FRAME_INSET = {
  left: `${(209 / FRAME_W) * 100}%`,
  right: `${((FRAME_W - 1171) / FRAME_W) * 100}%`,
  top: `${(228 / FRAME_H) * 100}%`,
  bottom: `${((FRAME_H - 909) / FRAME_H) * 100}%`,
}

const Shell = styled.button`
  position: relative;
  display: block;
  width: min(100%, calc(100cqh * ${FRAME_ASPECT}));
  max-width: 100%;
  max-height: 100%;
  aspect-ratio: ${FRAME_ASPECT};
  height: auto;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  filter: drop-shadow(0 18px 40px rgba(0, 0, 0, 0.6));

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
  overflow: hidden;
  background: transparent;
`

const FrameArt = styled.picture`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 3;
  user-select: none;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
  }
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
  caption = '',
  children,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  'aria-label': ariaLabel,
}) {
  return (
    <Shell
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label={ariaLabel}
    >
      <Well>{children}</Well>
      <FrameArt>
        <source srcSet="/ornate-frame.webp" type="image/webp" />
        <img src="/ornate-frame.png" alt="" draggable={false} />
      </FrameArt>
      {caption ? <Caption>{caption}</Caption> : null}
    </Shell>
  )
}
