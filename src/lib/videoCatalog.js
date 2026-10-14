/** One in-flight request shared by the kiosk and the video page. */
let catalogPromise = null

const VIDEO_ID = /^[\w-]{6,}$/

export function isVideoId(videoId) {
  return typeof videoId === 'string' && VIDEO_ID.test(videoId)
}

export function youtubeThumb(videoId) {
  if (!isVideoId(videoId)) return ''
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

/** Muted looping tile. `vq=small` asks YouTube for the low ladder. */
export function youtubePreviewEmbed(videoId) {
  if (!isVideoId(videoId)) return ''
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    loop: '1',
    playlist: videoId,
    modestbranding: '1',
    playsinline: '1',
    rel: '0',
    iv_load_policy: '3',
    disablekb: '1',
    fs: '0',
    vq: 'small',
  })
  return `https://www.youtube.com/embed/${videoId}?${params}`
}

/**
 * Three embeds at once. Skip them off the kiosk, in a hidden tab, when
 * motion is reduced, on the low gfx tier, and on a phone-width screen.
 */
export function kioskPreviewAllowed({
  live = false,
  hidden = false,
  reducedMotion = false,
  tier = 'mid',
  phone = false,
} = {}) {
  if (!live || hidden || reducedMotion || phone) return false
  if (tier === 'low') return false
  return true
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
