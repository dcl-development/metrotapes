import { createSanityClient } from './sanityClient.js'

/** Same projection the photo page used to run in the browser. */
export const PHOTOS_QUERY = `*[_type == "photos"][0].images[]{
  ...,
  "alt": coalesce(alt, asset->altText),
  "width": asset->metadata.dimensions.width,
  "height": asset->metadata.dimensions.height
}`

/** Same projection the about page used to run in the browser. */
export const ABOUT_QUERY = `*[_type == "about"][0]{
  title,
  description,
  instagramUrl,
  photo1{..., "alt": coalesce(alt, asset->altText), "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height},
  photo2{..., "alt": coalesce(alt, asset->altText), "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height}
}`

/** Same projection the blog page used to run in the browser. */
export const POSTS_QUERY = `*[_type == "post"] | order(publishedAt desc) {
      title,
      description,
      publishedAt,
      media[]{
        type,
        alt,
        "image": image{
          asset
        },
        url,
        videoUrl,
        instagramPost
      }
    }`

async function defaultFetchQuery(config, query) {
  const client = createSanityClient(config)
  return client.fetch(query)
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

export async function loadPhotos(config, deps = {}) {
  const fetchQuery = deps.fetchQuery || defaultFetchQuery
  const photos = asArray(await fetchQuery(config, PHOTOS_QUERY))
  return { status: 200, body: { photos } }
}

export async function loadAbout(config, deps = {}) {
  const fetchQuery = deps.fetchQuery || defaultFetchQuery
  const about = await fetchQuery(config, ABOUT_QUERY)
  return { status: 200, body: { about: about || null } }
}

export async function loadPosts(config, deps = {}) {
  const fetchQuery = deps.fetchQuery || defaultFetchQuery
  const posts = asArray(await fetchQuery(config, POSTS_QUERY))
  return { status: 200, body: { posts } }
}
