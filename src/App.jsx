import { createGlobalStyle } from 'styled-components'
import PhotoPage from './pages/PhotoPage'
import VideoPage from './pages/VideoPage'
import AboutPage from './pages/AboutPage'
import Header from './components/Header'
import BootScreen from './components/BootScreen'
import { preloadStationAssets } from './lib/preloadStation'
import { BOOT_LIMIT_MS } from './lib/bootGate'
import FlatHome from './components/FlatHome'
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Blog from './pages/Blog'
import { font, station } from './styles/theme'
import usePageMeta from './hooks/usePageMeta'
import { KioskLeaveProvider } from './context/KioskLeaveContext'
import { GfxProvider } from './lib/gfxTier'
import { PresentationProvider } from './components/PresentationProvider'
import PageHost from './components/PageHost'
import { usePresentation } from './lib/usePresentation'
import { WallSlotContext } from './lib/wallSlotContext'

const StationScene = lazy(() => import('./components/StationScene'))

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body, #root {
    height: 100%;
    min-height: 100dvh;
  }

  html {
    min-height: 100%;
  }

  body {
    background: ${station};
    color: white;
    font-family: ${font};
    font-weight: 500;
    min-height: 100dvh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    letter-spacing: -0.02em;
  }

  #root {
    display: flex;
    flex-direction: column;
    background: ${station};
    min-height: 100dvh;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${font};
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  p, span, a, button, input, textarea {
    font-family: ${font};
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  a, button {
    cursor: pointer;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`

const SkipLink = styled.a`
  position: absolute;
  left: 0.75rem;
  top: 0.75rem;
  z-index: 200;
  padding: 0.45rem 0.7rem;
  background: #fff;
  color: ${station};
  font-family: ${font};
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  text-decoration: none;
  transform: translateY(-180%);

  &:focus {
    transform: none;
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
`

const Layout = styled.div`
  padding-top: ${(p) => (p.$pad ? `${p.$header}px` : '0')};
  position: relative;
  overflow-x: hidden;
  overflow-y: visible;
  min-height: 100%;
`

const HeaderArea = styled.header`
  min-height: 64px;
  height: auto;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: ${station};
`

const StationStage = styled.div`
  position: fixed;
  top: ${(p) => p.$header}px;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: ${(p) => (p.$front ? 5 : 0)};
  pointer-events: ${(p) => (p.$hit ? 'auto' : 'none')};
  transition: z-index 0s;
`

const ContentArea = styled.main`
  width: 100%;
  min-height: calc(100% - ${(p) => p.$header}px);
  position: relative;
  z-index: 1;
  pointer-events: ${(p) => (p.$pass ? 'none' : 'auto')};

  &:focus {
    outline: none;
  }
`

const SHOT = {
  '/': 'kiosk',
  '/photo': 'photo',
  '/video': 'video',
  '/about': 'about',
}

function AppContent() {
  const location = useLocation()
  const { station, setContextLost } = usePresentation()
  const shotFromRoute = SHOT[location.pathname]
  const atKiosk = location.pathname === '/'
  const onBlog = location.pathname === '/blog'
  const skipIntro = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  // Intro is a first-load ceremony on `/` only. Wall pages (and reduced motion)
  // start already inside the station so going home is a camera move, not a replay.
  const [entered, setEntered] = useState(() => {
    if (typeof window === 'undefined') return false
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
    return window.location.pathname !== '/'
  })
  const [assetsReady, setAssetsReady] = useState(!station)
  const [sceneReady, setSceneReady] = useState(!station)
  const [pageReady, setPageReady] = useState(false)
  const [bootLeaving, setBootLeaving] = useState(false)
  const [bootGone, setBootGone] = useState(skipIntro || !station)
  const booted = assetsReady && sceneReady
  const arriving = atKiosk && !entered
  const showBoot = arriving && !bootGone
  const shot = arriving ? 'kiosk' : (shotFromRoute || 'kiosk')
  const onPage = Boolean(shotFromRoute && shotFromRoute !== 'kiosk')
  const showPage = onPage && pageReady
  const leaveRef = useRef({ tryLeave: () => false, goHome: null })
  const kioskLeave = useMemo(() => ({
    tryLeave: (to) => leaveRef.current.tryLeave(to),
    goHome: () => {
      if (typeof leaveRef.current.goHome === 'function') {
        leaveRef.current.goHome()
        return true
      }
      return false
    },
  }), [])
  const slotsRef = useRef({ photo: null, video: null, about: null })
  const [slotEpoch, setSlotEpoch] = useState(0)
  const bindSlot = useCallback((id, node) => {
    if (slotsRef.current[id] === node) return
    slotsRef.current[id] = node
    setSlotEpoch((n) => n + 1)
  }, [])
  const wallSlots = useMemo(() => ({
    slotsRef,
    epoch: slotEpoch,
    bindSlot,
  }), [slotEpoch, bindSlot])
  const headerRef = useRef(null)
  const [headerH, setHeaderH] = useState(64)
  usePageMeta()

  useEffect(() => {
    const el = headerRef.current
    if (!el) return undefined
    const apply = () => {
      const h = Math.round(el.getBoundingClientRect().height)
      if (h > 0) setHeaderH(h)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    const vv = window.visualViewport
    window.addEventListener('resize', apply)
    vv?.addEventListener('resize', apply)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
      vv?.removeEventListener('resize', apply)
    }
  }, [])

  useEffect(() => {
    // New route → wait for camera to finish turning to the wall
    setPageReady(!onPage)
  }, [location.pathname, onPage])

  const enteredRef = useRef(entered)
  enteredRef.current = entered

  useEffect(() => {
    if (!station) {
      setAssetsReady(true)
      setSceneReady(true)
      setBootGone(true)
      setBootLeaving(false)
      return undefined
    }
    // First full-mode visit on home still plays the loader. Switching back
    // from lite on a deep link should not replay it.
    if (!enteredRef.current && window.location.pathname === '/') {
      setAssetsReady(false)
      setSceneReady(false)
      setBootGone(false)
      setBootLeaving(false)
    }
    let alive = true
    preloadStationAssets().then(() => {
      if (alive) setAssetsReady(true)
    })
    // ReadyPing lives inside the canvas. No WebGL, a lost context, or a
    // stalled texture must not leave the boot screen up.
    const timer = window.setTimeout(() => {
      if (!alive) return
      setAssetsReady(true)
      setSceneReady(true)
    }, BOOT_LIMIT_MS)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [station])

  // First visit: hold loading until scene + assets ready, then fade into the intro.
  // Replays skip the gate once the station is already warm.
  useEffect(() => {
    if (!arriving) {
      setBootGone(true)
      setBootLeaving(false)
      return undefined
    }
    if (booted) {
      if (bootGone) return undefined
      setBootLeaving(true)
      const t = window.setTimeout(() => setBootGone(true), 560)
      return () => window.clearTimeout(t)
    }
    setBootGone(false)
    setBootLeaving(false)
    return undefined
  }, [arriving, booted, bootGone])

  const handleArrive = (pov) => {
    if (pov === 'photo' || pov === 'video' || pov === 'about') {
      setPageReady(true)
    }
  }

  return (
    <WallSlotContext.Provider value={wallSlots}>
    <KioskLeaveProvider value={kioskLeave}>
    <Layout $pad $header={headerH}>
      <SkipLink href="#content">Skip to content</SkipLink>
      <HeaderArea ref={headerRef}>
        <Header />
      </HeaderArea>
      {(station && !onBlog && (shotFromRoute || arriving || entered)) ? (
        <StationStage $header={headerH} $front={arriving} $hit={!arriving && (entered || !!shotFromRoute)}>
          <Suspense fallback={null}>
            <StationScene
              shot={shot}
              kioskLive={atKiosk && entered}
              dimmed={arriving}
              introReady={booted && bootGone}
              onIntroComplete={() => setEntered(true)}
              onReady={() => setSceneReady(true)}
              onFlat={() => {
                setContextLost(true)
                setAssetsReady(true)
                setSceneReady(true)
              }}
              onArrive={handleArrive}
              leaveRef={leaveRef}
              bindSlot={bindSlot}
              wallInteractive={showPage}
              headerH={headerH}
            />
          </Suspense>
        </StationStage>
      ) : null}
      {showBoot ? (
        <BootScreen leaving={bootLeaving} />
      ) : null}
      <ContentArea id="content" tabIndex={-1} $header={headerH} $pass={station && (atKiosk || onPage)}>
        <Routes>
          <Route path="/" element={<PageHost><FlatHome /></PageHost>} />
          <Route path="/photo" element={<PageHost><PhotoPage /></PageHost>} />
          <Route path="/video" element={<PageHost><VideoPage /></PageHost>} />
          <Route path="/about" element={<PageHost><AboutPage /></PageHost>} />
          <Route path="/blog" element={<PageHost><Blog /></PageHost>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ContentArea>
    </Layout>
    </KioskLeaveProvider>
    </WallSlotContext.Provider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <GlobalStyle />
      <GfxProvider>
        <PresentationProvider>
          <AppContent />
        </PresentationProvider>
      </GfxProvider>
    </BrowserRouter>
  )
}

export default App
