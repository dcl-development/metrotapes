import { BOOT_CEREMONY_MS, BOOT_LIMIT_MS } from './bootGate.js'

/**
 * The gilded frame and the large still wait until the camera is on the way
 * to /photo, or until the intro has finished and the browser is idle.
 * The wall you can see from the platform keeps a thumbnail either way.
 */
export function showFullPhoto({ pathname } = {}) {
  return pathname === '/photo'
}

/**
 * Slice DOM is the expensive part (one transformed layer per sliver).
 * Mount it when this wall is the page, not while the camera is still in the air.
 */
export function mountPhotoStrip({ active = false } = {}) {
  return Boolean(active)
}

/**
 * After boot, warm the frame and the next still. `run` only fires once.
 * If the boot screen is already gone (reduced motion, deep link), it waits
 * for an idle slice instead of competing with the first paint.
 */
export function scheduleIdleWarm(run, { timeout = 4000 } = {}) {
  if (typeof window === 'undefined') return () => {}
  let idle = 0
  let cap = 0
  let obs = null
  let started = false
  let cancelled = false
  let usedIdle = false

  const start = () => {
    if (started || cancelled) return
    started = true
    obs?.disconnect()
    obs = null
    window.clearTimeout(cap)
    const fire = () => {
      if (!cancelled) run()
    }
    if (typeof window.requestIdleCallback === 'function') {
      usedIdle = true
      idle = window.requestIdleCallback(fire, { timeout })
    } else {
      idle = window.setTimeout(fire, 1)
    }
  }

  const boot = typeof document !== 'undefined'
    ? document.querySelector('[data-boot-screen]')
    : null
  if (!boot) {
    start()
  } else {
    obs = new MutationObserver(() => {
      if (!document.querySelector('[data-boot-screen]')) start()
    })
    obs.observe(document.body, { childList: true, subtree: true })
    // Boot has its own deadline. Don't wait forever if that node lingers.
    cap = window.setTimeout(start, BOOT_CEREMONY_MS + BOOT_LIMIT_MS)
  }

  return () => {
    cancelled = true
    window.clearTimeout(cap)
    if (idle && usedIdle && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idle)
    } else {
      window.clearTimeout(idle)
    }
    obs?.disconnect()
  }
}

export function prefetchImages(hrefs) {
  if (typeof document === 'undefined') return () => {}
  const links = []
  for (const href of hrefs) {
    if (!href) continue
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.as = 'image'
    link.href = href
    document.head.appendChild(link)
    links.push(link)
  }
  return () => {
    for (const link of links) link.remove()
  }
}

/** The next frame still, while the visitor is already on the photos page. */
export function preloadImage(href) {
  if (typeof document === 'undefined' || !href) return () => {}
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = href
  document.head.appendChild(link)
  return () => link.remove()
}
