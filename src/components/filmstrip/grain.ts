/** Copy `film-scratches-grain.webp` to the host `public/` folder, or pass another URL. */
export const DEFAULT_GRAIN_SRC = '/film-scratches-grain.webp'

/** CSS `url()` value. Encodes quotes so a path cannot break out of the string. */
export function cssUrl(src: string) {
  return `url("${src.replace(/["\\\n\r]/g, (c) => encodeURIComponent(c))}")`
}
