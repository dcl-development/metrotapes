/** One in-flight request shared by the kiosk and the video page. */
let catalogPromise = null

export function youtubeThumb(videoId) {
  if (typeof videoId !== 'string' || !/^[\w-]{6,}$/.test(videoId)) return ''
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

async function fetchCatalog() {
  try {
    const response = await fetch('/api/videos')
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        status: 'error',
        data: [],
        detail: data.detail || `Could not load videos (${response.status}).`,
      }
    }
    if (!data.videos?.length) {
      return {
        status: 'empty',
        data: [],
        detail: data.detail || 'No videos to show.',
      }
    }
    return { status: 'ready', data: data.videos, detail: '' }
  } catch (error) {
    return {
      status: 'error',
      data: [],
      detail: error?.message || 'Could not load videos.',
    }
  }
}

export function loadVideoCatalog() {
  if (!catalogPromise) catalogPromise = fetchCatalog()
  return catalogPromise
}

export function resetVideoCatalogForTests() {
  catalogPromise = null
}
