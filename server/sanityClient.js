import { createClient } from '@sanity/client'

export const SANITY_PROJECT_ID = 'l3itmzli'
export const SANITY_DATASET = 'production'
export const SANITY_API_VERSION = '2024-01-30'

export function readSanityConfig(env = process.env) {
  return {
    projectId: env.SANITY_PROJECT_ID || env.VITE_SANITY_PROJECT_ID || SANITY_PROJECT_ID,
    dataset: env.SANITY_DATASET || env.VITE_SANITY_DATASET || SANITY_DATASET,
    apiVersion: SANITY_API_VERSION,
  }
}

/** Public, published, CDN-backed read. No token: the dataset is world-readable. */
export function createSanityClient(config) {
  return createClient({
    projectId: config.projectId,
    dataset: config.dataset,
    apiVersion: config.apiVersion || SANITY_API_VERSION,
    useCdn: true,
    perspective: 'published',
  })
}
