import { css } from 'styled-components'

/**
 * What already exists — not a new look.
 *
 * Layers, back → front:
 *   station scene → page content → header (z 100)
 *
 * Route colors match the machine buttons and header pills.
 * Line bullets bounce inside the MetroCard machine LCD (LineBounceField).
 */
export const station = '#1A1A1A'

export const route = {
  photo: '#0039A6',
  video: '#00933C',
  about: '#996633',
}

export const font = '"Helvetica Neue", Helvetica, Arial, sans-serif'
/** Wall title strips + kiosk dest plates — Helvetica Bold, not Neue. */
export const signage = 'Helvetica, "Helvetica Neue", "Arial Black", Arial, sans-serif'

/**
 * Same press as the metrotapes home title:
 * a little bigger on hover, back to normal on click.
 */
export const cushy = css`
  cursor: pointer;
  transform-origin: center;
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);

  &:hover {
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.94);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`
