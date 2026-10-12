import { urlFor } from './sanity.js'

const PHOTO_WIDTHS = [640, 960, 1280, 1600]

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

/** One srcset for a gallery photo. Skips widths above the original file. */
export function photoSources(photo, sizes = '(max-width: 768px) 92vw, 720px') {
  const native = Number(photo?.width) || 1600
  const widths = PHOTO_WIDTHS.filter((width) => width <= native + 40)
  const use = widths.length ? widths : [Math.min(960, Math.max(1, native))]
  const srcWidth = use[Math.min(1, use.length - 1)]
  return {
    src: imageUrl(photo, { width: srcWidth }),
    srcSet: imageSrcSet(photo, use),
    sizes,
    width: Number(photo?.width) || srcWidth,
    height: Number(photo?.height) || Math.round(srcWidth * 0.75),
  }
}

export function stripThumb(photo) {
  return {
    src: imageUrl(photo, { width: 240, height: 180, fit: 'crop' }),
    width: 240,
    height: 180,
  }
}
