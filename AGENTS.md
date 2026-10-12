# AGENTS.md — Metrotapes

Low-context jump-in for new agents. Read this, then open only the files your task needs. Prefer small diffs. Human taste: Helvetica, functional first, funk via the station scene — not extra libraries.

## What this is

Portfolio for **Metrotapes**. Live: [metrotapes.com](https://metrotapes.com).

The site is an interactive subway station. **Navigation is camera shots inside one 3D scene**, not separate page layouts. Blog is a normal HTML page. Content comes from Sanity.

**Stack:** Vite + React 18 + React Router + styled-components + React Three Fiber / Three.js + Sanity + Vercel. **Not Next.js.** No Tailwind.

## Mental model

```
BootScreen → StationScene (kiosk) → route changes camera shot → wall HTML overlays
```

| Route | Shot | Content |
|-------|------|---------|
| `/` | `kiosk` | MetroCard machine / intro |
| `/photo` | `photo` | Photo wall (Sanity) |
| `/video` | `video` | Video wall (YouTube via API) |
| `/about` | `about` | About wall (Sanity) |
| `/blog` | — | Normal page; **no** station scene |

Route → shot mapping lives in `src/App.jsx` (`SHOT`). Camera POVs and wall placement live in `src/components/StationScene.jsx` (`POVS`).

**Intro rules (do not “simplify” casually):**

- Boot/intro is a first-load ceremony on `/` only.
- Deep links to wall routes skip intro and start already in the station.
- `prefers-reduced-motion` also skips intro.
- Wall page HTML waits for the camera to finish arriving (`pageReady` / `onArrive`).

## Where to look

| Task | Start here |
|------|------------|
| Routing, boot, header height, leave-kiosk | `src/App.jsx` |
| 3D station, camera, walls, train | `src/components/StationScene.jsx` |
| Kiosk LCD / machine UI | `src/components/KioskScreen.jsx`, `MetroMachineFace.jsx` |
| Photo / video / about walls | `src/pages/*` |
| Blog | `src/pages/Blog.jsx` |
| Sanity client + image URLs | `src/lib/sanity.js` |
| GPU quality tiers | `src/lib/gfxTier.jsx` |
| Colors, fonts, hover press | `src/styles/theme.js` |
| YouTube playlist API | `api/videos.js` → `server/youtubePlaylist.js` |
| CMS schemas | `studio/schemaTypes/` |
| Deploy rewrites (SPA + studio) | `vercel.json` |

Assets for the station preload via `src/lib/preloadStation.js`. Public static files in `public/`.

## Content ownership

- **Sanity** owns: photos, about copy, blog/posts, video playlist id, home/landing bits.
- **Code** owns: station geometry, camera shots, boot/kiosk UX, gfx tiers, theme tokens.
- **YouTube** owns: actual video list (playlist). `/api/videos` loads it; falls back to playlist RSS if `YOUTUBE_API_KEY` is unset.
- Studio app: `studio/`. Built into the site at `/studio`. Schemas: `studio/schemaTypes/`.

Do not hardcode CMS copy or photo galleries in React when a schema already exists. Do not put write-capable Sanity tokens in `VITE_*` (they ship to the browser).

## Design tokens (existing look)

From `src/styles/theme.js`:

- Station bg: `#1A1A1A`
- Routes: photo `#0039A6`, video `#00933C`, about `#996633`
- UI font: Helvetica Neue / Helvetica
- Signage (wall titles, dest plates): Helvetica Bold family (`signage`)
- Soft press interaction: `cushy`

Layers (back → front): station scene → page content → header (`z-index: 100`).

## Commands

```sh
npm install
npm run dev              # site (+ /api/videos via Vite)
npm run dev:studio       # Sanity Studio (second terminal; npm install --prefix studio first)
npm run build            # site + studio
npm run build:site       # site only
npm run lint
```

Optional env (`.env.local`): `VITE_SANITY_PROJECT_ID`, `VITE_SANITY_DATASET`, `YOUTUBE_API_KEY`. Defaults in `src/lib/sanity.js` point at production Sanity.

## Working rules for agents

1. **Explain before big changes** — especially anything in `StationScene.jsx`, boot/intro state in `App.jsx`, or gfx tiers. Those are easy to break subtly.
2. **Don’t rewrite the scene** for a content or page-copy task. Touch the smallest surface.
3. **Preserve empty / loading / error states** on surfaces that fetch (photos, videos, about, blog).
4. **No new stack** unless the task needs it: no auth, no DB, no second UI library, no Tailwind/Next migration.
5. **Real copy only** — no lorem, no “Welcome to your app.”
6. **Sibling routes share station state** — if you change leave/arrive/camera behavior for one wall, check the others and home.
7. **Commit only when asked.** Don’t push unless asked.
8. Match existing style: styled-components, functional React, comments that explain non-obvious intent.

## Quick verify

- `/` → boot (first visit) → kiosk; machine can navigate to walls.
- `/photo`, `/video`, `/about` → camera lands on wall; content interactive after arrive.
- `/blog` → normal scroll page; station unmounted.
- Resize / mobile: header height and wall framing still work; gfx can drop tiers, never promote mid-session.
- Reduced motion: no intro replay ceremony.

## Out of scope unless asked

Rewriting R3F architecture, changing Sanity project/dataset defaults, redesigning the whole station look, adding auth/DB, migrating to Next/Tailwind.
