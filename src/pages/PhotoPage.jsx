import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { fetchPhotos } from '../lib/contentApi'
import { imageAlt } from '../lib/sanity'
import { imageUrl, photoSources, stripThumb } from '../lib/sanityImage'
import FilmStrip3D from '../components/filmstrip/FilmStrip3D'
import styled from 'styled-components'
import ImageModal from '../components/ImageModal'
import OrnatePhotoFrame from '../components/OrnatePhotoFrame'
import FrostNote from '../components/FrostNote'
import { font } from '../styles/theme'
import { photoAutoplayAllowed } from '../lib/stationFrame'

const AUTO_MS = 4500
const GAP = 7
const COPIES = 5 // odd — we sit on the middle copy for infinite wrap

const Panel = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  overscroll-behavior: contain;
  /* Keep backdrop-filter (loading note) inside this page. Otherwise it
     samples the WebGL canvas and the lower half of the station tears. */
  isolation: isolate;
  background: #0a0908;
  color: #fff;
  box-sizing: border-box;
  padding: 0;
  pointer-events: auto;
  font-family: ${font};
`

const Stage = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px 4px;
  box-sizing: border-box;
  container-type: size;
  /* Above the film, which is allowed to curl up into this area.
     The box itself does not take clicks, so film beside the frame
     stays usable. The frame button turns pointer events back on. */
  position: relative;
  z-index: 2;
  pointer-events: none;
`

const Slide = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: ${(p) => (p.$show ? 1 : 0)};
  transition: opacity 0.85s ease;
  pointer-events: none;
  z-index: ${(p) => (p.$show ? 2 : 1)};
`

/** Compact band under the frame, full viewport width. The curl may paint
    upward out of this slot; the frame sits in a higher layer and blocks
    hits where they overlap. */
const CurlBand = styled.div`
  flex: 0 0 clamp(72px, 22%, 168px);
  height: clamp(72px, 22%, 168px);
  width: 100vw;
  max-width: 100vw;
  margin-left: calc(50% - 50vw);
  min-height: 0;
  position: relative;
  z-index: 1;
  overflow: visible;
`

const StripRail = styled.div`
  position: relative;
  flex: 0 0 auto;
  width: 100%;
  overflow: hidden;
  padding: 10px 0 12px;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.45)),
    #100c08;
  border-top: 1px solid rgba(196, 160, 106, 0.16);
  touch-action: none;
  cursor: grab;
  user-select: none;

  &:active {
    cursor: grabbing;
  }

  /* Center tick — the “gate” the film passes through */
  &::after {
    content: '';
    position: absolute;
    top: 6px;
    bottom: 8px;
    left: 50%;
    width: 2px;
    transform: translateX(-50%);
    background: linear-gradient(
      180deg,
      transparent,
      rgba(196, 160, 106, 0.85) 18%,
      rgba(196, 160, 106, 0.85) 82%,
      transparent
    );
    pointer-events: none;
    z-index: 3;
    opacity: 0.7;
  }
`

const StripTrack = styled.div`
  display: flex;
  width: max-content;
  gap: ${GAP}px;
  padding: 0;
  will-change: transform;
`

const StripShot = styled.div`
  flex: 0 0 auto;
  width: var(--shot-w, 110px);
  aspect-ratio: 4 / 3;
  border: 2px solid ${(p) => (p.$on ? '#c4a06a' : 'rgba(255, 230, 190, 0.14)')};
  background: #000;
  overflow: hidden;
  transform: scale(${(p) => (p.$on ? 1.06 : 1)});
  transition: transform 0.2s ease, border-color 0.2s ease;
  box-shadow: ${(p) => (p.$on ? '0 0 0 1px rgba(196, 160, 106, 0.35)' : 'none')};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: ${(p) => (p.$on ? 1 : 0.72)};
    pointer-events: none;
  }
`

const STRIP_CAP = 16
/* Below this the frame and a curled band cannot share the page. Phones sit above it. */
const MIN_PAGE_H = 200

function supportsCss3d() {
  return typeof CSS !== 'undefined'
    && CSS.supports('transform-style', 'preserve-3d')
    && CSS.supports('perspective', '1px')
}

function filmItem(photo, index) {
  const sources = photoSources(photo)
  const src = imageUrl(photo, { width: 640 }) || sources.src
  if (!src) return null
  const alt = imageAlt(photo, 'Photograph by Ronnie Foreman')
  const sharp = sources.src && sources.src !== src ? sources.src : undefined
  return {
    src,
    src2x: sharp,
    alt,
    label: `Show photo ${index + 1}`,
    width: sources.width,
    height: sources.height,
    aspect: sources.width && sources.height ? sources.width / sources.height : undefined,
  }
}

function shotWidth() {
  if (typeof window === 'undefined') return 110
  const w = window.innerWidth
  return Math.round(Math.min(132, Math.max(88, w * 0.14)))
}

function FilmStrip({
  photos,
  index,
  onIndexChange,
  onInteract,
}) {
  const railRef = useRef(null)
  const trackRef = useRef(null)
  const xRef = useRef(0)
  const velRef = useRef(0)
  const dragRef = useRef(null)
  const rafRef = useRef(0)
  const cellRef = useRef(shotWidth() + GAP)
  const skipEaseRef = useRef(false)
  const activeRef = useRef(index)
  const n = photos.length
  const [shotW, setShotW] = useState(shotWidth)
  const [active, setActive] = useState(index)

  const cells = useMemo(() => {
    const out = []
    for (let c = 0; c < COPIES; c += 1) {
      for (let i = 0; i < n; i += 1) {
        out.push({ photo: photos[i], real: i, key: `${c}-${i}` })
      }
    }
    return out
  }, [photos, n])

  const loopW = useCallback(() => n * cellRef.current, [n])

  const applyX = useCallback((x) => {
    const track = trackRef.current
    if (!track) return
    const loop = loopW()
    if (loop > 0) {
      const mid = loop * Math.floor(COPIES / 2)
      while (x < mid - loop * 0.5) x += loop
      while (x > mid + loop * 1.5) x -= loop
    }
    xRef.current = x
    track.style.transform = `translate3d(${-x}px, 0, 0)`
  }, [loopW])

  const indexFromX = useCallback((x) => {
    const rail = railRef.current
    if (!rail || n < 1) return 0
    const cell = cellRef.current
    const center = x + rail.clientWidth / 2
    const i = Math.round((center - cell / 2) / cell)
    return ((i % n) + n) % n
  }, [n])

  const xForIndex = useCallback((i) => {
    const rail = railRef.current
    if (!rail) return 0
    const cell = cellRef.current
    const loop = loopW()
    const mid = loop * Math.floor(COPIES / 2)
    const targetCenter = mid + i * cell + cell / 2
    return targetCenter - rail.clientWidth / 2
  }, [loopW])

  const reportIndex = useCallback((next) => {
    activeRef.current = next
    setActive(next)
    skipEaseRef.current = true
    onIndexChange(next)
  }, [onIndexChange])

  const syncActive = useCallback((x) => {
    const next = indexFromX(x)
    if (next !== activeRef.current) reportIndex(next)
  }, [indexFromX, reportIndex])

  /** Ease strip so photo `real` lands on the center tick. */
  const easeToIndex = useCallback((real, { report = true } = {}) => {
    cancelAnimationFrame(rafRef.current)
    if (report) reportIndex(real)

    const start = xRef.current
    const goal = xForIndex(real)
    const loop = loopW()
    let delta = goal - start
    if (loop > 0) {
      while (delta > loop / 2) delta -= loop
      while (delta < -loop / 2) delta += loop
    }
    // Already there
    if (Math.abs(delta) < 1) {
      applyX(goal)
      activeRef.current = real
      setActive(real)
      return
    }

    const end = start + delta
    const dur = Math.min(700, Math.max(320, Math.abs(delta) * 0.55))
    const t0 = performance.now()

    const tick = (now) => {
      if (dragRef.current) return
      const t = Math.min(1, (now - t0) / dur)
      const e = 1 - (1 - t) ** 3
      applyX(start + (end - start) * e)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else {
        applyX(xForIndex(real))
        activeRef.current = real
        setActive(real)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [applyX, loopW, reportIndex, xForIndex])

  useEffect(() => {
    const measure = () => {
      const w = shotWidth()
      setShotW(w)
      cellRef.current = w + GAP
      applyX(xForIndex(index))
      activeRef.current = index
      setActive(index)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, photos])

  // Parent-driven advance (auto-rotate) → ease strip so that photo hits center.
  useEffect(() => {
    if (skipEaseRef.current) {
      skipEaseRef.current = false
      activeRef.current = index
      setActive(index)
      return undefined
    }
    if (dragRef.current) return undefined
    easeToIndex(index, { report: false })
    return () => cancelAnimationFrame(rafRef.current)
  }, [index, easeToIndex])

  const coast = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    const step = () => {
      if (dragRef.current) return
      let v = velRef.current
      if (Math.abs(v) < 0.05) {
        const nearest = indexFromX(xRef.current)
        easeToIndex(nearest, { report: true })
        return
      }
      v *= 0.955
      velRef.current = v
      applyX(xRef.current + v)
      syncActive(xRef.current)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }, [applyX, indexFromX, easeToIndex, syncActive])

  const onPointerDown = (e) => {
    onInteract?.()
    cancelAnimationFrame(rafRef.current)
    velRef.current = 0
    dragRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      origin: xRef.current,
      lastX: e.clientX,
      lastT: performance.now(),
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    const now = performance.now()
    const dx = e.clientX - d.startX
    if (Math.abs(dx) > 5) d.moved = true
    applyX(d.origin - dx)
    const dt = Math.max(8, now - d.lastT)
    velRef.current = -(e.clientX - d.lastX) / dt * 16
    d.lastX = e.clientX
    d.lastT = now
    syncActive(xRef.current)
  }

  const onPointerUp = (e) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }

    // Tap: scroll that photo to the center tick — strip is source of truth.
    if (!d.moved) {
      const rail = railRef.current
      if (!rail) return
      const rect = rail.getBoundingClientRect()
      const local = e.clientX - rect.left + xRef.current
      const abs = Math.floor(local / cellRef.current)
      const real = ((abs % n) + n) % n
      onInteract?.()
      easeToIndex(real, { report: true })
      return
    }
    coast()
  }

  return (
    <StripRail
      ref={railRef}
      aria-label="Photo strip — drag to scroll"
      style={{ '--shot-w': `${shotW}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <StripTrack ref={trackRef}>
        {cells.map((cell) => (
          <StripShot
            key={cell.key}
            $on={cell.real === active}
            aria-hidden
          >
            <img
              {...stripThumb(cell.photo)}
              alt=""
              loading="lazy"
              draggable={false}
            />
          </StripShot>
        ))}
      </StripTrack>
    </StripRail>
  )
}

export default function PhotoPage({ active = true }) {
  const location = useLocation()
  const panelRef = useRef(null)
  const [pageH, setPageH] = useState(0)
  const [can3d] = useState(() => typeof window !== 'undefined' && supportsCss3d())
  const [photos, setPhotos] = useState([])
  const [status, setStatus] = useState('loading')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [layers, setLayers] = useState([{ key: 0, index: 0, show: true }])
  const layerKey = useRef(0)
  const resumeTimer = useRef(0)
  const [tabHidden, setTabHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden,
  )

  useEffect(() => {
    const el = panelRef.current
    if (!el) return undefined
    const measure = () => setPageH(el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    let alive = true
    fetchPhotos().then((data) => {
      if (!alive) return
      if (data?.length) {
        setPhotos(data)
        setFeaturedIndex(0)
        setStatus('ready')
      } else {
        setStatus('empty')
      }
    }).catch(() => {
      if (alive) setStatus('error')
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    setLayers((prev) => {
      const top = prev.find((l) => l.show) || prev[prev.length - 1]
      if (!top || top.index === featuredIndex) return prev
      layerKey.current += 1
      return [
        { ...top, show: false },
        { key: layerKey.current, index: featuredIndex, show: true },
      ]
    })
    const clear = window.setTimeout(() => {
      setLayers((prev) => prev.filter((l) => l.show))
    }, 1000)
    return () => window.clearTimeout(clear)
  }, [featuredIndex])

  // Auto-advance every ~4.5s — strip recenters, frame follows.
  // The page stays mounted on the wall even when that board is hidden.
  // While the camera is still on the way, `active` is false and the frame holds.
  useEffect(() => {
    if (!active) return undefined
    if (!photoAutoplayAllowed(location.pathname, tabHidden)) return undefined
    if (status !== 'ready' || photos.length < 2 || paused || isModalOpen) return undefined
    const reduced = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return undefined

    const id = window.setInterval(() => {
      setFeaturedIndex((i) => (i + 1) % photos.length)
    }, AUTO_MS)
    return () => window.clearInterval(id)
  }, [active, location.pathname, tabHidden, status, photos.length, paused, isModalOpen])

  const bumpPause = useCallback(() => {
    setPaused(true)
    window.clearTimeout(resumeTimer.current)
    resumeTimer.current = window.setTimeout(() => setPaused(false), 5000)
  }, [])

  useEffect(() => () => window.clearTimeout(resumeTimer.current), [])

  const handleModalClose = (newImage) => {
    if (newImage) setSelectedImage(newImage)
    else {
      setIsModalOpen(false)
      setSelectedImage(null)
    }
  }

  const open = (photo, index) => {
    if (typeof index === 'number') setFeaturedIndex(index)
    setSelectedImage(photo)
    setIsModalOpen(true)
  }

  const featured = photos[featuredIndex] || photos[0]
  const mediaItems = photos.map((photo) => ({ type: 'image', image: photo }))
  const caption = `${String(featuredIndex + 1).padStart(2, '0')} / ${String(photos.length).padStart(2, '0')}`
  const stripItems = useMemo(() => {
    const entries = []
    photos.slice(0, STRIP_CAP).forEach((photo, index) => {
      const item = filmItem(photo, index)
      if (item) entries.push({ item, index })
    })
    return entries
  }, [photos])
  const curlItems = useMemo(() => stripItems.map((entry) => entry.item), [stripItems])
  // Same band on the wall and after arrival. The curl stays mounted but
  // paused until the camera lands (`active`). No CSS 3D, or a page so short
  // the frame would be crowded, keeps the original thumbnail rail.
  const stripSelect = stripItems.findIndex((entry) => entry.index === featuredIndex)
  const useCurl = can3d && stripItems.length > 0 && (pageH === 0 || pageH >= MIN_PAGE_H)

  return (
    <>
      <Panel ref={panelRef}>
        {status === 'loading' && <FrostNote>Loading photos…</FrostNote>}
        {status === 'empty' && <FrostNote>No photos yet.</FrostNote>}
        {status === 'error' && <FrostNote>Could not load photos.</FrostNote>}
        {status === 'ready' && featured ? (
          <>
            <Stage>
              <OrnatePhotoFrame
                caption={caption}
                onClick={() => open(featured, featuredIndex)}
                aria-label={`Open featured photo: ${imageAlt(featured, 'Photograph by Ronnie Foreman')}`}
              >
                {layers.map((layer) => {
                  const photo = photos[layer.index]
                  if (!photo) return null
                  const sources = photoSources(photo)
                  return (
                    <Slide
                      key={layer.key}
                      src={sources.src}
                      srcSet={sources.srcSet}
                      sizes={sources.sizes}
                      alt={layer.show ? imageAlt(photo, 'Photograph by Ronnie Foreman') : ''}
                      aria-hidden={layer.show ? undefined : true}
                      $show={layer.show}
                    />
                  )
                })}
              </OrnatePhotoFrame>
            </Stage>

            {photos.length > 1 && useCurl ? (
              <CurlBand onPointerDown={bumpPause}>
                <FilmStrip3D
                  items={curlItems}
                  active={active}
                  mode="3d"
                  variant="loop"
                  turnSharpness={1.2}
                  depth={0.62}
                  perspective={1300}
                  speed={0}
                  height="100%"
                  selectedIndex={stripSelect >= 0 ? stripSelect : undefined}
                  ariaLabel="Photo strip"
                  onSelect={(_item, index) => {
                    const photoIndex = stripItems[index]?.index
                    if (typeof photoIndex === 'number') setFeaturedIndex(photoIndex)
                    bumpPause()
                  }}
                />
              </CurlBand>
            ) : photos.length > 1 ? (
              <FilmStrip
                photos={photos}
                index={featuredIndex}
                onIndexChange={setFeaturedIndex}
                onInteract={bumpPause}
              />
            ) : null}
          </>
        ) : null}
      </Panel>
      {typeof document !== 'undefined'
        ? createPortal(
          <ImageModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            currentImage={selectedImage}
            mediaItems={mediaItems}
          />,
          document.body,
        )
        : null}
    </>
  )
}
