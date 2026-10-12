import { useEffect, useRef, useState } from 'react'
import styled, { keyframes, css } from 'styled-components'
import FrostNote from '../components/FrostNote'
import StationPlate from '../components/StationPlate'
import { loadVideoCatalog, youtubeThumb } from '../lib/videoCatalog'
import { font, route } from '../styles/theme'

const GREEN = route.video

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`

const Container = styled.div`
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  isolation: isolate;
  background: #0a0b0c;
  padding: 10px 10px 24px;
  box-sizing: border-box;
  pointer-events: auto;
  -webkit-overflow-scrolling: touch;
  color: #fff;
  font-family: ${font};
`

const Shell = styled.div`
  max-width: 860px;
  margin: 0 auto;
`

/** One chassis: screen + deck + queue. */
const Player = styled.div`
  background: #121417;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 12px 40px rgba(0, 0, 0, 0.45);
`

const ScreenBezel = styled.div`
  padding: 8px 8px 0;
  background:
    linear-gradient(180deg, #1a1d21 0%, #121417 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.55);
`

const Frame = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  overflow: hidden;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    inset 0 0 24px rgba(0, 0, 0, 0.65);
`

const VideoIframe = styled.iframe`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
`

const Thumb = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
  transform: scale(1.06);
  transform-origin: center;
`

const PlayDisc = styled.span`
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 1;
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  margin: ${(p) => `-${p.$size / 2}px 0 0 -${p.$size / 2}px`};
  border-radius: 50%;
  background: rgba(10, 10, 12, 0.72);
  border: 1.5px solid rgba(255, 255, 255, 0.92);
  pointer-events: none;

  &::after {
    content: '';
    position: absolute;
    left: 54%;
    top: 50%;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: ${(p) => `${Math.round(p.$size * 0.16)}px 0 ${Math.round(p.$size * 0.16)}px ${Math.round(p.$size * 0.28)}px`};
    border-color: transparent transparent transparent #fff;
    transform: translate(-35%, -50%);
  }
`

const Time = styled.span`
  position: absolute;
  right: 7px;
  bottom: 7px;
  z-index: 1;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.88);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  line-height: 1.2;
  pointer-events: none;
`

const Scrim = styled.span`
  position: absolute;
  inset: auto 0 0;
  height: 42%;
  pointer-events: none;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.55));
`

const PlayButton = styled.button`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: #000;
  cursor: pointer;

  &:hover img { opacity: 0.9; }
  &:hover ${PlayDisc} { background: rgba(10, 10, 12, 0.84); }
`

/** Now-playing deck under the screen. */
const Deck = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px 16px;
  align-items: center;
  padding: 12px 14px 14px;
  background: #0e1013;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(0, 0, 0, 0.5);

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
`

const DeckInfo = styled.div`
  min-width: 0;
`

const Status = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${(p) => (p.$live ? GREEN : 'rgba(255, 255, 255, 0.4)')};
`

const Led = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${(p) => (p.$live ? GREEN : 'rgba(255, 255, 255, 0.22)')};
  box-shadow: ${(p) => (p.$live ? `0 0 8px ${GREEN}` : 'none')};
  ${(p) => p.$live && css`
    animation: ${blink} 1.2s steps(1, end) infinite;
  `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const NowTitle = styled.h1`
  margin: 0;
  font-size: clamp(0.98rem, 2.5vw, 1.2rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.25;
`

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem 0.55rem;
  margin-top: 5px;
  font-size: 0.74rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: rgba(255, 255, 255, 0.48);
  font-variant-numeric: tabular-nums;
`

const MetaDot = styled.span`
  opacity: 0.4;
`

const Transport = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;

  @media (max-width: 520px) {
    justify-content: flex-start;
  }
`

const TwBtn = styled.button`
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: #181b1f;
  color: #fff;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.28);
    background: #22262b;
  }

  &:active:not(:disabled) {
    background: #0c0e10;
  }

  &:disabled {
    opacity: 0.28;
    cursor: default;
  }

  svg {
    display: block;
  }
`

const PlayTw = styled(TwBtn)`
  width: 48px;
  height: 48px;
  border-color: ${(p) => (p.$live ? GREEN : 'rgba(255, 255, 255, 0.18)')};
  background: ${(p) => (p.$live ? 'rgba(0, 147, 60, 0.18)' : '#1a1e23')};
  color: ${(p) => (p.$live ? GREEN : '#fff')};

  &:hover:not(:disabled) {
    border-color: ${GREEN};
    background: rgba(0, 147, 60, 0.28);
    color: #fff;
  }
`

const QueueHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 14px 8px;
  background: #121417;
`

const QueueLabel = styled.h2`
  margin: 0;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
`

const QueueCount = styled.span`
  font-size: 0.8rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.3);
  font-variant-numeric: tabular-nums;
`

const List = styled.div`
  display: flex;
  flex-direction: column;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
`

const Clip = styled.button`
  display: grid;
  grid-template-columns: 28px minmax(104px, 28%) 1fr;
  gap: 0 10px;
  align-items: center;
  width: 100%;
  padding: 0 10px 0 8px;
  min-height: 64px;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: ${(p) => (p.$on ? 'rgba(0, 147, 60, 0.12)' : 'transparent')};
  box-shadow: ${(p) => (p.$on ? `inset 3px 0 0 ${GREEN}` : 'none')};
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: ${(p) => (p.$on ? 'rgba(0, 147, 60, 0.16)' : 'rgba(255, 255, 255, 0.04)')};
  }

  &:hover img { opacity: 0.92; }

  @media (max-width: 420px) {
    grid-template-columns: 22px minmax(96px, 34%) 1fr;
    gap: 0 8px;
    padding: 0 8px 0 6px;
  }
`

const Index = styled.span`
  font-size: 0.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: ${(p) => (p.$on ? GREEN : 'rgba(255, 255, 255, 0.32)')};
  text-align: center;
`

const ClipFrame = styled.div`
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #000;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
`

const ClipBody = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding: 10px 4px 10px 0;
`

const ClipTitle = styled.span`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.28;
  color: ${(p) => (p.$on ? '#fff' : 'rgba(255, 255, 255, 0.88)')};
`

const ClipMeta = styled.span`
  display: block;
  margin-top: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: ${(p) => (p.$on ? GREEN : 'rgba(255, 255, 255, 0.4)')};
  font-variant-numeric: tabular-nums;
`

function IconPrev() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="currentColor" d="M4 3h2v12H4V3zm3.2 6L14 3.8v10.4L7.2 9z" />
    </svg>
  )
}

function IconNext() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="currentColor" d="M12 3h2v12h-2V3zM4 3.8L10.8 9 4 14.2V3.8z" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="currentColor" d="M5 3.5v11l10-5.5L5 3.5z" />
    </svg>
  )
}

function IconPause() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="currentColor" d="M4 3h4v12H4V3zm6 0h4v12h-4V3z" />
    </svg>
  )
}

function YtThumb({ videoId, alt = '', lazy = false }) {
  const src = youtubeThumb(videoId)
  if (!src) return null
  return (
    <Thumb
      src={src}
      alt={alt}
      width={480}
      height={360}
      loading={lazy ? 'lazy' : 'eager'}
    />
  )
}

function ThumbChrome({ videoId, duration, lazy = false, size = 40, showPlay = true }) {
  return (
    <>
      <YtThumb videoId={videoId} lazy={lazy} />
      <Scrim aria-hidden="true" />
      {showPlay ? <PlayDisc $size={size} aria-hidden="true" /> : null}
      {duration ? <Time>{duration}</Time> : null}
    </>
  )
}

export default function VideoPage() {
  const scroller = useRef(null)
  const [videos, setVideos] = useState([])
  const [status, setStatus] = useState('loading')
  const [statusDetail, setStatusDetail] = useState('')
  const [featuredId, setFeaturedId] = useState(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    let alive = true
    loadVideoCatalog().then((entry) => {
      if (!alive) return
      setVideos(entry.data || [])
      setStatus(entry.status === 'idle' ? 'loading' : entry.status)
      setStatusDetail(entry.detail || '')
      if (entry.status === 'ready' && entry.data?.[0]) {
        setFeaturedId(entry.data[0].videoId)
      }
    })
    return () => { alive = false }
  }, [])

  const featured = videos.find((v) => v.videoId === featuredId) || videos[0]
  const featuredIndex = Math.max(0, videos.findIndex((v) => v.videoId === featured?.videoId))
  const featuredDate = formatDate(featured?.publishedAt)
  const canPrev = featuredIndex > 0
  const canNext = featuredIndex >= 0 && featuredIndex < videos.length - 1

  const openClip = (videoId, autoplay = true) => {
    setFeaturedId(videoId)
    setPlaying(autoplay)
    scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const step = (dir) => {
    const next = videos[featuredIndex + dir]
    if (next) openClip(next.videoId, true)
  }

  return (
    <Container ref={scroller} data-wall-page="video">
      <StationPlate letter="V" title="Video" color={GREEN} />
      {status === 'loading' && <FrostNote>Loading playlist…</FrostNote>}
      {(status === 'empty' || status === 'error') && (
        <FrostNote>
          {status === 'error' ? 'Could not load videos.' : 'No videos to show.'}
          {statusDetail ? (
            <span style={{ display: 'block', marginTop: '0.75rem', opacity: 0.8, fontSize: '0.95rem' }}>
              {statusDetail}
            </span>
          ) : null}
        </FrostNote>
      )}
      {status === 'ready' && featured ? (
        <Shell>
          <Player>
            <ScreenBezel>
              <Frame>
                {playing ? (
                  <VideoIframe
                    key={featured.videoId}
                    src={`https://www.youtube.com/embed/${featured.videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                    title={featured.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <PlayButton
                    type="button"
                    onClick={() => setPlaying(true)}
                    aria-label={`Play ${featured.title}`}
                  >
                    <ThumbChrome videoId={featured.videoId} duration={featured.duration} size={56} />
                  </PlayButton>
                )}
              </Frame>
            </ScreenBezel>

            <Deck>
              <DeckInfo>
                <Status $live={playing}>
                  <Led $live={playing} aria-hidden="true" />
                  {playing ? 'Now playing' : 'Ready'}
                  <MetaDot aria-hidden>·</MetaDot>
                  <span style={{ letterSpacing: '0.06em', fontWeight: 700 }}>
                    {String(featuredIndex + 1).padStart(2, '0')}
                    {' / '}
                    {String(videos.length).padStart(2, '0')}
                  </span>
                </Status>
                <NowTitle>{featured.title}</NowTitle>
                {(featuredDate || featured.duration) ? (
                  <MetaRow>
                    {featuredDate ? <span>{featuredDate}</span> : null}
                    {featuredDate && featured.duration ? <MetaDot aria-hidden>·</MetaDot> : null}
                    {featured.duration ? <span>{featured.duration}</span> : null}
                  </MetaRow>
                ) : null}
              </DeckInfo>

              <Transport>
                <TwBtn
                  type="button"
                  aria-label="Previous"
                  disabled={!canPrev}
                  onClick={() => step(-1)}
                >
                  <IconPrev />
                </TwBtn>
                <PlayTw
                  type="button"
                  $live={playing}
                  aria-label={playing ? `Pause ${featured.title}` : `Play ${featured.title}`}
                  onClick={() => setPlaying((on) => !on)}
                >
                  {playing ? <IconPause /> : <IconPlay />}
                </PlayTw>
                <TwBtn
                  type="button"
                  aria-label="Next"
                  disabled={!canNext}
                  onClick={() => step(1)}
                >
                  <IconNext />
                </TwBtn>
              </Transport>
            </Deck>

            {videos.length > 1 ? (
              <>
                <QueueHead>
                  <QueueLabel>Queue</QueueLabel>
                  <QueueCount>{videos.length} tracks</QueueCount>
                </QueueHead>
                <List>
                  {videos.map((video, i) => {
                    const on = video.videoId === featured.videoId
                    const date = formatDate(video.publishedAt)
                    return (
                      <Clip
                        key={video.id || video.videoId}
                        type="button"
                        $on={on}
                        onClick={() => openClip(video.videoId)}
                        aria-label={`Play ${video.title}`}
                        aria-current={on ? 'true' : undefined}
                      >
                        <Index $on={on}>{String(i + 1).padStart(2, '0')}</Index>
                        <ClipFrame>
                          <ThumbChrome
                            videoId={video.videoId}
                            duration={video.duration}
                            lazy
                            size={28}
                            showPlay={!on}
                          />
                        </ClipFrame>
                        <ClipBody>
                          <ClipTitle $on={on}>{video.title}</ClipTitle>
                          <ClipMeta $on={on}>
                            {[on && playing ? 'Playing' : on ? 'Selected' : null, date, video.duration]
                              .filter(Boolean)
                              .join(' · ')}
                          </ClipMeta>
                        </ClipBody>
                      </Clip>
                    )
                  })}
                </List>
              </>
            ) : null}
          </Player>
        </Shell>
      ) : null}
    </Container>
  )
}
