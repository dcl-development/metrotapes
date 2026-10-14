import styled from 'styled-components'

/**
 * Gilded frame (1378×1142). The clear opening is x 209–1170, y 228–908.
 * The shell's aspect follows the photo so that opening matches it exactly.
 * Corners are sliced from the file and scaled uniformly; only the straight
 * edges stretch. The photo sits in the opening, uncropped.
 */
const IMG_W = 1378
const IMG_H = 1142
const SL = { l: 209, r: 207, t: 228, b: 233 }
const OPEN_W = IMG_W - SL.l - SL.r
const OPEN_H = IMG_H - SL.t - SL.b

const PIECES = [
  { area: 'tl', sx: 0, sy: 0, sw: SL.l, sh: SL.t },
  { area: 't', sx: SL.l, sy: 0, sw: OPEN_W, sh: SL.t },
  { area: 'tr', sx: IMG_W - SL.r, sy: 0, sw: SL.r, sh: SL.t },
  { area: 'l', sx: 0, sy: SL.t, sw: SL.l, sh: OPEN_H },
  { area: 'r', sx: IMG_W - SL.r, sy: SL.t, sw: SL.r, sh: OPEN_H },
  { area: 'bl', sx: 0, sy: IMG_H - SL.b, sw: SL.l, sh: SL.b },
  { area: 'b', sx: SL.l, sy: IMG_H - SL.b, sw: OPEN_W, sh: SL.b },
  { area: 'br', sx: IMG_W - SL.r, sy: IMG_H - SL.b, sw: SL.r, sh: SL.b },
]

function frameFor(photoAspect) {
  const A = Number.isFinite(photoAspect) && photoAspect > 0.2 && photoAspect < 5 ? photoAspect : 4 / 3
  const frameW = A + (SL.l + SL.r) / OPEN_H
  const frameH = 1 + (SL.t + SL.b) / OPEN_H
  const left = (SL.l / OPEN_H) / frameW
  const right = (SL.r / OPEN_H) / frameW
  const top = (SL.t / OPEN_H) / frameH
  const bottom = (SL.b / OPEN_H) / frameH
  return {
    aspect: frameW / frameH,
    columns: `${left * 100}% 1fr ${right * 100}%`,
    rows: `${top * 100}% 1fr ${bottom * 100}%`,
  }
}

/** Align a source slice so it covers its cell. Percentage background-position
 *  maps the slice origin onto the cell origin, including stretched edges. */
function slicePos(offset, size, total) {
  if (size >= total) return '0%'
  return `${(offset / (total - size)) * 100}%`
}

const Shell = styled.button`
  position: relative;
  display: grid;
  grid-template-columns: ${(p) => p.$columns};
  grid-template-rows: ${(p) => p.$rows};
  grid-template-areas:
    'tl t tr'
    'l well r'
    'bl b br';
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
  pointer-events: auto;
  z-index: 1;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:focus-visible {
    outline: 2px solid #c4a06a;
    outline-offset: 6px;
  }
`

const Piece = styled.div`
  grid-area: ${(p) => p.$area};
  pointer-events: none;
  z-index: 3;
  background-image: url('/ornate-frame.png');
  background-image: image-set(
    url('/ornate-frame.webp') type('image/webp'),
    url('/ornate-frame.png') type('image/png')
  );
  background-repeat: no-repeat;
  background-size: ${(p) => `${(IMG_W / p.$sw) * 100}% ${(IMG_H / p.$sh) * 100}%`};
  background-position: ${(p) => `${slicePos(p.$sx, p.$sw, IMG_W)} ${slicePos(p.$sy, p.$sh, IMG_H)}`};
`

const Well = styled.div`
  grid-area: well;
  position: relative;
  overflow: hidden;
  background: transparent;
  z-index: 1;
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
  const frame = frameFor(aspect)

  return (
    <Shell
      type="button"
      $frameAspect={frame.aspect}
      $columns={frame.columns}
      $rows={frame.rows}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label={ariaLabel}
    >
      {PIECES.map((piece) => (
        <Piece
          key={piece.area}
          $area={piece.area}
          $sx={piece.sx}
          $sy={piece.sy}
          $sw={piece.sw}
          $sh={piece.sh}
        />
      ))}
      <Well>{children}</Well>
      {caption ? <Caption>{caption}</Caption> : null}
    </Shell>
  )
}
