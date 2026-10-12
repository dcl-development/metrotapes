# How it works

Metrotapes is a Vite and React app. The home page is a 3D subway station when WebGL is available, and the photo, video, and about pages are camera moves to screens on its walls. Those routes are also real pages, so the same content works without the station. Content lives in Sanity and the videos come from a YouTube playlist. This page covers how those pieces fit. Paths are relative to the repo root.

## Routing and the 3D scene

- `src/App.jsx` has routes for `/`, `/photo`, `/video`, `/about`, and `/blog`. Anything else redirects to `/`.
- `/blog` is a normal scrolling page and the station is not mounted.
- Photo, video, and about are mounted on the station walls for the whole visit, including the home view. `pageMount` in `src/lib/pageMount.js` says where a route's page lives:
  - `document` — blog, and every route when the station is off (no WebGL, or a lost context).
  - `hidden` — 3D home. The kiosk is the page.
  - `station` — a 3D wall route. The same page component is already on that board.
- `SHOT` in `App.jsx` maps the path to a camera shot (`kiosk`, `photo`, `video`, `about`). `StationScene.jsx` flies the camera there. The wall HTML becomes interactive once the camera reports it has arrived (`onArrive` sets `pageReady`).
- The boot screen only shows on a first visit to `/`, and again when the figure button in the header restarts the visit. Visiting a wall page directly, or having reduced motion turned on, skips the intro and starts already in the station. A timeout in `App` clears the boot screen if the canvas never becomes ready.
- Flat Photo, Video, About, and Home pages render only when WebGL is unavailable or the context is lost. There is no control to choose that view.
- Each route has its own title, description, canonical, and social tags in `src/lib/routeMeta.js`. The production build writes `dist/photo/index.html`, `dist/video/index.html`, `dist/about/index.html`, and `dist/blog/index.html` from that table. After navigation, the client hook applies the same tags.

## What loads at boot

`src/lib/preloadStation.js` warms the MTA plate and does not download the other station textures. The canvas `TextureLoader` fetches each texture once and caches it. Photos, about, and the video list load when the wall boards mount with the station, so they are on the walls from the home view. The boot screen waits on the scene, and gives up after the timeout in `App` rather than hanging.

## Content from Sanity

The browser does not call the Sanity Content API. Photos, about, and posts come from same-origin routes:

| Route | Handler | Document |
|---|---|---|
| `/api/photos` | `api/photos.js` | `photos` (first document, `images`) |
| `/api/about` | `api/about.js` | `about` |
| `/api/posts` | `api/posts.js` | `post`, newest first |
| `/api/videos` | `api/videos.js` | `videos` (`playlistId`), read on the server only |

The queries live in `server/sanityContent.js`. Photo and about projections include alt text plus the asset's width and height, so the photo page can build a srcset that does not ask for a larger file than the original. Image URLs are built in the browser by `src/lib/sanity.js` from the public project id and dataset. The image bytes come from `cdn.sanity.io`.

`vite.config.js` serves the same four routes on the dev server. You do not need `vercel dev` for them. A successful content response is cached at the CDN with `s-maxage=60, stale-while-revalidate=86400`.

The studio also defines `home`, `article`, `landingVideo`, and `mediaItem`. Nothing in `src/` or `server/` queries those.

The studio is a separate project in `studio/`. `npm run build` builds the site, then installs and builds the studio with `SANITY_STUDIO_BASEPATH=/studio`, so it ends up in `dist/studio`. `vercel.json` rewrites `/studio` to the studio's `index.html` and everything else that isn't `/api/`, `/assets/`, `robots.txt`, or `sitemap.xml` to the site's `index.html`.

## The videos endpoint

`/api/videos` exists so the YouTube key and the playlist id never reach the browser. The logic is in `server/youtubePlaylist.js`. `api/videos.js` wraps it for Vercel, and the dev server plugin serves the same function.

1. It reads `playlistId` from the `videos` document in Sanity, and strips any `?si=` share junk that got pasted into the Studio field.
2. If `YOUTUBE_API_KEY` (or `VITE_YOUTUBE_API_KEY`) is set, it pages through the YouTube Data API `playlistItems` (up to 10 pages of 50), then batch-fetches durations. Durations that fail to load are left off.
3. If there's no key, it reads the playlist's public RSS feed instead. That feed has titles and ids but no durations.
4. Deleted and private videos are skipped.
5. An empty playlist id or an empty playlist returns 200 with `empty: true`. An upstream failure returns 502. Successful non-empty responses get `s-maxage=300, stale-while-revalidate=86400`.

The video page builds thumbnails from `i.ytimg.com/.../hqdefault.jpg` (`src/lib/videoCatalog.js`) and plays with the YouTube embed. `hqdefault` exists for uploads that do not have a `maxresdefault` image.

## The station files

`src/components/StationScene.jsx` composes the scene. The geometry, camera, train, walls, kiosk, lighting, and textures live in `src/station/`. Quality numbers live on the tier objects in `src/lib/gfxDetect.js`.

## Graphics tiers

`low`, `mid`, and `high` control pixel ratio, bloom, antialiasing, film grain, light count, and texture sizes.

`detectGfxTier` picks the start tier and a ceiling:

- `?gfx=low`, `?gfx=mid`, or `?gfx=high` forces that tier. `low` is locked.
- A software renderer, reduced motion, data saver, or a 2g connection stays `low` and locked.
- `deviceMemory` of 2 GB or less stays `low` and locked. 4 GB is not an automatic `low`.
- Screen width is not an input. The GPU name and max texture size choose `low` or `mid`. A weak GPU starts at `low` but a healthy first sample may lift it to `mid`. A strong GPU starts at `mid`.
- `high` is only the `?gfx=high` opt-in. A normal session does not turn bloom on by itself. Mid and low use a cheap additive glow instead.

After that, one measured window can soften the pixel ratio, then drop a tier, when fps falls below 36 or hitches pile up. A steady window above 54 fps can step up, never above the ceiling, and not inside a few seconds of the opposite move. It does not climb back into `high` on its own.

## Environment variables

All optional. The Sanity defaults point at the production project.

| Variable | Used for |
|---|---|
| `VITE_SANITY_PROJECT_ID`, `VITE_SANITY_DATASET` | Image URLs in the browser, and the API when the server names below are unset |
| `SANITY_PROJECT_ID`, `SANITY_DATASET` | Serverless functions. These win over the `VITE_` names |
| `YOUTUBE_API_KEY` (or `VITE_YOUTUBE_API_KEY`) | YouTube Data API for the playlist. Without it the RSS feed is used |

Do not put a write-capable Sanity token in a `VITE_` variable. It would ship in the JS bundle. The public site does not need a token.

## Limits worth knowing

- **Without an API key the video list has no durations.** The RSS feed also carries no paging, so very long playlists are not guaranteed to show in full.
- **The API key is read from `VITE_YOUTUBE_API_KEY` too.** Only the server code reads it, but a `VITE_` name is the kind Vite exposes to client code, so prefer `YOUTUBE_API_KEY`.
- **The studio config has the project id and dataset written in** (`studio/sanity.config.js`, `studio/sanity.cli.cjs`), as does the API fallback, so pointing at another project means changing those too.
- **The home page does not warm wall images.** Photos, about, and videos load on their own routes.
- **A publish can take about a minute to show up** on a warm CDN cache (`s-maxage=60` for Sanity content, `s-maxage=300` for a non-empty video list).
