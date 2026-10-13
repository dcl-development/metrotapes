'use client'

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import styles from './FilmStripFlat.module.css'
import type { FilmStripItem } from './FilmStrip3D'
import { cssUrl, DEFAULT_GRAIN_SRC } from './grain'

/**
 * Same frames and sprockets as the 3D strip, laid out in a straight row.
 * FilmStrip3D renders this when `mode` is `'flat'`, or when `mode` is `'auto'`
 * and the browser has no `preserve-3d` / `perspective` support.
 * Native overflow scroll plus a light autoplay. Not the phone tier: phones
 * stay on the 3D strip with fewer slices.
 */
export default function FilmStripFlat({
  items,
  onSelect,
  grainSrc = DEFAULT_GRAIN_SRC,
  active = true,
}: {
  items: FilmStripItem[]
  onSelect?: (item: FilmStripItem, index: number) => void
  /** Scratch plate. Inherited from FilmStrip3D when used as the fallback. */
  grainSrc?: string
  /** When false, autoplay's rAF loop is not started. */
  active?: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  // Shift the scratch plate by each frame's x so it is one continuous strip, then scrolls with the frames.
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const apply = () => {
      for (const frame of el.querySelectorAll<HTMLElement>('[data-film-frame]')) {
        frame.style.setProperty('--grain-shift', `${-Math.round(frame.offsetLeft)}px`)
      }
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [items])

  useEffect(() => {
    if (!active) return undefined
    const el = trackRef.current
    if (!el) return undefined
    let drag: { id: number; x: number; left: number; moved: boolean } | null = null
    let raf = 0
    let lastT = 0
    let paused = false
    let resumeAt = 0
    let autoScrolling = false
    const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduced = reduceMQ.matches
    // Duplicate list length for seamless wrap — scroll through one copy, then jump.
    const loopWidth = () => el.scrollWidth / 2

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      paused = true
      resumeAt = performance.now() + 2200
      if (e.pointerType !== 'mouse') return // touch uses native pan-x
      drag = { id: e.pointerId, x: e.clientX, left: el.scrollLeft, moved: false }
    }
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const dx = e.clientX - drag.x
      if (!drag.moved && Math.abs(dx) < 4) return
      drag.moved = true
      el.setAttribute('data-dragging', 'true')
      el.scrollLeft = drag.left - dx
    }
    const up = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) {
        if (drag.moved) {
          const block = (ev: Event) => {
            ev.preventDefault()
            ev.stopPropagation()
            el.removeEventListener('click', block, true)
          }
          el.addEventListener('click', block, true)
        }
        drag = null
        el.removeAttribute('data-dragging')
      }
      resumeAt = performance.now() + 2200
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (reduced || document.hidden) return
      if (paused) {
        if (now < resumeAt) return
        paused = false
        lastT = now
      }
      const dt = lastT ? Math.min((now - lastT) / 1000, 0.05) : 0.016
      lastT = now
      const half = loopWidth()
      if (half < 8) return
      autoScrolling = true
      el.scrollLeft += 28 * dt // ~slow crawl, matches 3D autoplay feel
      if (el.scrollLeft >= half) el.scrollLeft -= half
      autoScrolling = false
    }

    const onScroll = () => {
      const half = loopWidth()
      if (half > 8 && el.scrollLeft >= half - 1) {
        autoScrolling = true
        el.scrollLeft -= half
        autoScrolling = false
      }
      // Ignore scrolls we caused; pause only for real user scrubbing.
      if (autoScrolling || drag) return
      paused = true
      resumeAt = performance.now() + 2200
    }

    const onMQ = () => {
      reduced = reduceMQ.matches
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    reduceMQ.addEventListener?.('change', onMQ)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      reduceMQ.removeEventListener?.('change', onMQ)
    }
  }, [active])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return
    const next = buttons[index + (e.key === 'ArrowRight' ? 1 : -1)]
    if (!next) return
    e.preventDefault()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    next.focus()
    next.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reduced ? 'auto' : 'smooth',
    })
  }

  return (
    <div
      className={styles.flatWrap}
      data-filmstrip-flat=""
      style={{ '--fs3d-grain': cssUrl(grainSrc) } as CSSProperties}
    >
      <div
        ref={trackRef}
        className={styles.flatTrack}
        onKeyDown={onKeyDown}
      >
        {/* Two copies so autoplay can wrap without a jump. Second set is aria-hidden. */}
        {[0, 1].map((copy) =>
          items.map((it, i) => (
            <button
              key={`${copy}-${it.src}-${i}`}
              type="button"
              className={styles.flatFrame}
              data-film-frame=""
              aria-label={copy === 0 ? (it.label ?? it.alt) : undefined}
              aria-hidden={copy === 1 ? true : undefined}
              tabIndex={copy === 1 ? -1 : undefined}
              onClick={() => copy === 0 && onSelect?.(it, i)}
            >
              <span
                className={styles.flatWindow}
                style={
                  it.placeholder
                    ? { backgroundImage: `url("${it.placeholder.replace(/"/g, '')}")` }
                    : undefined
                }
              >
                {/* Decorative: the button name is the accessible label. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.src}
                  srcSet={it.src2x ? `${it.src} 480w, ${it.src2x} 800w` : undefined}
                  sizes="(max-width: 767px) 42vw, 168px"
                  alt=""
                  width={168}
                  height={112}
                  loading={copy === 0 && i < 3 ? 'eager' : 'lazy'}
                  decoding="async"
                  draggable={false}
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden'
                  }}
                />
              </span>
            </button>
          )),
        )}
      </div>
    </div>
  )
}
