import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { fetchPhotos } from '../lib/contentApi'
import { imageAlt } from '../lib/sanity'
import { filmThumb, framePhotoUrl, framePhotoWidth, stripThumb } from '../lib/sanityImage'
import { mountPhotoStrip, prefetchImages, preloadImage, scheduleIdleWarm, showFullPhoto } from '../lib/photoLoad'
import { useGfx } from '../lib/useGfx'

const FilmStrip3D = lazy(() => import('../components/filmstrip/FilmStrip3D'))
import styled from 'styled-components'
import ImageModal from '../components/ImageModal'
import OrnatePhotoFrame from '../components/OrnatePhotoFrame'
import FrostNote from '../components/FrostNote'
import { font } from '../styles/theme'
import { nextPhotoIndex, photoAutoplayAllowed } from '../lib/stationFrame'

const AUTO_MS = 3000
const RESUME_MS = 4000
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
  /* Cover the opening while the frame eases between aspects. At rest the
     opening matches the photo, so cover shows the whole picture. */
  object-fit: cover;
  display: block;
  opacity: ${(p) => (p.$show ? 1 : 0)};
  transition: opacity 0.85s ease;
  pointer-events: none;
  z-index: ${(p) => (p.$show ? 2 : 1)};
`

/** Compact hairpin under the frame. Full viewport width, even if a parent is inset. */
const CurlBand = styled.div`
  flex: 0 0 clamp(72px, 22%, 168px);
  height: clamp(72px, 22%, 168px);
  width: 100vw;
  max-width: 100vw;
  margin-left: calc(50% - 50vw);
  min-height: 0;
  position: relative;
  z-index: 1;
  overflow: hidden;
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
const PREVIEW_CAP = 10

const FrozenRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${GAP}px;
  height: 100%;
  overflow: hidden;
  pointer-events: none;

  img {
    height: 70%;
    width: auto;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    flex: 0 0 auto;
    opacity: 0.8;
  }
`

function FrozenStrip({ photos }) {
  return (
    <FrozenRow aria-hidden>
      {photos.slice(0, PREVIEW_CAP).map((photo, index) => {
        const thumb = stripThumb(photo)
        if (!thumb.src) return null
        return (
          <img
            key={photo?.asset?._ref || index}
            src={thumb.src}
            width={thumb.width}
            height={thumb.height}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            ref={(node) => {
              if (node) node.setAttribute('fetchpriority', 'low')
            }}
          />
        )
      })}
    </FrozenRow>
  )
}

function supportsCss3d() {
  return typeof CSS !== 'undefined'
    && CSS.supports('transform-style', 'preserve-3d')
    && CSS.supports('perspective', '1px')
}

function filmItem(photo, index) {
  const src = filmThumb(photo)
  if (!src) return null
  const width = Number(photo?.width) || 0
  const height = Number(photo?.height) || 0
  return {
    src,
    alt: imageAlt(photo, 'Photograph by Ronnie Foreman'),
    label: `Show photo ${index + 1}`,
    width: width || undefined,
    height: height || undefined,
    aspect: width > 0 && height > 0 ? width / height : undefined,
  }
}

function LiveFilmStrip(props) {
  const { tier } = useGfx()
  return (
    <Suspense fallback={null}>
      <FilmStrip3D {...props} lowPower={tier === 'low'} />
    </Suspense>
  )
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
              decoding="async"
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
  const [can3d] = useState(() => typeof window !== 'undefined' && supportsCss3d())
  const [idleWarm, setIdleWarm] = useState(false)
  const frameW = useMemo(() => {
    if (typeof window === 'undefined') return 960
    return framePhotoWidth(window.innerWidth, window.devicePixelRatio || 1)
  }, [])
  const full = showFullPhoto({ pathname: location.pathname })
  const showStrip = mountPhotoStrip({ active })
  const [photos, setPhotos] = useState([])
  const [status, setStatus] = useState('loading')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [aspect, setAspect] = useState(4 / 3)
  const [layers, setLayers] = useState([{ key: 0, index: 0, show: true }])
  const layerKey = useRef(0)
  const aspects = useRef({})
  const resumeTimer = useRef(0)
  const hoverRef = useRef(false)
  const downRef = useRef(0)
  const panelRef = useRef(null)
  const [tabHidden, setTabHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden,
  )

  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Home stays on a thumbnail. After the intro, idle-warm the frame bitmap
  // and the next large still so arriving at the wall does not start cold.
  useEffect(() => {
    if (full) return undefined
    let alive = true
    const cancel = scheduleIdleWarm(() => {
      if (alive) setIdleWarm(true)
    })
    return () => {
      alive = false
      cancel()
    }
  }, [full])

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

  const stripItems = useMemo(() => {
    const entries = []
    photos.slice(0, STRIP_CAP).forEach((photo, index) => {
      const item = filmItem(photo, index)
      if (item) entries.push({ item, index })
    })
    return entries
  }, [photos])
  const stripIndexes = useMemo(() => stripItems.map((entry) => entry.index), [stripItems])

  // Auto-advance every 3s. The strip recenters on that frame, so the yellow
  // outline travels with it. The page stays mounted on the wall; `active` is
  // false until the camera is on this board, and the timer stays off then.
  useEffect(() => {
    if (!active) return undefined
    if (!photoAutoplayAllowed(location.pathname, tabHidden)) return undefined
    if (status !== 'ready' || stripIndexes.length < 2 || paused || isModalOpen) return undefined
    const reduced = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return undefined

    const id = window.setInterval(() => {
      setFeaturedIndex((i) => nextPhotoIndex(i, stripIndexes))
    }, AUTO_MS)
    return () => window.clearInterval(id)
  }, [active, location.pathname, tabHidden, status, stripIndexes, paused, isModalOpen])

  // Leaving the gallery puts the first frame back. The board stays in the
  // scene, so without this the last photo would keep sitting on the wall.
  useEffect(() => {
    if (location.pathname === '/photo') return undefined
    setFeaturedIndex(0)
    setIsModalOpen(false)
    setSelectedImage(null)
    setPaused(false)
    hoverRef.current = false
    downRef.current = 0
    window.clearTimeout(resumeTimer.current)
    return undefined
  }, [location.pathname])

  const holdInteract = useCallback((event) => {
    if (event.type === 'pointerenter') hoverRef.current = true
    if (event.type === 'pointerdown') downRef.current += 1
    setPaused(true)
    window.clearTimeout(resumeTimer.current)
  }, [])

  const releaseInteract = useCallback((event) => {
    if (event.type === 'pointerleave' || event.type === 'pointercancel') hoverRef.current = false
    if (event.type === 'pointerup' || event.type === 'pointercancel') {
      downRef.current = Math.max(0, downRef.current - 1)
    }
    if (hoverRef.current || downRef.current > 0) return
    window.clearTimeout(resumeTimer.current)
    resumeTimer.current = window.setTimeout(() => setPaused(false), RESUME_MS)
  }, [])

  const bumpPause = useCallback(() => {
    setPaused(true)
    window.clearTimeout(resumeTimer.current)
    resumeTimer.current = window.setTimeout(() => setPaused(false), RESUME_MS)
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

  const rememberAspect = (index, img) => {
    if (!img?.naturalWidth || !img?.naturalHeight) return
    const next = img.naturalWidth / img.naturalHeight
    const prev = aspects.current[index]
    aspects.current[index] = next
    if (index !== featuredIndex) return
    if (prev != null && Math.abs(prev - next) < 0.01) return
    setAspect(next)
  }

  const featured = photos[featuredIndex] || photos[0]
  const frameOn = full || idleWarm

  useEffect(() => {
    if (full || !idleWarm || !featured) return undefined
    // The frame bitmap is requested by the painted shell. These are the
    // large stills the wall does not show yet.
    const urls = []
    const hero = framePhotoUrl(featured, frameW)
    if (hero) urls.push(hero)
    if (photos.length > 1) {
      const next = framePhotoUrl(photos[(featuredIndex + 1) % photos.length], frameW)
      if (next && next !== hero) urls.push(next)
    }
    return prefetchImages(urls)
  }, [full, idleWarm, featured, featuredIndex, photos, frameW])

  useEffect(() => {
    if (!full || photos.length < 2) return undefined
    const href = framePhotoUrl(photos[(featuredIndex + 1) % photos.length], frameW)
    return preloadImage(href)
  }, [full, photos, featuredIndex, frameW])

  const featuredAspect = aspects.current[featuredIndex]
    ?? (Number(featured?.width) > 0 && Number(featured?.height) > 0
      ? Number(featured.width) / Number(featured.height)
      : aspect)
  const mediaItems = photos.map((photo) => ({ type: 'image', image: photo }))
  const caption = `${String(featuredIndex + 1).padStart(2, '0')} / ${String(photos.length).padStart(2, '0')}`
  const curlItems = useMemo(() => stripItems.map((entry) => entry.item), [stripItems])
  // The bent strip is a few hundred transformed layers. It stays unmounted
  // on the platform wall (`active` is false until the camera lands). The
  // thumbnail rail is only for browsers without CSS 3D.
  const stripSelect = stripItems.findIndex((entry) => entry.index === featuredIndex)
  const useCurl = can3d && photos.length > 1

  return (
    <>
      <Panel
        ref={panelRef}
        onPointerEnter={holdInteract}
        onPointerDown={holdInteract}
        onPointerLeave={releaseInteract}
        onPointerUp={releaseInteract}
        onPointerCancel={releaseInteract}
      >
        {status === 'loading' && <FrostNote>Loading photos…</FrostNote>}
        {status === 'empty' && <FrostNote>No photos yet.</FrostNote>}
        {status === 'error' && <FrostNote>Could not load photos.</FrostNote>}
        {status === 'ready' && featured ? (
          <>
            <Stage>
              <OrnatePhotoFrame
                aspect={featuredAspect}
                caption={caption}
                paint={frameOn}
                onClick={() => open(featured, featuredIndex)}
                aria-label={`Open featured photo: ${imageAlt(featured, 'Photograph by Ronnie Foreman')}`}
              >
                {layers.map((layer) => {
                  const photo = photos[layer.index]
                  if (!photo) return null
                  const src = full ? framePhotoUrl(photo, frameW) : filmThumb(photo)
                  if (!src) return null
                  return (
                    <Slide
                      key={layer.key}
                      src={src}
                      alt={layer.show ? imageAlt(photo, 'Photograph by Ronnie Foreman') : ''}
                      aria-hidden={layer.show ? undefined : true}
                      loading={full && layer.show ? 'eager' : 'lazy'}
                      decoding="async"
                      $show={layer.show}
                      ref={(node) => {
                        if (!node) return
                        const priority = full && layer.show ? 'high' : 'low'
                        if (node.getAttribute('fetchpriority') !== priority) {
                          node.setAttribute('fetchpriority', priority)
                        }
                      }}
                      onLoad={(e) => rememberAspect(layer.index, e.currentTarget)}
                    />
                  )
                })}
              </OrnatePhotoFrame>
            </Stage>

            {photos.length > 1 && useCurl ? (
              <CurlBand onPointerDown={showStrip ? bumpPause : undefined}>
                {showStrip ? (
                  <LiveFilmStrip
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
                ) : full ? null : (
                  <FrozenStrip photos={photos} />
                )}
              </CurlBand>
            ) : photos.length > 1 && showStrip ? (
              <FilmStrip
                photos={photos}
                index={featuredIndex}
                onIndexChange={setFeaturedIndex}
                onInteract={bumpPause}
              />
            ) : photos.length > 1 && !full ? (
              <FrozenStrip photos={photos} />
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
