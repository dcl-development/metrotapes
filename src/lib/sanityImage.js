import { urlFor } from './sanity.js'

/** Largest file the gilded frame may request. The strip never uses this. */
const FRAME_MAX = 1200
const FRAME_STOPS = [640, 960, FRAME_MAX]

export function imageUrl(source, { width, height, fit, quality = 72 } = {}) {
  if (!source?.asset) return ''
  let image = urlFor(source).auto('format').quality(quality)
  if (width) image = image.width(Math.round(width))
  if (height) image = image.height(Math.round(height))
  if (fit) image = image.fit(fit)
  return image.url()
}

export function imageSrcSet(source, widths, options = {}) {
  return widths
    .map((width) => {
      const url = imageUrl(source, { ...options, width })
      return url ? `${url} ${Math.round(width)}w` : ''
    })
    .filter(Boolean)
    .join(', ')
}

/** One srcset for a gallery photo. Never asks above {@link FRAME_MAX}. */
export function photoSources(photo, sizes = '(max-width: 768px) 92vw, 720px') {
  const native = Number(photo?.width) || FRAME_MAX
  const widths = FRAME_STOPS.filter((width) => width <= native + 40)
  const use = widths.length ? widths : [Math.min(FRAME_MAX, Math.max(1, native))]
  const srcWidth = use[Math.min(1, use.length - 1)]
  return {
    src: imageUrl(photo, { width: srcWidth }),
    srcSet: imageSrcSet(photo, use),
    sizes,
    width: Number(photo?.width) || srcWidth,
    height: Number(photo?.height) || Math.round(srcWidth * 0.75),
  }
}

/**
 * One URL for the big frame. Picks a stop from the viewport, then caps at
 * the file and at 1200 so a 2× desktop cannot pull the original.
 */
export function framePhotoWidth(viewport = 1200, dpr = 1) {
  const view = Number.isFinite(viewport) && viewport > 0 ? viewport : 1200
  const density = Number.isFinite(dpr) && dpr > 0 ? Math.min(dpr, 2) : 1
  const px = Math.min(view * 0.92, 1100) * density
  for (const stop of FRAME_STOPS) {
    if (stop >= px) return stop
  }
  return FRAME_MAX
}

export function framePhotoUrl(photo, width = FRAME_MAX) {
  const native = Number(photo?.width) || 0
  const asked = Number.isFinite(width) && width > 0 ? width : FRAME_MAX
  const cap = native > 0 ? Math.min(asked, native, FRAME_MAX) : Math.min(asked, FRAME_MAX)
  return imageUrl(photo, { width: Math.max(1, Math.round(cap)) })
}

/** Film-strip window. Small enough that a slice never fetches the frame file. */
export function filmThumb(photo) {
  return imageUrl(photo, { width: 320, quality: 60 })
}

export function stripThumb(photo) {
  return {
    src: imageUrl(photo, { width: 240, height: 180, fit: 'crop' }),
    width: 240,
    height: 180,
  }
}
