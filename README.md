# Metrotapes

The portfolio site for Metrotapes, built as an interactive subway station. The station is the navigation: the photo, video and about pages are camera shots inside a 3D scene rather than separate page layouts. Blog posts are ordinary pages.

Live at [metrotapes.com](https://metrotapes.com).

## How it works

- A boot screen leads into a kiosk in the station. Routes are `/`, `/photo`, `/video`, `/about` and `/blog`.
- The scene is built with React Three Fiber and Three.js, with post-processing and a few graphics quality tiers.
- Photos, about text, and blog posts come from Sanity through same-origin endpoints: `/api/photos`, `/api/about`, and `/api/posts`. The public site does not call the Sanity API from the browser. Image files still load from `cdn.sanity.io`.
- Videos are read from a YouTube playlist through `/api/videos`, which falls back to the playlist's RSS feed when no API key is set. The playlist id is read from Sanity on the server.
- The Sanity Studio lives in `studio/` and is built into the deployed site under `/studio`. Studio keeps its own connection to Sanity.

## Stack

Vite, React 18, React Router, Three.js with React Three Fiber, styled-components, Sanity, deployed on Vercel.

## Running it locally

You need a current Node.js LTS.

```sh
npm install
npm run dev
```

The site runs on the Vite dev server, which also serves `/api/videos`, `/api/photos`, `/api/about`, and `/api/posts`. You do not need `vercel dev` for those routes. (`npx vercel dev` works too, if you want the Vercel runtime locally.) To edit content locally, run the studio in a second terminal:

```sh
npm install --prefix studio
npm run dev:studio
```

Optional environment variables (put them in `.env.local`):

- `VITE_SANITY_PROJECT_ID` and `VITE_SANITY_DATASET` to point image URLs and the dev server at a different Sanity project. The defaults are the production ones (`l3itmzli` / `production`).
- `SANITY_PROJECT_ID` and `SANITY_DATASET` override those for the serverless functions when you want the server on a different project than the image URLs. On Vercel, either pair works: the functions read `SANITY_*` first, then `VITE_*`.
- `YOUTUBE_API_KEY` for the YouTube Data API. Without it the video list uses the playlist RSS feed.

Those content routes send `Cache-Control: s-maxage=60, stale-while-revalidate=86400`, so the Vercel CDN can answer immediately and refresh in the background. A publish can take up to a minute to show up on a warm cache.

## Scripts

- `npm run dev` starts the site
- `npm run dev:studio` starts the Sanity Studio
- `npm run build` builds the site and the studio
- `npm run build:site` builds only the site
- `npm run lint` runs ESLint
