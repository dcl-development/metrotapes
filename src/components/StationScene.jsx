import * as THREE from 'three'
import KioskZapScreen from './KioskZapScreen'
import { Atmosphere } from '../station/lighting'
import { Benches, CeilingBeams, Pillars, Shell, Stairwell, YellowStrip } from '../station/shell'
import { COL, POVS, isLandscapeZoom, isWallPov, ndcXFromClient, ndcXFromEvent, resolvePov } from '../station/space'
import { CameraRig } from '../station/camera'
import { Canvas } from '@react-three/fiber'
import { ChromeBar, ChromeBtn, EdgeHit, GfxWatch, HomeIcon, IdlePump, KioskFrame, KioskGlass, KioskGlassDirt, Layer, LivePhotoIcon, Overlay, OverlayCam, OverlayObj, PanArrow, ReadyPing, SceneWrap, StageFit, StationFilm, ToneMap, WallFrame } from '../station/chrome'
import { FloorTrash, TrackTrash, WindCard } from '../station/litter'
import { InfoKiosk } from '../station/kiosk'
import { Signage, WallBoards } from '../station/walls'
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Tracks } from '../station/tracks'
import { Train } from '../station/train'
import { completeZapPhase, shouldOpenKiosk } from '../lib/kioskPhase'
import { frameloopFor, idlePumpMs } from '../lib/renderLoop'
import { getWallFace, layoutWallFace, setWallFace } from '../lib/wallSize'
import { hasWebGL } from '../lib/webglSupport'
import { pickKioskDestination } from '../lib/kioskHit'
import { preserveDrawingBuffer } from '../lib/stationFrame'
import { useGfx } from '../lib/useGfx'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStationMaps } from '../station/textures'
import { wallBoardList } from '../station/boards'
const StationBloom = lazy(() => import('./StationBloom'))

const LazyVibeRat = lazy(() => import('../station/rat'))
const LazyTrainSteam = lazy(() => import('../station/steam'))

function StationWorld({
  pov,
  kioskZoom = 'close',
  hud,
  wallHud,
  wall,
  onReady,
  onBoardSelect,
  dimmed,
  onArrive,
  introReady,
  onIntroDone,
  showBoot = true,
  immersed = false,
  immersedId = null,
  kioskPickable = false,
  onKioskPick,
  onLookAside,
  busyRef,
  blockClicksRef,
  watchArmed = true,
}) {
  const landscapeInvite = isLandscapeZoom(kioskZoom) && !dimmed
  const { settings, startSettings } = useGfx()
  const maps = useStationMaps(startSettings)
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  // Keep the same WindCard mesh after handoff so the floor card never "pops" in
  const [windMounted, setWindMounted] = useState(() => dimmed)
  useEffect(() => {
    if (dimmed) setWindMounted(true)
  }, [dimmed])

  return (
    <>
      <CameraRig pov={pov} kioskZoom={kioskZoom} onArrive={onArrive} locked={dimmed} busyRef={busyRef} />
      <Atmosphere />
      <group
        onClick={(e) => {
          e.stopPropagation()
          onLookAside?.(e)
        }}
      >
        <Shell maps={maps} />
        <CeilingBeams maps={maps} />
        <Stairwell maps={maps} />
        <Benches />
        <YellowStrip maps={maps} />
        <FloorTrash showMetroCard={!windMounted} />
        <Tracks maps={maps} />
        <TrackTrash />
        <group name="pillar-occlude">
          <Pillars />
        </group>
      </group>
      <Signage locked={dimmed} />
      <WallBoards
        wall={wall}
        wallHuds={wallHud}
        immersed={immersed}
        immersedId={immersedId}
        onSelect={onBoardSelect}
        invite={landscapeInvite}
        projectHtml
        busyRef={busyRef}
      />
      <Train invite={landscapeInvite} blockClicksRef={blockClicksRef} />
      {settings.extras ? (
        <Suspense fallback={null}>
          <LazyTrainSteam />
          <LazyVibeRat />
        </Suspense>
      ) : null}
      <group name="kiosk-occlude">
        <InfoKiosk
          hud={hud}
          showBoot={showBoot}
          pickable={kioskPickable}
          onPick={onKioskPick}
          projectHtml
        />
      </group>
      {windMounted ? (
        <WindCard
          ready={introReady}
          driveCamera={dimmed}
          onCameraHome={onIntroDone}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <ReadyPing onReady={onReady} hud={hud} wallHud={wallHud} />
      <GfxWatch busyRef={busyRef} armed={watchArmed} />
      <ToneMap />
    </>
  )
}

export default function StationScene({
  shot = 'kiosk',
  kioskLive = true,
  dimmed = false,
  introReady = false,
  onIntroComplete,
  onReady,
  onFlat,
  onArrive,
  leaveRef,
  bindSlot,
  wallInteractive = false,
  headerH = 64,
}) {
  const { settings } = useGfx()
  // Context flags are fixed at creation. A later tier drop cannot change them.
  const [glConfig] = useState(() => ({
    alpha: false,
    antialias: settings.antialias,
    powerPreference: settings.powerPreference,
    preserveDrawingBuffer: preserveDrawingBuffer(settings),
  }))
  const [use3d, setUse3d] = useState(() => hasWebGL())
  const [tabHidden, setTabHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden,
  )
  const [wall, setWall] = useState(() => {
    if (typeof window === 'undefined') return setWallFace(layoutWallFace(1100, 700))
    return setWallFace(layoutWallFace(window.innerWidth, Math.max(1, window.innerHeight - headerH)))
  })
  const hud = useRef({ root: null, cam: null, obj: null })
  const wallHud = useRef({
    root: null,
    cam: null,
    obj: { photo: null, video: null, about: null },
  })
  // A fresh inline ref would detach and reattach every render, and bindSlot
  // sets state, which is an update loop on wall routes.
  const slotBinders = useRef({})
  const binderFor = (id) => {
    if (!slotBinders.current[id]) {
      slotBinders.current[id] = (node) => bindSlot?.(id, node)
    }
    return slotBinders.current[id]
  }
  const navigate = useNavigate()
  const location = useLocation()
  const pov = isWallPov(shot) || shot === 'kiosk' ? shot : (POVS[shot] ? shot : 'kiosk')
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const [zap, setZap] = useState('closed')
  const [kioskArrived, setKioskArrived] = useState(false)
  const [immersed, setImmersed] = useState(false)
  const [kioskZoom, setKioskZoom] = useState('close')
  const [camSettled, setCamSettled] = useState(true)
  const [flying, setFlying] = useState(true)
  const [interacting, setInteracting] = useState(false)
  const [navEpoch, setNavEpoch] = useState(0)
  const pendingNav = useRef(null)
  const suppressOpen = useRef(false)
  const zapRef = useRef(zap)
  const pickAt = useRef(0)
  const cameraBusyRef = useRef(false)
  const blockClicksRef = useRef(false)
  const immerseTimer = useRef(null)
  const interactTimer = useRef(null)
  const onFlatRef = useRef(onFlat)
  const onReadyRef = useRef(onReady)
  onFlatRef.current = onFlat
  onReadyRef.current = onReady
  zapRef.current = zap
  const landscape = pov === 'kiosk' && isLandscapeZoom(kioskZoom)
  // Menu accepts clicks only after the close-up camera has settled.
  // Otherwise the click that zooms in also hits a destination button.
  const screenLive = kioskLive && zap === 'open' && kioskZoom === 'close' && camSettled
  // Synchronous: the follow-up click from a kiosk pick happens before re-render.
  blockClicksRef.current = pov === 'kiosk' && kioskZoom === 'close'
  const pageView = immersed && isWallPov(pov)

  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    if (!use3d) {
      onReadyRef.current?.()
      onFlatRef.current?.()
    }
  }, [use3d])

  // camSettled flips true the moment a wall route is chosen, while the
  // camera is still in the air. `flying` stays up until CameraRig lands.
  useLayoutEffect(() => {
    setFlying(true)
  }, [pov, kioskZoom])

  useEffect(() => {
    const start = () => setFlying(true)
    window.addEventListener('resize', start)
    window.addEventListener('orientationchange', start)
    const vv = window.visualViewport
    vv?.addEventListener('resize', start)
    return () => {
      window.removeEventListener('resize', start)
      window.removeEventListener('orientationchange', start)
      vv?.removeEventListener('resize', start)
    }
  }, [])

  useEffect(() => {
    const apply = () => {
      const next = layoutWallFace(
        window.innerWidth,
        Math.max(1, window.innerHeight - headerH),
      )
      const prev = getWallFace()
      if (
        prev.panelW === next.panelW
        && prev.panelH === next.panelH
        && prev.boardY === next.boardY
        && prev.contentW === next.contentW
        && prev.contentH === next.contentH
      ) return
      setWallFace(next)
      setWall(next)
    }
    apply()
    const vv = window.visualViewport
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    return () => {
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
    }
  }, [headerH])

  const goBoard = useCallback((id) => {
    const to = `/${id}`
    if (pov === id) return
    if (leaveRef?.current?.tryLeave?.(to)) return
    navigate(to)
  }, [navigate, leaveRef, pov])

  const layerRef = useRef(null)

  const lookAside = useCallback((e, forcedDir = null) => {
    if (dimmed) return
    // The kiosk pick and the browser's follow-up click are the same gesture.
    if (performance.now() - pickAt.current < 400) return
    // Already looking left/right — chrome pans; don't nest another edge click
    if (pov === 'kiosk' && isLandscapeZoom(kioskZoom)) return

    let dir = forcedDir
    if (!dir) {
      const x = typeof e?.clientX === 'number'
        ? ndcXFromClient(e.clientX, layerRef.current)
        : ndcXFromEvent(e)
      if (x == null) return
      if (x < -0.28) dir = 'left'
      else if (x > 0.28) dir = 'right'
      else return
    }

    setCamSettled(false)
    setKioskZoom(dir)
    if (pov !== 'kiosk') navigate('/')
  }, [dimmed, pov, kioskZoom, navigate])

  const handleArrive = useCallback((next) => {
    onArrive?.(next)
    setFlying(false)
    setCamSettled(true)
    setKioskArrived(next === 'kiosk')
    if (immerseTimer.current) {
      window.clearTimeout(immerseTimer.current)
      immerseTimer.current = null
    }
    if (isWallPov(next)) {
      immerseTimer.current = window.setTimeout(() => {
        setImmersed(true)
        immerseTimer.current = null
      }, reducedMotion ? 0 : 40)
      return
    }
    setImmersed(false)
  }, [onArrive, reducedMotion])

  const handleIntroDone = useCallback(() => {
    // WindCard already parked the camera at kiosk — don't wait on CameraRig arrive
    setKioskArrived(true)
    onIntroComplete?.()
  }, [onIntroComplete])

  const prevPov = useRef(pov)
  useEffect(() => {
    if (pov !== 'kiosk') {
      suppressOpen.current = false
      setKioskArrived(false)
      setZap('closed')
      pendingNav.current = null
      setKioskZoom('close')
      setCamSettled(true)
    } else if (isWallPov(prevPov.current)) {
      // Coming back from a poster: don't take menu clicks until the shot lands.
      setCamSettled(false)
    }
    prevPov.current = pov
    setImmersed(false)
    if (immerseTimer.current) {
      window.clearTimeout(immerseTimer.current)
      immerseTimer.current = null
    }
  }, [pov])

  // Screens on for intro fly-in (preloaded). Zap open while dimmed so the LCD
  // isn't a black MTA plate during the approach; post-intro keeps it open.
  useEffect(() => {
    const next = shouldOpenKiosk({
      pov,
      zoom: kioskZoom,
      zap,
      live: kioskLive,
      arrived: kioskArrived,
      dimmed,
      reduced: reducedMotion,
      suppress: suppressOpen.current,
    })
    if (next) setZap(next)
  }, [pov, kioskLive, kioskArrived, zap, reducedMotion, kioskZoom, dimmed, navEpoch])

  const onZapPhaseEnd = useCallback((phase) => {
    // A late animationend/timeout must not close a screen that already moved on.
    if (zapRef.current !== phase) return
    const result = completeZapPhase({ phase, pending: pendingNav.current })
    if (result.ignore || !result.zap) return
    if (result.clearPending) pendingNav.current = null
    if (result.suppress) suppressOpen.current = true
    zapRef.current = result.zap
    setZap(result.zap)
    if (result.navigateTo) navigate(result.navigateTo)
  }, [navigate])

  // Closing asked for a route and we are still on home: the navigation did
  // not commit. Drop the hold and let the open effect bring the menu back
  // instead of leaving the MTA plate up.
  useEffect(() => {
    if (!suppressOpen.current || location.pathname !== '/') return undefined
    const t = window.setTimeout(() => {
      suppressOpen.current = false
      setNavEpoch((n) => n + 1)
    }, 900)
    return () => window.clearTimeout(t)
  }, [location.pathname, zap])

  // prefers-reduced-motion: no animationend — snap phases
  useEffect(() => {
    if (!reducedMotion) return
    if (zap === 'opening') onZapPhaseEnd('opening')
    if (zap === 'closing') onZapPhaseEnd('closing')
  }, [zap, reducedMotion, onZapPhaseEnd])

  const wakeKiosk = useCallback(() => {
    pickAt.current = performance.now()
    blockClicksRef.current = true
    pendingNav.current = null
    suppressOpen.current = false
    setCamSettled(false)
    setKioskZoom('close')
    if (zapRef.current !== 'open' && zapRef.current !== 'opening') {
      zapRef.current = reducedMotion ? 'open' : 'opening'
    }
    setZap((current) => {
      if (current === 'open' || current === 'opening') return current
      return reducedMotion ? 'open' : 'opening'
    })
  }, [reducedMotion])

  useEffect(() => {
    if (!leaveRef) return undefined
    const leave = leaveRef.current
    leave.tryLeave = (to) => {
      if (pov !== 'kiosk' || kioskZoom !== 'close') return false
      if (zap === 'closing') {
        pendingNav.current = to
        return true
      }
      if (zap !== 'open' || !camSettled) return false
      pendingNav.current = to
      suppressOpen.current = false
      setZap('closing')
      return true
    }
    leave.goHome = () => {
      pendingNav.current = null
      suppressOpen.current = false
      setCamSettled(false)
      setKioskZoom('close')
      setImmersed(false)
      if (zap === 'closing') {
        zapRef.current = 'closed'
        setZap('closed')
      }
      if (pov !== 'kiosk') navigate('/')
    }
    return () => {
      leave.tryLeave = () => false
      leave.goHome = null
    }
  }, [leaveRef, pov, zap, kioskZoom, camSettled, navigate])

  const moving = dimmed || flying || zap === 'opening' || zap === 'closing'
  const loop = frameloopFor({
    hidden: tabHidden,
    pageView,
    moving,
    interacting,
  })
  const pump = idlePumpMs({
    hidden: tabHidden,
    pageView,
    moving,
    interacting,
    reducedMotion,
    idleMotion: settings.idleMotion !== false,
    extras: Boolean(settings.extras),
  })

  const poke = useCallback((down) => {
    if (interactTimer.current) window.clearTimeout(interactTimer.current)
    if (down) {
      setInteracting(true)
      return
    }
    interactTimer.current = window.setTimeout(() => setInteracting(false), 1200)
  }, [])

  useEffect(() => () => {
    if (interactTimer.current) window.clearTimeout(interactTimer.current)
  }, [])

  useEffect(() => {
    if (!screenLive) return undefined
    const onUp = (event) => {
      if (event.button != null && event.button !== 0) return
      const root = hud.current.root
      if (!root) return
      const boxes = []
      root.querySelectorAll('[data-kiosk-to]').forEach((node) => {
        const rect = node.getBoundingClientRect()
        if (rect.width < 2 || rect.height < 2) return
        boxes.push({
          to: node.getAttribute('data-kiosk-to'),
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        })
      })
      const to = pickKioskDestination(event.clientX, event.clientY, boxes)
      if (!to) return
      event.preventDefault()
      event.stopPropagation()
      if (leaveRef?.current?.tryLeave?.(to)) return
      navigate(to)
    }
    window.addEventListener('pointerup', onUp, true)
    return () => window.removeEventListener('pointerup', onUp, true)
  }, [screenLive, leaveRef, navigate])

  useLayoutEffect(() => {
    if (!pageView) return undefined
    const fit = () => {
      const root = wallHud.current.root
      const cam = wallHud.current.cam
      if (!root) return
      root.style.width = '100%'
      root.style.height = 'auto'
      root.style.right = '0px'
      root.style.bottom = '72px'
      root.style.left = '0px'
      root.style.top = '0px'
      if (cam) {
        cam.style.width = '100%'
        cam.style.height = '100%'
        cam.style.transform = 'none'
      }
    }
    fit()
    window.addEventListener('resize', fit)
    window.addEventListener('orientationchange', fit)
    const vv = window.visualViewport
    vv?.addEventListener('resize', fit)
    return () => {
      window.removeEventListener('resize', fit)
      window.removeEventListener('orientationchange', fit)
      vv?.removeEventListener('resize', fit)
    }
  }, [pageView])

  if (!use3d) return null

  return (
    <Layer
      ref={layerRef}
      $hit={!dimmed}
      $page={pageView}
      onPointerDown={() => poke(true)}
      onPointerUp={() => poke(false)}
      onPointerCancel={() => poke(false)}
    >
      <SceneWrap $dim={dimmed}>
      <Suspense fallback={null}>
        <Canvas
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            isolation: 'isolate',
          }}
          resize={{ scroll: false }}
          frameloop={loop}
            dpr={settings.dpr}
            gl={glConfig}
            camera={{
              position: dimmed ? [0.2, 1.95, 3.6] : resolvePov(pov, undefined, kioskZoom).position,
              fov: dimmed ? 42 : resolvePov(pov, undefined, kioskZoom).fov,
              near: 0.1,
              far: 90,
            }}
          onCreated={({ gl, camera }) => {
            gl.setClearColor(COL.clear, 1)
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = settings.exposure
              if (dimmed) camera.lookAt(0.15, 1.85, 1.0)
              else camera.lookAt(...resolvePov(pov, undefined, kioskZoom).lookAt)
            gl.domElement.addEventListener('webglcontextlost', (event) => {
              event.preventDefault()
              setUse3d(false)
              onFlatRef.current?.()
            })
          }}
          onPointerMissed={lookAside}
        >
            <StageFit />
            <IdlePump ms={pump} />
            <StationWorld
              pov={pov}
              kioskZoom={kioskZoom}
              hud={hud}
              wallHud={wallHud}
              wall={wall}
              onReady={onReady}
              onBoardSelect={goBoard}
              dimmed={dimmed}
              onArrive={handleArrive}
              introReady={introReady}
              onIntroDone={handleIntroDone}
              showBoot={zap === 'closed' || zap === 'closing'}
              immersed={pageView}
              immersedId={pov}
              kioskPickable={landscape && !dimmed}
              onKioskPick={wakeKiosk}
              onLookAside={lookAside}
              busyRef={cameraBusyRef}
              blockClicksRef={blockClicksRef}
              watchArmed={loop === 'always'}
            />
            {settings.bloom ? (
              <Suspense fallback={null}>
                <StationBloom />
              </Suspense>
            ) : null}
        </Canvas>
      </Suspense>
        <Overlay ref={(n) => { hud.current.root = n }}>
            <OverlayCam ref={(n) => { hud.current.cam = n }}>
              <OverlayObj ref={(n) => { hud.current.obj = n }} $live={screenLive}>
                <KioskFrame $soft={settings.softScreens}>
                  <KioskZapScreen
                    phase={zap}
                    live={screenLive}
                    reducedMotion={reducedMotion}
                    onPhaseEnd={onZapPhaseEnd}
                  />
                  <KioskGlass aria-hidden />
                  <KioskGlassDirt aria-hidden />
                </KioskFrame>
              </OverlayObj>
            </OverlayCam>
          </Overlay>
        {isWallPov(pov) ? (
          <Overlay data-wall-hud="root" ref={(n) => { wallHud.current.root = n }} $page={pageView}>
            <OverlayCam data-wall-hud="cam" ref={(n) => { wallHud.current.cam = n }} $page={pageView}>
              {wallBoardList().map((b) => (
                <OverlayObj
                  key={b.id}
                  data-wall-hud={`obj-${b.id}`}
                  ref={(n) => { wallHud.current.obj[b.id] = n }}
                  $live={wallInteractive && pov === b.id}
                  $catch={!landscape && !pageView && !(wallInteractive && pov === b.id)}
                  $fill={pageView && pov === b.id}
                  $off={pageView && pov !== b.id}
                  onClick={(e) => {
                    if (pageView || (wallInteractive && pov === b.id)) return
                    e.stopPropagation()
                    goBoard(b.id)
                  }}
                >
                  <WallFrame
                    $fill={pageView && pov === b.id}
                    $w={wall.panelW}
                    $h={wall.panelH}
                    $soft={settings.softScreens}
                  >
                    {pov === b.id ? (
                      <div
                        ref={binderFor(b.id)}
                        style={{ position: 'absolute', inset: 0 }}
                      />
                    ) : null}
                    {pageView && pov === b.id ? null : (
                      <>
                        <KioskGlass aria-hidden />
                        <KioskGlassDirt aria-hidden />
                      </>
                    )}
                  </WallFrame>
                </OverlayObj>
              ))}
            </OverlayCam>
          </Overlay>
        ) : null}
      </SceneWrap>
      {pageView || !settings.grain ? null : (
        <StationFilm
          $grain={settings.grainOpacity ?? 0.12}
          $ca={Boolean(settings.ca)}
          aria-hidden
        />
      )}
      {!dimmed && !pageView && !(pov === 'kiosk' && isLandscapeZoom(kioskZoom)) ? (
        <>
          <EdgeHit
            type="button"
            $side="left"
            aria-label="Look left"
            onClick={(e) => lookAside(e, 'left')}
          />
          <EdgeHit
            type="button"
            $side="right"
            aria-label="Look right"
            onClick={(e) => lookAside(e, 'right')}
          />
        </>
      ) : null}
      {!dimmed && (isWallPov(pov) || (kioskLive && pov === 'kiosk' && (landscape || (kioskZoom === 'close' && kioskArrived && zap === 'open')))) ? (
        <ChromeBar $dock={pageView}>
          {landscape ? (
            <ChromeBtn
              type="button"
              aria-label="Home"
              onClick={() => {
                setCamSettled(false)
                setKioskZoom('close')
                if (pov !== 'kiosk') navigate('/')
              }}
            >
              <HomeIcon />
            </ChromeBtn>
          ) : null}
          <ChromeBtn
            type="button"
            aria-label={isWallPov(pov) || kioskZoom === 'close' ? 'Zoom out' : (kioskZoom === 'right' ? 'Look left' : 'Look right')}
            onClick={() => {
              if (isWallPov(pov)) {
                setCamSettled(false)
                setKioskZoom('left')
                navigate('/')
                return
              }
              if (kioskZoom === 'close') {
                setCamSettled(false)
                setKioskZoom('right')
                return
              }
              setCamSettled(false)
              setKioskZoom((z) => (z === 'right' ? 'left' : 'right'))
            }}
          >
            {isWallPov(pov) || kioskZoom === 'close' ? (
              <LivePhotoIcon />
            ) : (
              <PanArrow dir={kioskZoom === 'right' ? 'left' : 'right'} />
            )}
          </ChromeBtn>
        </ChromeBar>
      ) : null}
    </Layer>
  )
}
