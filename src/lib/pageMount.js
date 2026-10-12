const WALLS = new Set(['/photo', '/video', '/about'])

/**
 * Where the real page component mounts.
 * document — normal 2D flow
 * hidden — 3D home, the kiosk is the page
 * wait — 3D wall route, slot not ready yet (do not mount, avoids a second fetch)
 * portal — 3D wall route, mount once into the station frame
 */
export function pageMount({ station, pathname, slotReady }) {
  if (pathname === '/blog') return 'document'
  if (!station) return 'document'
  if (pathname === '/') return 'hidden'
  if (WALLS.has(pathname)) return slotReady ? 'portal' : 'wait'
  return 'document'
}

export function stationEnabled({ webgl, mode, contextLost }) {
  return Boolean(webgl) && mode === 'full' && !contextLost
}
