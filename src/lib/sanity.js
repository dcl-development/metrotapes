import imageUrlBuilder from '@sanity/image-url'

// Builds cdn.sanity.io URLs locally from the asset ref. This does not call the Sanity API.
// Photos and about are loaded from /api/photos and /api/about.
// Those routes project alt plus width and height so the photo page can size srcsets.
// Project id and dataset are public (they are part of every image URL).
// Read each VITE_* key by name. Don't read `import.meta.env` as a whole object
// in browser code: Vite then inlines every VITE_* variable into the bundle.
const projectId = import.meta.env?.VITE_SANITY_PROJECT_ID || 'l3itmzli'
const dataset = import.meta.env?.VITE_SANITY_DATASET || 'production'

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
