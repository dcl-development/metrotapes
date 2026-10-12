import { createClient } from '@sanity/client'

const SANITY_PROJECT_ID = 'l3itmzli'
const SANITY_DATASET = 'production'

export function getPlaylistConfig(env = process.env) {
  return {
    youtubeApiKey: env.YOUTUBE_API_KEY || env.VITE_YOUTUBE_API_KEY || '',
    sanityProjectId: env.SANITY_PROJECT_ID || env.VITE_SANITY_PROJECT_ID || SANITY_PROJECT_ID,
    sanityDataset: env.SANITY_DATASET || env.VITE_SANITY_DATASET || SANITY_DATASET,
  }
}

/** Studio paste sometimes includes `?si=` / `&si=` share junk. */
export function cleanPlaylistId(raw) {
  if (!raw || typeof raw !== 'string') return ''
  return raw.trim().split(/[?&]/)[0]
}

function isSkippedTitle(title) {
  return title === 'Deleted video' || title === 'Private video'
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/** PT1H2M3S → 1:02:03 */
export function formatIsoDuration(iso) {
  if (!iso || typeof iso !== 'string') return ''
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ''
  const hours = Number(match[1] || 0)
  const minutes = Number(match[2] || 0)
  const seconds = Number(match[3] || 0)
  if (!hours && !minutes && !seconds) return '0:00'
  if (hours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

async function fetchVideoDetails(videoIds, apiKey) {
  const details = {}
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50)
    const params = new URLSearchParams({
      part: 'contentDetails,snippet',
      id: chunk.join(','),
      key: apiKey,
    })
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error('youtube details', data?.error?.message || response.status)
      break
    }
    for (const item of data.items || []) {
      if (!item.id) continue
      details[item.id] = {
        duration: formatIsoDuration(item.contentDetails?.duration) || '',
        publishedAt: item.snippet?.publishedAt || '',
      }
    }
  }
  return details
}

async function fetchSanityPlaylistId({ sanityProjectId, sanityDataset }) {
  const client = createClient({
    projectId: sanityProjectId,
    dataset: sanityDataset,
    apiVersion: '2024-01-30',
    useCdn: true,
    perspective: 'published',
  })

  return client.fetch(`*[_type == "videos"][0].playlistId`)
}

async function fetchFromYoutubeApi(playlistId, apiKey) {
  const videos = []
  let pageToken = ''

  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      part: 'snippet',
      maxResults: '50',
      playlistId,
      key: apiKey,
    })
    if (pageToken) params.set('pageToken', pageToken)

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`
    )
    const data = await response.json()

    if (!response.ok) {
      return {
        ok: false,
        detail:
          data?.error?.message ||
          `YouTube API error (${response.status}). Check the API key and quota.`,
      }
    }

    for (const item of data.items || []) {
      const videoId = item.snippet?.resourceId?.videoId
      const title = item.snippet?.title || ''
      if (!videoId || isSkippedTitle(title)) continue
      videos.push({
        id: item.id || videoId,
        videoId,
        title,
        publishedAt: item.snippet?.publishedAt || '',
      })
    }

    pageToken = data.nextPageToken || ''
    if (!pageToken) break
  }

  return { ok: true, videos }
}

async function fetchFromRss(playlistId) {
  const response = await fetch(
    `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`
  )

  if (!response.ok) {
    return {
      ok: false,
      detail: `Could not read the YouTube playlist (${response.status}).`,
    }
  }

  const xml = await response.text()
  const videos = []
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g
  let match

  while ((match = entryRe.exec(xml))) {
    const entry = match[1]
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    const title = decodeXml(entry.match(/<title>([^<]+)<\/title>/)?.[1] || '')
    if (!videoId || isSkippedTitle(title)) continue
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1] || ''
    videos.push({
      id: videoId,
      videoId,
      title: title || videoId,
      publishedAt,
    })
  }

  return { ok: true, videos }
}

export async function loadPlaylistVideos(config) {
  const playlistId = cleanPlaylistId(await fetchSanityPlaylistId(config))

  if (!playlistId) {
    return {
      status: 200,
      body: {
        videos: [],
        empty: true,
        detail: 'No YouTube playlist is set in Sanity yet.',
      },
    }
  }

  const result = config.youtubeApiKey
    ? await fetchFromYoutubeApi(playlistId, config.youtubeApiKey)
    : await fetchFromRss(playlistId)

  if (!result.ok) {
    return {
      status: 502,
      body: { videos: [], detail: result.detail },
    }
  }

  if (!result.videos.length) {
    return {
      status: 200,
      body: {
        videos: [],
        empty: true,
        detail: 'Playlist loaded but has no videos.',
      },
    }
  }

  let videos = result.videos
  if (config.youtubeApiKey) {
    try {
      const details = await fetchVideoDetails(
        videos.map((video) => video.videoId),
        config.youtubeApiKey,
      )
      videos = videos.map((video) => {
        const extra = details[video.videoId] || {}
        return {
          ...video,
          duration: extra.duration || '',
          publishedAt: extra.publishedAt || video.publishedAt || '',
        }
      })
    } catch (error) {
      console.error('youtube details', error)
    }
  }

  return {
    status: 200,
    body: { videos },
  }
}
