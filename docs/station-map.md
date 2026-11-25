# Station map

A plain-English tour of the 3D scene. Everything is built in code: there are no model files. Space is in meters, +Y is up, the camera looks down −Z, and the tracks are on the +X (right) side.

## Where to start

| I want to change… | Open |
|---|---|
| Where the camera parks for the kiosk or each wall | `POVS` in `src/station/space.js` |
| The size of the platform, pillar spacing, stair count, track depth | the constants at the top of `src/station/space.js` |
| What the station is made of (tile, concrete, steel, wood) | `src/station/textures.js` |
| How hard the scene works on weak devices | the tier objects in `src/lib/gfxDetect.js` |
| Which route goes to which shot | `SHOT` in `src/App.jsx` |

## The parts

| File | What it builds |
|---|---|
| `src/components/StationScene.jsx` | Composes everything: the canvas, the intro flight, which shot is active, bloom, and the render loop. Change with care. |
| `src/station/space.js` | Shared dimensions, the camera shots (`POVS`), and the wall page framing (`pageShot`). |
| `src/station/shell.jsx` | Floor, tiled side walls, ceiling, ceiling beams, I-beam pillars and the stairs. |
| `src/station/textures.js` | Paints every texture on a hidden 2D canvas: wall tile with grout and grime, concrete floor, steel, wood, and the train car faces. |
| `src/station/tracks.jsx` | The track trench and rails. |
| `src/station/train.jsx`, `steam.jsx` | The subway car, its roll-in, and the steam under it. |
| `src/station/kiosk.jsx`, `chrome.jsx` | The MetroCard machine, its LCD glass, and the film layer over the canvas that joins the 3D view to the sharp HTML screens. |
| `src/station/walls.jsx`, `boards.js` | The signage and the three wall boards (photo, video, about) that hold the live pages. |
| `src/station/css3d.js` | The math that places real HTML pages on 3D walls and keeps CSS perspective in step with the camera. |
| `src/station/camera.jsx`, `cameraMotion.js` | Moves the camera between shots and reports arrival, which unlocks the wall pages. |
| `src/station/lighting.jsx` | Fluorescent tubes, fog and atmosphere. |
| `src/station/litter.jsx`, `rat.jsx` | The dropped MetroCard, receipts and bags, and the rat. |

## How a click becomes a camera move

1. The kiosk (or the header) navigates to `/photo`, `/video` or `/about`.
2. `App.jsx` looks the path up in `SHOT` and passes the shot name to `StationScene`.
3. `camera.jsx` flies the camera to that shot, using `pageShot` to park straight in front of the wall board.
4. On arrival it calls `onArrive`. `App` sets `pageReady`, and the wall page becomes interactive.
5. The page itself (`src/pages/*`) is ordinary React, placed on the wall by `css3d.js`.

## Safe to change vs. careful

- **Safe:** numbers in `space.js` (framing, sizes), colors in `src/styles/theme.js`, copy in Sanity, adding litter.
- **Careful:** the intro and boot state in `App.jsx`, the render loop and tiers in `StationScene.jsx` and `src/lib/gfxTier.jsx`, and anything that changes when a wall page becomes interactive. These interact in ways that break quietly. Check `/`, `/photo`, `/video`, `/about`, a phone width, and reduced motion afterwards (see the Verify section in `AGENTS.md`).
