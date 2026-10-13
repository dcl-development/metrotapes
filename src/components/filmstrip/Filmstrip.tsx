'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import FilmStrip3D, {
  prefersSmallImages,
  type FilmStripItem,
  type FilmStripMode,
} from './FilmStrip3D'
import { DEFAULT_GRAIN_SRC } from './grain'
import styles from './Filmstrip.module.css'

export type { FilmStripMode }

const MAX_IMAGES = 16

export type FilmstripImage = {
  src: string
  alt: string
  /** Sharper file for 2× screens. Skipped on slow / save-data connections. */
  src2x?: string
  /** Lightbox srcset, e.g. `"a.jpg 800w, b.jpg 1600w"`. Built from src + src2x when omitted. */
  srcSet?: string
  /** Tiny data-uri so the frame isn't blank while `src` loads. */
  placeholder?: string
  caption?: string
  width?: number
  height?: number
  /** width / height. Defaults to 4 / 3 so every frame shares one pitch. */
  aspect?: number
  label?: string
  href?: string
}

export type FilmstripProps = {
  /** Frames, in order. The strip uses the first `maxImages` (default 16). */
  images?: FilmstripImage[]
  /**
   * `'auto'` (default): 3D when the browser supports it, otherwise the flat strip.
   * `'3d'` or `'flat'` forces that renderer. See the README.
   */
  mode?: FilmStripMode
  /** Cover the strip until the first frame is posed, then fade the cover off. */
  entrance?: boolean
  /** Veil color while `entrance` is covering the strip. Default cream `#f6f3ec`. */
  stageColor?: string
  /** Autoplay multiplier. 1 ≈ 0.4 frames/s. 0 pauses. Negative reverses. Default 0.8. */
  speed?: number
  variant?: 'loop' | 'ribbon' | 'helix'
  amplitude?: number
  turnSharpness?: number
  depth?: number
  perspective?: number
  gap?: number
  stockLabel?: string
  height?: number | string
  lowPower?: boolean
  className?: string
  ariaLabel?: string
  grainSrc?: string
  printFont?: string
  /** Edge-print and lightbox count color. Default `#f6c915`. */
  ink?: string
  /** Hard cap. More than 16 frames stalls phones. Default 16. */
  maxImages?: number
  /** Open the built-in lightbox on activate. Default true. */
  lightbox?: boolean
  /**
   * When false, neither the 3D loop nor the flat autoplay schedules a frame.
   * Tiers, reduced motion, and the CSS-3D fallback stay as documented.
   * Default true.
   */
  active?: boolean
  onSelect?: (image: FilmstripImage, index: number) => void
  onReady?: () => void
}

function aspectOfImage(image: FilmstripImage): number {
  if (image.aspect && image.aspect > 0) return image.aspect
  if (image.width && image.height) return image.width / image.height
  return 4 / 3
}

export default function Filmstrip({
  images,
  mode = 'auto',
  entrance = false,
  stageColor = '#f6f3ec',
  speed = 0.8,
  variant = 'loop',
  amplitude,
  turnSharpness = 1,
  depth = 1,
  perspective,
  gap,
  stockLabel,
  height,
  lowPower,
  className,
  ariaLabel = 'Photo filmstrip',
  grainSrc = DEFAULT_GRAIN_SRC,
  printFont,
  ink = '#f6c915',
  maxImages = MAX_IMAGES,
  lightbox = true,
  active = true,
  onSelect,
  onReady,
}: FilmstripProps) {
  const [revealed, setRevealed] = useState(false)
  const handleReady = useCallback(() => {
    setRevealed(true)
    onReady?.()
  }, [onReady])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const [imgState, setImgState] = useState<'loading' | 'ready' | 'error'>('loading')
  const dialogRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const swipeRef = useRef<{ x: number; y: number; id: number } | null>(null)
  const swipedRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const cap = Number.isFinite(maxImages) ? Math.max(0, Math.floor(maxImages)) : MAX_IMAGES
  const frames = useMemo(
    () => (images ?? []).filter((image) => image?.src).slice(0, cap),
    [images, cap],
  )

  const items = useMemo<FilmStripItem[]>(
    () =>
      frames.map((image, i) => {
        const alt = image.alt || `Frame ${i + 1}`
        return {
          src: image.src,
          src2x: image.src2x,
          placeholder: image.placeholder,
          alt,
          label: image.label ?? `Open ${alt}`,
          href: lightbox ? undefined : image.href,
          width: image.width,
          height: image.height,
          aspect: aspectOfImage(image),
        }
      }),
    [frames, lightbox],
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  const navigateLightbox = useCallback(
    (direction: 'prev' | 'next') => {
      if (selectedIndex === null || frames.length === 0) return
      if (direction === 'prev') {
        setSelectedIndex(selectedIndex === 0 ? frames.length - 1 : selectedIndex - 1)
      } else {
        setSelectedIndex(selectedIndex === frames.length - 1 ? 0 : selectedIndex + 1)
      }
    },
    [selectedIndex, frames.length],
  )

  useEffect(() => {
    setImgState('loading')
  }, [selectedIndex])

  useEffect(() => {
    if (selectedIndex === null) return

    openerRef.current = document.activeElement as HTMLElement | null
    const scrollY = window.scrollY
    const body = document.body
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    }
    // position:fixed stops iOS from scrolling the page behind the dialog.
    // overflow:hidden alone does not.
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'

    const dialog = dialogRef.current
    dialog?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setSelectedIndex(null)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        navigateLightbox('prev')
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        navigateLightbox('next')
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const nodes = [...dialog.querySelectorAll<HTMLElement>('button, [href], img')].filter(
        (el) => !el.hasAttribute('disabled'),
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.left = prev.left
      body.style.right = prev.right
      body.style.width = prev.width
      window.scrollTo(0, scrollY)
      openerRef.current?.focus?.()
    }
  }, [selectedIndex, navigateLightbox])

  if (!frames.length) {
    return (
      <section className={className ? `${styles.empty} ${className}` : styles.empty} aria-label={ariaLabel}>
        <p>No frames yet.</p>
      </section>
    )
  }

  const selected = selectedIndex !== null ? frames[selectedIndex] : null
  const smallNet = mounted && selected ? prefersSmallImages() : false
  const selectedSrc = selected ? (smallNet ? selected.src : selected.src2x || selected.src) : ''
  const selectedSet =
    selected && !smallNet
      ? selected.srcSet ||
        (selected.src2x ? `${selected.src} 1x, ${selected.src2x} 2x` : undefined)
      : undefined
  const countLabel =
    selectedIndex !== null
      ? `${String(selectedIndex + 1).padStart(2, '0')} / ${String(frames.length).padStart(2, '0')}`
      : ''
  const photoW = selected?.width
  const photoH = selected?.height
  const photoRatio = photoW && photoH ? photoW / photoH : undefined
  const frameMaxH =
    typeof CSS !== 'undefined' && CSS.supports('height', '1dvh') ? 'min(78dvh, 78vh)' : '78vh'

  const close = () => setSelectedIndex(null)

  const onLightboxPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    swipeRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    swipedRef.current = false
  }

  const onLightboxPointerUp = (e: React.PointerEvent) => {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start || start.id !== e.pointerId) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return
    swipedRef.current = true
    navigateLightbox(dx < 0 ? 'next' : 'prev')
  }

  const onBackdropClick = () => {
    if (swipedRef.current) {
      swipedRef.current = false
      return
    }
    close()
  }

  const openFrame = (index: number) => {
    swipedRef.current = false
    onSelectRef.current?.(frames[index], index)
    if (lightbox) setSelectedIndex(index)
  }

  const dialog =
    mounted &&
    lightbox &&
    selected &&
    selectedSrc &&
    createPortal(
      <div
        ref={dialogRef}
        className={styles.dialog}
        style={{ ['--fs3d-ink' as string]: ink }}
        onClick={onBackdropClick}
        onPointerDown={onLightboxPointerDown}
        onPointerUp={onLightboxPointerUp}
        onPointerCancel={() => {
          swipeRef.current = null
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Image lightbox"
        tabIndex={-1}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            close()
          }}
          className={`${styles.iconButton} ${styles.closeButton}`}
          aria-label="Close"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            navigateLightbox('prev')
          }}
          className={`${styles.iconButton} ${styles.prevButton}`}
          aria-label="Previous"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            navigateLightbox('next')
          }}
          className={`${styles.iconButton} ${styles.nextButton}`}
          aria-label="Next"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className={styles.frameColumn} onClick={(e) => e.stopPropagation()}>
          <div
            className={imgState === 'error' || !photoRatio ? `${styles.frame} ${styles.frameError}` : styles.frame}
            style={
              imgState === 'error' || !photoRatio
                ? undefined
                : {
                    aspectRatio: `${photoW} / ${photoH}`,
                    width: `min(100%, calc(${frameMaxH} * ${photoRatio}))`,
                    maxHeight: frameMaxH,
                  }
            }
          >
            {imgState === 'error' ? (
              <p className={styles.errorText}>This frame didn&apos;t load.</p>
            ) : (
              /* Plain img on purpose: the host chooses the URL. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={selectedSrc}
                src={selectedSrc}
                srcSet={selectedSet}
                sizes="(max-width: 768px) 92vw, min(80vw, 1200px)"
                alt={selected.alt || `Gallery image ${(selectedIndex ?? 0) + 1}`}
                width={photoW || 1200}
                height={photoH || 900}
                decoding="async"
                fetchPriority="high"
                ref={(node) => {
                  if (node?.complete && node.naturalWidth > 0) setImgState('ready')
                }}
                onLoad={() => setImgState('ready')}
                onError={() => setImgState('error')}
                className={styles.photo}
                style={{ opacity: imgState === 'ready' ? 1 : 0 }}
                aria-busy={imgState === 'loading'}
              />
            )}
          </div>
          <p className={styles.count}>{countLabel}</p>
          {selected.caption && <p className={styles.caption}>{selected.caption}</p>}
        </div>
      </div>,
      document.body,
    )

  const sectionClass = className ? `${styles.section} ${className}` : styles.section

  return (
    <>
      <section
        className={sectionClass}
        style={
          {
            ['--fs3d-ink' as string]: ink,
            ['--fs3d-stage' as string]: stageColor,
          }
        }
        aria-label={ariaLabel}
      >
        <FilmStrip3D
          items={items}
          onReady={entrance ? handleReady : onReady}
          speed={selectedIndex === null ? speed : 0}
          variant={variant}
          amplitude={amplitude}
          turnSharpness={turnSharpness}
          depth={depth}
          perspective={perspective}
          gap={gap}
          stockLabel={stockLabel}
          height={height}
          lowPower={lowPower}
          grainSrc={grainSrc}
          printFont={printFont}
          mode={mode}
          active={active}
          ariaLabel="Photo film strip"
          onSelect={lightbox || onSelect ? (_item, index) => openFrame(index) : undefined}
        />
        {entrance && (
          <div aria-hidden className={revealed ? `${styles.veil} ${styles.veilOut}` : styles.veil} />
        )}
      </section>
      {dialog}
    </>
  )
}
