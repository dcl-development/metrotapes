import { allowVideosRequest } from '../server/videosGuard.js'
import { getPlaylistConfig, loadPlaylistVideos } from '../server/youtubePlaylist.js'

export default async function handler(req, res) {
  const guard = allowVideosRequest(req)
  if (!guard.ok) {
    if (guard.status === 405) res.setHeader('Allow', 'GET')
    if (guard.status === 429) res.setHeader('Retry-After', '60')
    return res.status(guard.status).json(guard.body)
  }

  try {
    const result = await loadPlaylistVideos(getPlaylistConfig(process.env))

    if (result.status === 200 && result.body.videos?.length) {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400')
    }

    return res.status(result.status).json(result.body)
  } catch (error) {
    console.error('videos api', error)
    return res.status(500).json({
      detail: error?.message || 'Could not load videos.',
    })
  }
}
