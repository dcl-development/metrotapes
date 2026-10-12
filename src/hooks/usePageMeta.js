import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { canonicalUrl, pageForPath } from '../lib/routeMeta'

function setMeta(selector, attribute, value) {
  const el = document.querySelector(selector)
  if (el) el.setAttribute(attribute, value)
}

export default function usePageMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const page = pageForPath(pathname)
    const url = canonicalUrl(page.path)
    document.title = page.title
    setMeta('meta[name="description"]', 'content', page.description)
    setMeta('meta[name="robots"]', 'content', page.robots)
    setMeta('meta[property="og:title"]', 'content', page.title)
    setMeta('meta[property="og:description"]', 'content', page.description)
    setMeta('meta[property="og:url"]', 'content', url)
    setMeta('meta[name="twitter:title"]', 'content', page.title)
    setMeta('meta[name="twitter:description"]', 'content', page.description)
    setMeta('link[rel="canonical"]', 'href', url)
  }, [pathname])
}
