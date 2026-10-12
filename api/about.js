import { runAbout } from '../server/sanityRoutes.js'

export default async function handler(req, res) {
  const result = await runAbout(req, process.env)
  for (const [key, value] of Object.entries(result.headers)) {
    res.setHeader(key, value)
  }
  return res.status(result.status).json(result.body)
}
