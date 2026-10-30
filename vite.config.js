import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { runAbout, runPhotos, runPosts } from './server/sanityRoutes.js'
import { allowVideosRequest } from './server/videosGuard.js'
import { getPlaylistConfig, loadPlaylistVideos } from './server/youtubePlaylist.js'
import { applyRouteMeta } from './src/lib/routeMeta.js'
import { secretGuardPlugin } from './scripts/secretGuard.js'

const ROUTE_HTML = ['/photo', '/video', '/about', '/blog']

function routeHtmlPlugin() {
  return {
    name: 'route-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const requestPath = ctx?.path || ctx?.originalUrl || '/'
        return applyRouteMeta(html, requestPath)
      },
    },
    closeBundle() {
      const distIndex = path.resolve('dist/index.html')
      if (!fs.existsSync(distIndex)) return
      const home = fs.readFileSync(distIndex, 'utf8')
      for (const route of ROUTE_HTML) {
        const dir = path.resolve('dist', route.slice(1))
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, 'index.html'), applyRouteMeta(home, route))
      }
    },
  }
}

function attachJsonRoute(server, path, run, env) {
  server.middlewares.use(path, async (req, res) => {
    try {
      const result = await run(req, env)
      res.statusCode = result.status
      for (const [key, value] of Object.entries(result.headers || {})) {
        res.setHeader(key, value)
      }
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result.body))
    } catch (error) {
      console.error(path, error)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        detail: error?.message || 'Could not load content.',
      }))
    }
  })
}

function videosApiPlugin(env) {
  return {
    name: 'videos-api',
    configureServer(server) {
      server.middlewares.use('/api/videos', async (req, res) => {
        const guard = allowVideosRequest(req)
        if (!guard.ok) {
          res.statusCode = guard.status
          if (guard.status === 405) res.setHeader('Allow', 'GET')
          if (guard.status === 429) res.setHeader('Retry-After', '60')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(guard.body))
          return
        }

        try {
          const result = await loadPlaylistVideos(getPlaylistConfig(env))
          res.statusCode = result.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result.body))
        } catch (error) {
          console.error('videos api', error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            detail: error?.message || 'Could not load videos.',
          }))
        }
      })
      attachJsonRoute(server, '/api/photos', runPhotos, env)
      attachJsonRoute(server, '/api/about', runAbout, env)
      attachJsonRoute(server, '/api/posts', runPosts, env)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), videosApiPlugin(env), routeHtmlPlugin(), secretGuardPlugin(env)],
    base: '/',
    server: {
      port: 5173,
      host: true
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      rolldownOptions: {
        output: {
          codeSplitting: {
            includeDependenciesRecursively: false,
            groups: [
              {
                name: 'postprocessing',
                test: /node_modules[\\/]postprocessing[\\/]/,
                priority: 20,
                includeDependenciesRecursively: false,
              },
              {
                name: 'three',
                test: /node_modules[\\/]three[\\/]/,
                priority: 10,
                includeDependenciesRecursively: false,
              },
            ],
          },
        },
      },
    }
  }
})

