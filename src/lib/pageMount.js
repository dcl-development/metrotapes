const WALLS = new Set(['/photo', '/video', '/about'])

/**
 * Where the real page component mounts.
 * document — normal 2D flow (blog, or any route when the station cannot run)
 * station — photo, video, and about live on the walls inside the scene
 * hidden — 3D home, the kiosk is the page
 */
export function pageMount({ station, pathname }) {
  if (pathname === '/blog') return 'document'
  if (!station) return 'document'
  if (pathname === '/') return 'hidden'
  if (WALLS.has(pathname)) return 'station'
  return 'document'
}

export function stationEnabled({ webgl, contextLost }) {
  return Boolean(webgl) && !contextLost
}
