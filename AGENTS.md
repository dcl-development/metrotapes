# AGENTS.md — Metrotapes

Low-context jump-in for new agents. Read this, then open only the files your task needs. Prefer small diffs. Human taste: Helvetica, functional first, funk via the station scene — not extra libraries.

## Dev framework

This repo follows Jake's dev framework: [jakedcl/dev-framework](https://github.com/jakedcl/dev-framework) (start at its `AGENTS.md`). The framework is the source of truth; if anything in this file conflicts with it, the framework wins.

## What this is

Portfolio for **Metrotapes**. Live: [metrotapes.com](https://metrotapes.com). The site is an interactive subway station: **navigation is camera shots inside one 3D scene**, not separate page layouts. Blog is a normal HTML page. Content comes from Sanity.

**Stack:** Vite + React 18 + React Router + styled-components + React Three Fiber / Three.js + Sanity + Vercel. **Not Next.js.** No Tailwind.

## Map

`BootScreen → StationScene (kiosk) → route changes camera shot → wall HTML overlays`

| Route | Shot | Content |
|-------|------|---------|
| `/` | `kiosk` | MetroCard machine / intro |
| `/photo` | `photo` | Photo wall (Sanity) |
| `/video` | `video` | Video wall (YouTube via API) |
| `/about` | `about` | About wall (Sanity) |
| `/blog` | — | Normal page (`src/pages/Blog.jsx`); **no** station scene |

- Routing, boot, header height, route → shot (`SHOT`): `src/App.jsx`
- 3D station, camera, walls, train: `src/components/StationScene.jsx`, with pieces in `src/station/` (camera POVs `POVS` in `src/station/space.js`)
- Kiosk UI: `src/components/KioskScreen.jsx`, `MetroMachineFace.jsx`
- Walls: `src/pages/*`. GPU tiers: `src/lib/gfxTier.jsx`. Preload: `src/lib/preloadStation.js`
- Colors, fonts, hover press: `src/styles/theme.js` (source of truth for design tokens)
- YouTube: `api/videos.js` → `server/youtubePlaylist.js`. Deploy rewrites (SPA + studio): `vercel.json`

**Intro rules (do not "simplify" casually):** boot is a first-load ceremony on `/` only; deep links to walls skip it; `prefers-reduced-motion` skips it; wall HTML waits for the camera to arrive (`pageReady` / `onArrive`).

## Content ownership

- **Sanity** owns photos, about copy, blog posts, video playlist id, home bits. Studio app: `studio/` (served at `/studio`), schemas in `studio/schemaTypes/`.
- **Code** owns station geometry, camera shots, boot/kiosk UX, gfx tiers, theme tokens.
- **YouTube** owns the video list. `/api/videos` falls back to playlist RSS if `YOUTUBE_API_KEY` is unset.
- Don't hardcode CMS copy when a schema exists. No secrets in `VITE_*` and don't read `import.meta.env` as a whole object in browser code (Vite inlines every `VITE_*` var). The build fails if a secret value lands in the bundle.

## Commands

```sh
npm run dev          # site (+ /api/videos via Vite)
npm run dev:studio   # Studio (second terminal; npm install --prefix studio first)
npm run build        # site + studio;  npm run build:site = site only
npm run lint && npm test
```

Optional `.env.local` (see `.env.example`): `YOUTUBE_API_KEY`, `SANITY_PROJECT_ID`, `SANITY_DATASET`, all server-only. The dataset is public, so no Sanity token.

## Rules

1. Explain before big changes to `StationScene.jsx`, boot/intro state in `App.jsx`, or gfx tiers; they break subtly. Don't rewrite the scene for a content task.
2. Preserve empty / loading / error states on fetching surfaces.
3. Sibling routes share station state: if you change leave/arrive/camera for one wall, check the others and home.
4. Out of scope unless asked: new stack (auth, DB, second UI lib, Next/Tailwind), R3F rewrites, changing Sanity project/dataset defaults, a full station redesign.

## Verify

`/` boots then kiosk navigates to walls; `/photo` `/video` `/about` land on the wall and become interactive after arrive; `/blog` scrolls with the station unmounted; mobile resize keeps header and framing (gfx can drop tiers, never promote mid-session); reduced motion has no intro.
