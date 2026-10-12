import { allowContentRequest } from './contentGuard.js'
import { readSanityConfig } from './sanityClient.js'
import { loadAbout, loadPhotos, loadPosts } from './sanityContent.js'

/**
 * Browser cache stays at the Vercel default (s-maxage is for the CDN).
 * One minute fresh, then a day of stale-while-revalidate so a Sanity
 * blip still serves the last good payload.
 */
export const CONTENT_CACHE_CONTROL = 's-maxage=60, stale-while-revalidate=86400'

export async function runContentRequest(req, load, label) {
  const guard = allowContentRequest(req)
  if (!guard.ok) {
    const headers = {}
    if (guard.status === 405) headers.Allow = 'GET'
    if (guard.status === 429) headers['Retry-After'] = '60'
    return { status: guard.status, body: guard.body, headers }
  }

  try {
    const result = await load()
    const headers = {}
    if (result.status === 200) headers['Cache-Control'] = CONTENT_CACHE_CONTROL
    return { status: result.status, body: result.body, headers }
  } catch (error) {
    console.error(`${label} api`, error)
    return {
      status: 500,
      body: { detail: error?.message || 'Could not load content.' },
      headers: {},
    }
  }
}

function runLoaded(req, env, load, label) {
  return runContentRequest(req, () => load(readSanityConfig(env)), label)
}

export function runPhotos(req, env = process.env) {
  return runLoaded(req, env, loadPhotos, 'photos')
}

export function runAbout(req, env = process.env) {
  return runLoaded(req, env, loadAbout, 'about')
}

export function runPosts(req, env = process.env) {
  return runLoaded(req, env, loadPosts, 'posts')
}
