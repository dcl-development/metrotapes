import imageUrlBuilder from '@sanity/image-url'

// Builds cdn.sanity.io URLs locally from the asset ref. This does not call the Sanity API.
// Photos, about, and posts are loaded from /api/photos, /api/about, and /api/posts.
// Those routes project alt plus width and height so the photo page can size srcsets.
// Project id and dataset are public (they are part of every image URL).
// Do not put a write-capable Sanity token in VITE_* — it would ship in the JS bundle.
const env = import.meta.env ?? {}
const projectId = env.VITE_SANITY_PROJECT_ID || 'l3itmzli'
const dataset = env.VITE_SANITY_DATASET || 'production'

const builder = imageUrlBuilder({ projectId, dataset })

export const urlFor = (source) => {
  if (!source?.asset) return ''
  return builder.image(source)
}

export function imageAlt(image, fallback) {
  const alt = image?.alt || image?.altText || image?.asset?.altText
  if (typeof alt === 'string' && alt.trim()) return alt.trim()
  return fallback
}
