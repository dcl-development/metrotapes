# Filmstrip (Metrotapes)

This folder holds the **live** photo-wall film strip used on `/photo` and shared helpers.

## What lives here

| File | Role |
| --- | --- |
| `FilmStrip3D.tsx` / `FilmStrip3D.module.css` | Metrotapes 3D ribbon (wired from `PhotoPage.jsx`) |
| `grain.ts` | Default scratch-plate URL (`/film-scratches-grain.webp`) and `cssUrl()` helper |
| `film-scratches-grain.webp` | Local copy of the scratch plate (also served from `public/film-scratches-grain.webp`) |
| `index.ts` | Re-exports `FilmStrip3D` and types |
| `package.json` | Peer-deps metadata for copying the portable package elsewhere |

## Full jakedcl.com package (wrapper + flat fallback)

The original self-contained export — `Filmstrip.tsx`, `FilmStripFlat`, lightbox shell, example page, and the long-form docs — is preserved verbatim under **`legacy/`**. See `legacy/README.md` for install notes, props, and performance rules. Grain imports in `legacy/` point at `../grain.ts` and the site `public/film-scratches-grain.webp`.

Nothing in the app imports `legacy/` today; it is reference-only and excluded from ESLint.
