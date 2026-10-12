export const SITE_URL = 'https://metrotapes.com'

export const OG_IMAGE =
  'https://cdn.sanity.io/images/l3itmzli/production/f8a2796069a8ff4fa587a311118abca4aee5e1a2-2905x2048.jpg?w=1200&h=630&fit=crop&fm=jpg'

const HOME_DESCRIPTION =
  'Photography and video by Ronnie Foreman in the New York metropolitan area. Skate, snow, and other visual work.'

/** Served HTML and the client hook share this table. */
export const ROUTE_META = {
  '/': {
    path: '/',
    title: 'metrotapes',
    description: HOME_DESCRIPTION,
    robots: 'index, follow',
  },
  '/photo': {
    path: '/photo',
    title: 'photo · metrotapes',
    description: 'Photographs by Ronnie Foreman / metrotapes.',
    robots: 'index, follow',
  },
  '/video': {
    path: '/video',
    title: 'video · metrotapes',
    description: 'Films and video by Ronnie Foreman / metrotapes.',
    robots: 'index, follow',
  },
  '/about': {
    path: '/about',
    title: 'about · metrotapes',
    description:
      'Ronnie Foreman is a videographer in the New York metropolitan area. Skate, snow, and other visual work.',
    robots: 'index, follow',
  },
  '/blog': {
    path: '/blog',
    title: 'metrotapes',
    description: HOME_DESCRIPTION,
    robots: 'noindex, nofollow',
  },
}

export function normalizePath(pathname) {
  if (!pathname || pathname === '/index.html') return '/'
  const clean = String(pathname).split('?')[0].replace(/\/index\.html$/, '')
  if (clean.length > 1 && clean.endsWith('/')) return clean.slice(0, -1)
  return clean || '/'
}

export function pageForPath(pathname) {
  const path = normalizePath(pathname)
  return ROUTE_META[path] || ROUTE_META['/']
}

export function canonicalUrl(pathname) {
  const path = pageForPath(pathname).path
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
}

function replaceTag(html, pattern, tag) {
  if (pattern.test(html)) return html.replace(pattern, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function replaceMeta(html, attr, key, content) {
  const tag = `<meta ${attr}="${key}" content="${esc(content)}" />`
  const re = new RegExp(
    `<meta\\b[^>]*\\b${attr}=["']${key.replace(':', '\\:')}["'][^>]*>`,
    'i',
  )
  return replaceTag(html, re, tag)
}

/**
 * Stamp one route's title, description, canonical, and social tags
 * onto an index.html string. Safe to run again for a different route.
 */
export function applyRouteMeta(html, pathname) {
  const page = pageForPath(pathname)
  const url = canonicalUrl(page.path)
  let next = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${esc(page.title)}</title>`,
  )
  next = replaceMeta(next, 'name', 'description', page.description)
  next = replaceMeta(next, 'name', 'robots', page.robots)
  next = replaceMeta(next, 'property', 'og:title', page.title)
  next = replaceMeta(next, 'property', 'og:description', page.description)
  next = replaceMeta(next, 'property', 'og:url', url)
  next = replaceMeta(next, 'name', 'twitter:title', page.title)
  next = replaceMeta(next, 'name', 'twitter:description', page.description)
  next = replaceTag(
    next,
    /<link\b[^>]*\brel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${esc(url)}" />`,
  )
  return next
}
