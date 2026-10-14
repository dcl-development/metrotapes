/**
 * The embed stays mounted across pause/play. Unmounting it to show the
 * poster builds a new iframe, and autoplay always starts at 0:00.
 * Leave the page (or switch clips) to drop it.
 */
export function videoEmbedMounted({ onPage, sessionId, videoId }) {
  return Boolean(onPage && sessionId && videoId && sessionId === videoId)
}

/** Stable src. Pause must not change it, or the player reloads. */
export function youtubeEmbedSrc(videoId, origin = '') {
  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
  })
  if (origin) params.set('origin', origin)
  return `https://www.youtube.com/embed/${videoId}?${params}`
}

/** True only when `?v=` should start a clip. Repeating the same id is not a new play. */
export function shouldArmVideoRequest({ onPage, status, requested, armed }) {
  if (!onPage || status !== 'ready' || !requested) return false
  return armed !== requested
}

export function postYouTubeCommand(frame, func) {
  const win = frame?.contentWindow
  if (!win || typeof win.postMessage !== 'function') return false
  win.postMessage(JSON.stringify({
    event: 'command',
    func,
    args: '',
  }), '*')
  return true
}
