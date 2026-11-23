async function fetchJson(path) {
  const response = await fetch(path)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || `Could not load content (${response.status}).`)
  }
  return data
}

export async function fetchPhotos() {
  const data = await fetchJson('/api/photos')
  return Array.isArray(data.photos) ? data.photos : []
}

export async function fetchAbout() {
  const data = await fetchJson('/api/about')
  return data.about || null
}
