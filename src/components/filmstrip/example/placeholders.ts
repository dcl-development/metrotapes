import type { FilmstripImage } from '../Filmstrip'

const SWATCHES = ['#f5c518', '#2f6fed', '#e23d3d', '#1f8a4c', '#f6f3ec', '#1a1a1a']

/** Offline SVG frames. Swap these for real `{ src, alt }` photos. */
export function sampleFrames(count = 8): FilmstripImage[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1
    const bg = SWATCHES[i % SWATCHES.length]
    const ink = bg === '#1a1a1a' ? '#f6f3ec' : '#1a1a1a'
    const label = `Sample ${String(n).padStart(2, '0')}`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="${bg}"/>
      <text x="40" y="80" fill="${ink}" font-family="Helvetica, Arial, sans-serif" font-size="28" letter-spacing="4">${label.toUpperCase()}</text>
      <text x="400" y="340" fill="${ink}" font-family="Helvetica, Arial, sans-serif" font-size="120" text-anchor="middle">${String(n).padStart(2, '0')}</text>
    </svg>`
    return {
      src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
      alt: `Sample frame ${n}`,
      width: 800,
      height: 600,
      aspect: 4 / 3,
      caption: n === 1 ? 'Placeholder frame. Pass your own images in.' : undefined,
    }
  })
}
