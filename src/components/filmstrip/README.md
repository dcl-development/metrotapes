# Filmstrip

A self-contained 35mm film strip: one ribbon of photos that curls through a hairpin in CSS 3D, with a flat scrolling fallback when 3D is unavailable. No WebGL, no three.js, no Sanity, no Tailwind, no site globals.

This folder is a **copy** for other projects. The live portfolio still renders `src/app/components/Filmstrip.tsx`. Do not point the site at this folder unless you are ready to retest the home page.

```
export/filmstrip/
  README.md
  package.json                 peerDeps only — not published
  index.ts                     public exports
  Filmstrip.tsx                shell: images in, lightbox, entrance, empty state
  Filmstrip.module.css         shell styles (no Tailwind)
  FilmStrip3D.tsx              3D ribbon + the auto/3d/flat switch
  FilmStrip3D.module.css       3D styles
  FilmStripFlat.tsx            2D fallback
  FilmStripFlat.module.css     flat styles + scratch plate
  grain.ts                     default grain URL
  film-scratches-grain.webp    scratch plate (copy into public/)
  example/Example.tsx          usage, with a mode switch
  example/placeholders.ts      offline SVG frames
```

## What it is

`Filmstrip` takes an array of images and draws them as a continuous strip of film: black base, sprocket holes, yellow edge print, and a scratch texture stuck to the moving ribbon.

`FilmStrip3D` builds that ribbon from many thin slices posed by one `requestAnimationFrame` loop. Each slice is a `matrix3d`. Photos are clipped windows on those slices, so the picture bends with the film. React does not re-render per frame.

`FilmStripFlat` is the same frames in a straight row with native horizontal scroll and a slow autoplay. It has its own stylesheet. The scratch plate is the same webp.

## Visual behavior

- **3D curl.** Default `variant="loop"`: the strip arches toward the viewer, hairpins, and runs off both sides. `ribbon` is a gentler S. `helix` is a spiral. Autoplay is about 0.4 frames per second at `speed={1}`. The shell defaults to `speed={0.8}`.
- **Drag.** Pointer drag scrubs the strip. A small movement stays a click, so a tap still opens the lightbox. Horizontal wheel / trackpad scrubs; vertical wheel scrolls the page.
- **Lightbox.** Click, tap, or Enter opens the frame. Escape closes. Arrows and a horizontal swipe move between frames. The dialog locks body scroll with `position: fixed` (iOS ignores `overflow: hidden` alone). While it is open, autoplay speed is 0.
- **Tiers.** After hydration the strip picks a tier:
  - `compact` when `max-width: 767px` or `max-height: 560px`. Wider slices, about 24fps, gloss and fog removed, deep back-facing slices skipped. Still 3D.
  - `desk` otherwise. Finer slices, about 60fps, fog and gloss on.
  - Weak devices (≤4 cores or ≤4 GB) also drop to the lighter loop, without changing the desktop hairpin radius.
- **Flat fallback.** See below. It is not the phone path.
- **Grain.** `film-scratches-grain.webp` is a background layer on each slice (and on each flat frame). Its phase (`--gx` / `--grain-shift`) is set when a slice is recycled or flipped, not every animation frame, so the scratches ride the film instead of swimming in screen space. The large `public/film-scratches.jpg` in the portfolio is the source scan; the strip does not load it.
- **Reduced motion.** Autoplay pauses, the camera stops swaying, and the flat track does not smooth-scroll. Drag still works. The renderer does not change.
- **Entrance.** `entrance` covers the strip with a sibling veil until the first pose, then fades the veil. The veil is not opacity on the 3D parent (that would flatten `preserve-3d`).

## Flat fallback

| Situation | Renderer |
| --- | --- |
| `mode="auto"` (default) and the browser supports `transform-style: preserve-3d` and `perspective` | 3D |
| `mode="auto"` and either of those is missing | Flat |
| `prefers-reduced-motion: reduce` | Same renderer. Autoplay off, no sway |
| Compact viewport, `lowPower`, or a weak device | 3D, cheaper tier. Not flat |
| `mode="flat"` | Flat, always |
| `mode="3d"` | 3D, even when the browser cannot do it (the ribbon can be blank) |

Phones used to get the flat strip. They stay on 3D now, with the compact tier above. Flat is the "no CSS 3D" path, plus anything you force.

Force a mode on the shell or on `FilmStrip3D` directly:

```tsx
<Filmstrip images={images} mode="flat" />
<Filmstrip images={images} mode="3d" />
<FilmStripFlat items={items} onSelect={open} />
```

`example/Example.tsx` has auto / 3d / flat buttons. The root sets `data-renderer="3d"` or `data-renderer="flat"` once the client knows.

## Dependencies

Developed on **React 19.1** and **Next.js 15.5** (App Router). It uses hooks that exist in **React 18** (`useLayoutEffect`, `useRef`, `createPortal`). Peer range: `react` and `react-dom` `>=18`.

- CSS modules. Next and Vite both compile `*.module.css`. **No Tailwind.** The live site's lightbox happens to use Tailwind utilities; this copy's lightbox is `Filmstrip.module.css`.
- `'use client'` on the components. Required in the Next App Router. Vite ignores the directive.
- Optional font: edge print is drawn on a canvas with `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`. Load IBM Plex Mono (or pass `printFont`) if you want that face. If it is missing, the canvas falls back down the stack.
- The scratch plate must be served at `/film-scratches-grain.webp`, or you pass `grainSrc`.

There is no non-bundler build. A page that does not understand CSS modules will not pick up the styles. Both install paths below use a bundler, which is the supported path.

## Install — Next.js App Router

From the portfolio repo (or from a copy of this folder):

```bash
cp -R export/filmstrip src/components/filmstrip
cp src/components/filmstrip/film-scratches-grain.webp public/film-scratches-grain.webp
```

```tsx
'use client'

import Filmstrip from '@/components/filmstrip'

const images = [
  { src: '/photos/01.jpg', alt: 'Roof at dusk', width: 1600, height: 1200 },
  { src: '/photos/02.jpg', alt: 'Stairwell', width: 1600, height: 1200, src2x: '/photos/02@2x.jpg' },
]

export default function Page() {
  return <Filmstrip images={images} />
}
```

Put that in a Client Component, or import `Filmstrip` from a server page (the module is already `'use client'`). Pass final image URLs. This package does not call Sanity.

`example/Example.tsx` is a working page body. `example/placeholders.ts` builds offline SVG frames so you can see the strip before real photos exist.

## Install — React + Vite

```bash
npm create vite@latest film-demo -- --template react-ts
cd film-demo
npm install
cp -R /path/to/export/filmstrip src/filmstrip
cp src/filmstrip/film-scratches-grain.webp public/film-scratches-grain.webp
```

```tsx
import FilmstripExample from './filmstrip/example/Example'

export default function App() {
  return <FilmstripExample />
}
```

Or skip the example and render `<Filmstrip images={[{ src, alt }]} />`. Vite serves `public/` at the site root, same as Next, so the default grain URL works.

## Props

`Filmstrip` (`images` is the one that matters):

| Prop | Default | |
| --- | --- | --- |
| `images` | `[]` | `{ src, alt, src2x?, srcSet?, placeholder?, caption?, width?, height?, aspect?, label?, href? }`. Empty `src` is dropped. |
| `mode` | `'auto'` | `'auto' \| '3d' \| 'flat'`. |
| `maxImages` | `16` | Hard cap. Do not raise this on phones. |
| `speed` | `0.8` | `1` ≈ 0.4 frames/s. `0` pauses. Negative plays backward. Paused while the lightbox is open. |
| `variant` | `'loop'` | `'loop' \| 'ribbon' \| 'helix'`. |
| `turnSharpness` | `1` | Loop only. `0.5` wide, `1.8` tight. |
| `depth` | `1` | Loop only. How far the legs climb. `0.5`–`1.6`. |
| `perspective` | `750` | Loop camera distance in world px. `350`–`4000`. |
| `amplitude` | `1` | Ribbon / helix only. |
| `gap` | `18` | Black margin between photos, in strip px. Clamped `10`–`90`. |
| `stockLabel` | `'KODAK EPP 5005'` | Yellow edge print, every 4th frame. |
| `height` | CSS var | Container height. Number is px. |
| `ink` | `#f6c915` | Edge print and lightbox count. The portfolio overrides this with its signal yellow `#f5c518`. |
| `grainSrc` | `'/film-scratches-grain.webp'` | Scratch plate URL. |
| `printFont` | IBM Plex Mono stack | Canvas font for the edge print. |
| `lowPower` | auto | Force the cheaper tier. |
| `entrance` | `false` | Veil until the first pose. |
| `stageColor` | `#f6f3ec` | Veil color. |
| `lightbox` | `true` | Set `false` to handle `onSelect` yourself. `href` is only used when the lightbox is off. |
| `onSelect` | — | `(image, index) => void`. Also fires when the lightbox opens. |
| `onReady` | — | First posed frame, or the flat fallback, is in the DOM. |
| `active` | `true` | When `false`, the 3D rAF loop and the flat autoplay loop are not scheduled. Tiers, reduced motion, and the preserve-3d fallback are unchanged. |
| `ariaLabel` | `'Photo filmstrip'` | |
| `className` | — | On the outer section. |

Image fields:

- `aspect` (or `width` / `height`) sets the frame pitch. Omitted aspect becomes **4 / 3**, so every window matches and the photo is cover-cropped. Pass a real aspect if the frames should vary.
- `width` and `height` also size the lightbox box. Without them the lightbox still shows the image, in a full-width frame.
- `placeholder` is a tiny data-uri behind the photo.
- `src2x` is skipped when Save-Data, `2g`, or `prefers-reduced-data` is set (`prefersSmallImages()`).

`FilmStrip3D` takes `items: FilmStripItem[]` (same shape as an image, without caption) plus `onSelect`, `mode`, `speed`, `variant`, `amplitude`, `turnSharpness`, `depth`, `perspective`, `height`, `gap`, `stockLabel`, `ariaLabel`, `lowPower`, `className`, `onReady`, `grainSrc`, `printFont`.

`FilmStripFlat` takes `items`, `onSelect`, and `grainSrc`.

## Customization

On the element that wraps the strip (the shell sets the first two):

| Variable | Default | |
| --- | --- | --- |
| `--fs3d-height` | `clamp(200px, 34svh, 280px)` | Short / phone stage. |
| `--fs3d-height-md` | `clamp(400px, 56svh, 640px)` | From `768px` wide and `561px` tall. |
| `--fs3d-ink` | `#f6c915` | Edge print. Also read by the canvas. |
| `--fs3d-hole` | `#f3f0e6` | Sprocket hole fill. |
| `--fs3d-stage` | `#f6f3ec` | Entrance veil. |

Do not drive the 3D slices' `background-image` with a CSS variable. Chrome re-rasters every transformed slice every frame. `grainSrc` is written into the inline style as a concrete `url(...)`.

## Empty, loading, error

- **Empty.** No usable `src`: the shell renders "No frames yet." It does not throw.
- **Loading.** Slices stay `visibility: hidden` until they have a pose (`aria-busy` until the tier is known). `entrance` adds the veil. The lightbox image stays opacity 0 until `onLoad` (cached images are checked via `complete`).
- **Error.** Lightbox: "This frame didn't load." Flat `<img>` hides itself on `onerror`. A 3D frame with a broken URL shows the gray photo window; the rest of the strip keeps running.

## Performance rules

These are the rules that kept the strip alive on mobile Safari. Break them and phones stall or the curl clips.

1. **Hot path.** The phone strip is the expensive one. Prefer fewer DOM nodes over another visual layer. The cap is **16 photos**. Compact tier uses ~56px slices instead of ~20px.
2. **Composite-only motion.** The loop may write `transform: matrix3d(...)` and opacity custom properties (`--sh`, `--gl`). It must not write `top`, `left`, `width`, `filter`, or `background-position` every frame.
3. **No `will-change` on slices.** Promoting 100+ slices to their own compositor layers runs iPhone Safari out of memory.
4. **No blend modes, no filters, no extra scratch element.** The grain is one more `background-image` on the slice that already has the 3D transform. `mix-blend-mode` on that stack is what made the plate smear.
5. **Grain phase is not per frame.** `--gx` changes when a slice is recycled or turned over, so the scratches stay glued to the film. Tile width is **720px** in both `GRAIN_TILE` (`FilmStrip3D.tsx`) and the CSS `background-size`. If those disagree, the plate seams.
6. **No `var()` inside `background-image` on a transformed slice.** Chrome repaints every slice every frame. The flat strip may use `--fs3d-grain` because those frames are not `preserve-3d`.
7. **`overflow-x: clip` vs scroll containers.** `overflow: hidden` and `overflow: auto` on an ancestor make a scroll container. That breaks `animation-timeline: view()` (the page then tracks the box, not the viewport) and clips the curl. `overflow-x: clip` clips sideways bleed without becoming a scroll container. Safari pitfall: if one axis is `clip`/`hidden` and the other is `visible`, the visible axis can compute to `auto` and slice off the vertical arch. Keep clip on the full-width page shell. The loop itself is `overflow: visible`. Do not add `contain: paint` — it clips the 3D swing. The root uses `contain: layout` only.
8. **Do not flatten the 3D context.** `opacity` or `transform` on an ancestor of the ribbon flattens `preserve-3d` or re-rasters it every frame. Fade a sibling veil. Do not put a scroll-linked transform on the parent.
9. **Pause offscreen.** The loop stops when the strip is outside the viewport (plus 80px) and when the tab is hidden. Leave that alone.
10. **Touch.** The 3D root is `touch-action: pan-y` so a vertical gesture still scrolls the page. The flat track is `pan-x pan-y` and uses native overflow scroll.

## Agent prompt

Paste this to an agent in the destination project:

```
Add the filmstrip from the `export/filmstrip/` folder I copied into this repo (or from jakedcl.com `export/filmstrip/`).

Put the folder at `src/components/filmstrip`. Copy `film-scratches-grain.webp` to `public/film-scratches-grain.webp`. Render `<Filmstrip images={[{ src, alt, width, height }]} />` from `src/components/filmstrip`. Images are normal URLs I pass in. Do not import Sanity, the portfolio globals, or Tailwind for this. Do not restyle it with a component library.

Leave `mode="auto"`. That is 3D when `preserve-3d` and `perspective` work, and `FilmStripFlat` otherwise. Phones stay on 3D (compact tier). Reduced motion pauses autoplay; it does not switch to flat. Force flat or 3D only if I ask, with `mode="flat"` or `mode="3d"`.

Keep the performance rules in `src/components/filmstrip/README.md`: max 16 images, composite-only `matrix3d` / opacity, no `will-change` and no blend modes on the moving slices, no `var()` in `background-image` on those slices, no `contain: paint`, no opacity/transform on an ancestor of the ribbon, and do not replace `overflow-x: clip` with `overflow: hidden` on a parent (Safari can turn the other axis into `auto` and clip the curl). The scratch tile is 720px wide and must match `GRAIN_TILE`.

Wire an empty state (already "No frames yet." when `images` is empty), keep the lightbox error line, and do not change the component's motion model to add a new effect.
```
