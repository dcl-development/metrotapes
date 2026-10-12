import { Link, useNavigate } from 'react-router-dom'
import styled, { keyframes } from 'styled-components'
import { useEffect, useState } from 'react'
import { font, route } from '../styles/theme'
import MetroMachineFace from './MetroMachineFace'
import { KIOSK_PANEL_W, KIOSK_PANEL_H, KIOSK_RADIUS_PX } from '../lib/kioskSize'
import { useKioskLeave } from '../context/useKioskLeave'
import { loadVideoCatalog, youtubeThumb } from '../lib/videoCatalog'

const Panel = styled.div`
  width: ${KIOSK_PANEL_W}px;
  height: ${KIOSK_PANEL_H}px;
  background: #0b1c3a;
  color: #fff;
  font-family: ${font};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: ${KIOSK_RADIUS_PX}px;
  pointer-events: ${(p) => (p.$live ? 'auto' : 'none')};
  box-sizing: border-box;
`

const Brand = styled.div`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  text-align: center;
  padding: 6px 0 4px;
  display: flex;
  justify-content: center;
  align-items: baseline;
  min-height: 20px;
  overflow: hidden;
  flex: 0 0 auto;

  @media (max-width: 767px) {
    font-size: 15px;
    min-height: 28px;
    padding: 8px 0 6px;
  }
`

const dropLetter = keyframes`
  0%, 14% {
    max-width: 1.1em;
    opacity: 0.55;
    transform: translateY(0) scale(1);
    letter-spacing: 0.18em;
  }
  28%, 62% {
    max-width: 0;
    opacity: 0;
    transform: translateY(6px) scale(0.4);
    letter-spacing: 0;
  }
  78%, 100% {
    max-width: 1.1em;
    opacity: 0.55;
    transform: translateY(0) scale(1);
    letter-spacing: 0.18em;
  }
`

const keepLetter = keyframes`
  0%, 14% {
    color: rgba(255, 255, 255, 0.55);
    letter-spacing: 0.18em;
    transform: scale(1);
  }
  32%, 62% {
    color: rgba(255, 255, 255, 0.92);
    letter-spacing: 0.08em;
    transform: scale(1.08);
  }
  78%, 100% {
    color: rgba(255, 255, 255, 0.55);
    letter-spacing: 0.18em;
    transform: scale(1);
  }
`

const Letter = styled.span`
  display: inline-block;
  overflow: hidden;
  white-space: nowrap;
  line-height: 1;
  animation: ${({ $keep }) => ($keep ? keepLetter : dropLetter)} 6.4s ease-in-out infinite;
  animation-delay: ${({ $keep, $i }) => ($keep ? '0s' : `${0.06 * $i}s`)};

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    max-width: 1.1em;
    opacity: 0.55;
    letter-spacing: 0.18em;
    transform: none;
  }
`

const WORD = 'METROTAPES'
const KEEP = new Set([0, 2, 6])

const ScreenHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 12px 2px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.85);
  font-variant-numeric: tabular-nums;
  flex: 0 0 auto;

  @media (max-width: 767px) {
    font-size: 15px;
    padding: 4px 12px;
  }
`

const Weather = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 700;
  min-height: 16px;
`

const WxIcon = styled.span`
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex-shrink: 0;

  svg {
    width: 16px;
    height: 16px;
    display: block;
  }
`

const SectionLabel = styled.div`
  padding: 4px 14px 3px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  flex: 0 0 auto;

  @media (max-width: 767px) {
    font-size: 14px;
    padding: 6px 14px 4px;
  }
`

const RecentList = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 5px;
  padding: 0 14px 4px;
  flex: 0 0 auto;
  min-height: 0;
`

const Clip = styled.button`
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: #000;
  border-radius: 3px;
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  color: inherit;
  position: relative;
  /* No transform hover inside CSS 3D kiosk overlay */
  transition: opacity 0.15s ease;

  &:hover { opacity: 0.92; }
  &:active { opacity: 0.85; }

  @media (max-width: 767px) {
    min-height: 88px;
  }
`

const Thumb = styled.img`
  display: block;
  width: 100%;
  /* Landscape thumbs — frees ~40px vs square for the machine face */
  aspect-ratio: 16 / 10;
  object-fit: cover;
`

const ghostPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.72; }
`

const ThumbGhost = styled.div`
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 3px;
  background: #061018;
  animation: ${ghostPulse} 1.35s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 0.5;
  }
`

const ClipMeta = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 5px 4px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
  font-size: 9px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (max-width: 767px) {
    font-size: 15px;
    padding: 16px 6px 6px;
  }
`

const ClipFrame = styled.iframe`
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  border: 0;
  background: #000;
`

const More = styled(Link)`
  display: flex;
  align-items: center;
  min-height: 48px;
  margin: 0 14px 4px;
  padding: 0 4px;
  flex: 0 0 auto;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
  text-decoration: none;
  cursor: pointer;
  /* No transform hover — CSS 3D overlay hit-testing flickers with child transforms */
  transition: color 0.15s ease;

  &:visited { color: rgba(255, 255, 255, 0.45); }
  &:hover { color: rgba(255, 255, 255, 0.75); }

  @media (max-width: 767px) {
    min-height: 72px;
    margin-bottom: 6px;
    font-size: 16px;
    letter-spacing: 0.04em;
  }
`

const Destinations = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 5px 10px 8px 16px;
  gap: 3px;
  background: #050505;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
`

const DestBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: 0;
  padding: 4px 10px 4px 12px;
  border: 0;
  border-radius: 0;
  min-height: 48px;
  flex: 1 1 0;
  cursor: pointer;
  text-align: left;
  color: #fff;
  overflow: hidden;
  background-color: #070708;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.14) 0.7px, transparent 1px);
  background-size: 4px 4px;
  background-position: 0 0;
  /* Background-only hover — transforms inside the CSS-3D overlay flicker hits */
  transition: background-color 0.15s ease;

  &:hover { background-color: #101012; }
  &:active { background-color: #161618; }

  @media (max-width: 767px) {
    min-height: 80px;
    gap: 12px;
    padding: 8px 10px 8px 12px;
  }
`

const DestBullet = styled.span`
  position: relative;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle, rgba(0, 0, 0, 0.28) 0.65px, transparent 0.9px),
    ${(p) => p.$color};
  background-size: 3.5px 3.5px, auto;
  box-shadow: 0 0 10px ${(p) => p.$color}99;

  @media (max-width: 767px) {
    flex-basis: 48px;
    width: 48px;
    height: 48px;
  }
`

const PITCH = 4
const LED_R = 1.25

const GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
}

function LedDots({ rows, color, pitch = PITCH, r = LED_R }) {
  const h = rows.length
  const w = rows[0]?.length || 0
  const dots = []
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (rows[y][x] !== '#' && rows[y][x] !== '1') continue
      dots.push(
        <circle
          key={`${x}-${y}`}
          cx={x * pitch + pitch / 2}
          cy={y * pitch + pitch / 2}
          r={r}
          fill={color}
        />,
      )
    }
  }
  return (
    <svg
      width={w * pitch}
      height={h * pitch}
      viewBox={`0 0 ${w * pitch} ${h * pitch}`}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible', filter: `drop-shadow(0 0 2px ${color})` }}
    >
      {dots}
    </svg>
  )
}

function useNarrowScreen() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () => setNarrow(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    window.addEventListener('resize', apply)
    return () => {
      mq.removeEventListener('change', apply)
      window.removeEventListener('resize', apply)
    }
  }, [])
  return narrow
}

function LedWord({ text, pitch = PITCH, r = LED_R }) {
  const letters = text.toUpperCase().split('')
  const cols = letters.reduce((n, ch, i) => {
    const g = GLYPHS[ch]
    return n + (g ? g[0].length : 0) + (i < letters.length - 1 ? 1 : 0)
  }, 0)
  const rows = Array.from({ length: 7 }, () => ''.padEnd(cols, '0'))
  let x = 0
  letters.forEach((ch, i) => {
    const g = GLYPHS[ch]
    if (g) {
      g.forEach((line, y) => {
        rows[y] = `${rows[y].slice(0, x)}${line}${rows[y].slice(x + line.length)}`
      })
      x += g[0].length
    }
    if (i < letters.length - 1) x += 1
  })
  return <LedDots rows={rows} color="#f4f6f8" pitch={pitch} r={r} />
}

const DESTINATIONS = [
  { color: route.photo, title: 'Photo', to: '/photo' },
  { color: route.video, title: 'Video', to: '/video' },
  { color: route.about, title: 'About', to: '/about' },
]

function WeatherGlyph({ code }) {
  if (code >= 71 && code <= 77) {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="5" r="2.2" fill="#e8eef4" />
        <path d="M3 8.2h10M4 11h8M5.5 13.5h5" stroke="#d7e4f0" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }
  if (code >= 95) {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 7.2a3.4 3.4 0 0 1 6.5-1.4A3 3 0 0 1 12.8 10H4.2A2.6 2.6 0 0 1 3.5 7.2Z" fill="#c5d0dc" />
        <path d="M8 9.2 6.4 12.4h2.1L7.2 15.2" fill="none" stroke="#fccc0a" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    )
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 6.8a3.4 3.4 0 0 1 6.5-1.4A3 3 0 0 1 12.8 9.6H4.2A2.6 2.6 0 0 1 3.5 6.8Z" fill="#c5d0dc" />
        <path d="M6 11.2v2.6M8.2 11.6v2.6M10.4 11.2v2.6" stroke="#7eb6e0" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  }
  if (code === 45 || code === 48) {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2.5 7.2h11M3.2 10h9.6" stroke="#c8d0d8" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (code === 2 || code === 3) {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="6" cy="5.2" r="2.4" fill="#fccc0a" />
        <path d="M4 9a3.2 3.2 0 0 1 6.1-1.2A2.8 2.8 0 0 1 13 11.2H4.8A2.4 2.4 0 0 1 4 9Z" fill="#d5dde6" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="3.1" fill="#fccc0a" />
      <path d="M8 1.6v1.8M8 12.6v1.8M1.6 8h1.8M12.6 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3" stroke="#fccc0a" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function useNycWeather() {
  const [wx, setWx] = useState(null)
  useEffect(() => {
    let alive = true
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=40.758&longitude=-73.9855&current=temperature_2m,weather_code&temperature_unit=fahrenheit&forecast_days=1'
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return
        const temp = data?.current?.temperature_2m
        const code = data?.current?.weather_code
        if (typeof temp !== 'number') return
        setWx({ temp: Math.round(temp), code: Number(code) || 0 })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  return wx
}

function useRecentVideos() {
  const [clips, setClips] = useState(null)
  useEffect(() => {
    let alive = true
    loadVideoCatalog().then((entry) => {
      if (!alive) return
      setClips((entry.data || []).slice(0, 3))
    })
    return () => { alive = false }
  }, [])
  return clips
}

export default function KioskScreen({ live = false }) {
  const navigate = useNavigate()
  const kioskLeave = useKioskLeave()
  const narrow = useNarrowScreen()
  const time = useClock()
  const weather = useNycWeather()
  const clips = useRecentVideos()
  const [playingId, setPlayingId] = useState(null)

  useEffect(() => {
    if (!live) setPlayingId(null)
  }, [live])

  const goTo = (to) => {
    if (!live) return
    // tryLeave plays the close. If it declines, navigate anyway so a
    // click cannot vanish into a lock that never clears.
    if (kioskLeave?.tryLeave?.(to)) return
    navigate(to)
  }

  return (
    <Panel $live={live}>
      <Brand aria-label="metrotapes">
        {WORD.split('').map((ch, i) => (
          <Letter key={`${ch}-${i}`} $keep={KEEP.has(i)} $i={i}>{ch}</Letter>
        ))}
      </Brand>
      <ScreenHead>
        <Weather>
          {weather ? (
            <>
              <WxIcon>
                <WeatherGlyph code={weather.code} />
              </WxIcon>
              {weather.temp}°F
            </>
          ) : null}
        </Weather>
        <span>{time}</span>
      </ScreenHead>
      <SectionLabel>Recent work</SectionLabel>
      <RecentList>
        {Array.from({ length: 3 }, (_, i) => {
          const video = clips?.[i]
          if (!video) {
            return <ThumbGhost key={`ghost-${i}`} aria-hidden />
          }
          const playing = playingId === video.videoId
          return (
            <Clip
              key={video.id || video.videoId}
              type="button"
              onClick={() => setPlayingId(playing ? null : video.videoId)}
              aria-label={playing ? `Pause ${video.title}` : `Play ${video.title}`}
            >
              {playing ? (
                <ClipFrame
                  src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`}
                  title={video.title}
                  allow="autoplay; encrypted-media; picture-in-picture"
                />
              ) : (
                <>
                  <Thumb
                    src={youtubeThumb(video.videoId)}
                    alt=""
                    width={480}
                    height={360}
                  />
                  <ClipMeta>{video.title}</ClipMeta>
                </>
              )}
            </Clip>
          )
        })}
      </RecentList>
      <More
        to="/video"
        data-kiosk-to="/video"
        onClick={(e) => {
          e.preventDefault()
          goTo('/video')
        }}
      >
        See all on video →
      </More>
      <MetroMachineFace />
      <Destinations>
        {DESTINATIONS.map((row) => (
          <DestBtn
            key={row.to}
            type="button"
            data-kiosk-to={row.to}
            onClick={() => goTo(row.to)}
            aria-label={row.title}
          >
            <DestBullet $color={row.color}>
              <LedDots
                rows={GLYPHS[row.title[0].toUpperCase()]}
                color="#fff"
                pitch={3.6}
                r={1.15}
              />
            </DestBullet>
            <LedWord text={row.title} pitch={narrow ? 6 : PITCH} r={narrow ? 2 : LED_R} />
          </DestBtn>
        ))}
      </Destinations>
    </Panel>
  )
}
