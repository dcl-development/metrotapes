/* eslint-disable react/no-unknown-property */
import * as THREE from 'three'
import { TRACK_W, TRACK_X0, TRACK_Y, resolvePov } from './space'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'

/** Cheap NYC platform litter — scribbled notes, receipts, crumpled bags. */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function paintLitterNote(ctx, n, seed) {
  const rand = mulberry32(seed)
  ctx.fillStyle = `rgb(${168 + rand() * 40},${158 + rand() * 30},${138 + rand() * 25})`
  ctx.fillRect(0, 0, n, n)
  const sx = rand() * n
  const sy = rand() * n
  const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 18 + rand() * 20)
  g.addColorStop(0, 'rgba(90, 60, 30, 0.35)')
  g.addColorStop(1, 'rgba(90, 60, 30, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(sx, sy, 28, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = `rgba(${30 + rand() * 40},${30 + rand() * 30},${40 + rand() * 30},${0.45 + rand() * 0.35})`
  ctx.lineWidth = 1.2 + rand() * 1.4
  ctx.lineCap = 'round'
  for (let row = 0; row < 7; row += 1) {
    const y = 10 + row * (n / 8) + rand() * 4
    ctx.beginPath()
    ctx.moveTo(8 + rand() * 10, y)
    let x = 12
    while (x < n - 10) {
      x += 6 + rand() * 14
      ctx.lineTo(x, y + (rand() - 0.5) * 5)
    }
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(20, 16, 12, 0.25)'
  ctx.fillRect(0, n - 4, n, 4)
}

function paintLitterReceipt(ctx, n, seed) {
  const rand = mulberry32(seed)
  ctx.fillStyle = '#cfc6a8'
  ctx.fillRect(0, 0, n, n)
  ctx.fillStyle = 'rgba(40, 36, 28, 0.55)'
  for (let i = 0; i < 12; i += 1) {
    const y = 6 + i * (n / 13)
    const w = n * (0.35 + rand() * 0.5)
    ctx.fillRect(4, y, w, 1 + (i % 3 === 0 ? 1.5 : 0))
  }
  ctx.fillStyle = 'rgba(60, 50, 30, 0.2)'
  ctx.fillRect(0, 0, n, 3)
  ctx.fillRect(0, n - 3, n, 3)
}

function paintLitterBag(ctx, n, seed) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const x = i % n
    const y = (i / n) | 0
    const wrinkle = Math.sin(x * 0.35) * 18 + Math.sin(y * 0.5 + seed) * 14
    const v = Math.max(90, Math.min(200, 150 + wrinkle + ((i * 13) % 17)))
    data[j] = v
    data[j + 1] = v - 2
    data[j + 2] = v - 8
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  ctx.fillStyle = 'rgba(160, 20, 30, 0.7)'
  ctx.fillRect(n * 0.28, n * 0.38, n * 0.44, n * 0.16)
}

function makeLitterMap(paint, seed) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  paint(canvas.getContext('2d'), 64, seed)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 2
  tex.needsUpdate = true
  return tex
}

/** Discarded MetroCard resting in the litter (also the wind-intro landing spot). */
const TRASH_CARD = {
  pos: [-1.15, 0.018, -6.85],
  rot: [-Math.PI / 2 + 0.1, 0.15, 0.85],
  size: [0.28, 0.175],
}

/**
 * Intro: one continuous MetroCard flight onto the trash (no wait→fly snap).
 * Card outruns the camera so it stays in frame; intro ends only after both settle.
 * Flutter is cheap trig only (phone-safe), not a physics sim.
 */
export function WindCard({ ready, onCameraHome, reducedMotion, driveCamera = true }) {
  const group = useRef()
  const { camera } = useThree()
  const texture = useLoader(THREE.TextureLoader, '/metrocard.png')
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  const state = useRef({
    life: 0, // continuous clock — never resets (keeps flutter phase continuous)
    age: 0, // flight progress clock — only advances once ready
    camHome: false,
    cardLanded: false,
    finished: false,
  })

  const FLY_SCALE = 3.6
  const LAND_SCALE = 1
  /** Card flies faster than the camera pull so it stays in POV */
  const CAM_DUR = 3.35
  const CARD_DUR = 2.45

  // Near-vertical “swipe in air” pose at the open, then settles flat on litter
  const START_ROT = useMemo(() => new THREE.Euler(-0.55, 0.18, 0.12), [])

  const START = useMemo(() => new THREE.Vector3(0.15, 2.15, 1.35), [])
  const LAND = useMemo(() => new THREE.Vector3(...TRASH_CARD.pos), [])
  const LAND_ROT = useMemo(() => new THREE.Euler(...TRASH_CARD.rot), [])
  const CAM_START = useMemo(() => ({
    pos: new THREE.Vector3(0.2, 1.95, 3.6),
    look: new THREE.Vector3(0.15, 1.85, 1.0),
    fov: 42,
  }), [])
  const CAM_KIOSK = useMemo(() => {
    const shot = resolvePov('kiosk')
    return {
      pos: new THREE.Vector3(...shot.position),
      look: new THREE.Vector3(...shot.lookAt),
      fov: shot.fov,
    }
  }, [])
  const tmpPos = useMemo(() => new THREE.Vector3(), [])
  const tmpLook = useMemo(() => new THREE.Vector3(), [])
  const tmpEuler = useMemo(() => new THREE.Euler(), [])

  const finishIntro = (s) => {
    if (s.finished || !s.camHome || !s.cardLanded) return
    s.finished = true
    onCameraHome?.()
  }

  useLayoutEffect(() => {
    if (!driveCamera) return
    state.current = {
      life: 0,
      age: 0,
      camHome: false,
      cardLanded: false,
      finished: false,
    }
    camera.position.copy(CAM_START.pos)
    camera.fov = CAM_START.fov
    camera.lookAt(CAM_START.look)
    camera.updateProjectionMatrix()
  }, [camera, CAM_START, driveCamera])

  useFrame((_, dt) => {
    if (!group.current) return
    const d = Math.min(dt, 0.05)
    const s = state.current
    const g = group.current
    const easeOut = (t) => 1 - (1 - t) ** 3
    const easeIn = (t) => t * t
    const smooth = (t) => t * t * (3 - 2 * t)

    const setCam = (pos, look, fov) => {
      if (!driveCamera) return
      camera.position.copy(pos)
      camera.lookAt(look)
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    if (reducedMotion) {
      if (!ready || s.finished) {
        if (!s.cardLanded) {
          g.position.copy(LAND)
          g.rotation.copy(LAND_ROT)
          g.scale.setScalar(LAND_SCALE)
          s.cardLanded = true
        }
        return
      }
      g.position.copy(LAND)
      g.rotation.copy(LAND_ROT)
      g.scale.setScalar(LAND_SCALE)
      setCam(CAM_KIOSK.pos, CAM_KIOSK.look, CAM_KIOSK.fov)
      s.camHome = true
      s.cardLanded = true
      finishIntro(s)
      return
    }

    // One clock for flutter phase; keep advancing until BOTH card + camera have settled
    // (stopping age when the card landed left the camera short of home → intro never finished)
    s.life += d
    if (ready && !s.finished) s.age += d

    const u = Math.min(1, s.age / CARD_DUR)
    // Brief close-up, then a quicker dive so the card stays ahead of the camera
    const e = u < 0.28
      ? easeOut(u / 0.28) * 0.28
      : 0.28 + easeIn((u - 0.28) / 0.72) * 0.72
    const wind = (1 - e) ** 1.15
    const t = s.life

    // Falling-paper path: arc + side-to-side / up-down flutter that dies out near the floor
    const lift = Math.sin(Math.min(e, 0.9) * Math.PI) * 0.95 * (1 - Math.max(0, (e - 0.7) / 0.3) ** 2)
    tmpPos.lerpVectors(START, LAND, e)
    tmpPos.y += lift * (1 - e * 0.4)
    tmpPos.x += (Math.sin(t * 2.15) * 0.48 + Math.sin(t * 4.6) * 0.14) * wind
    tmpPos.y += Math.sin(t * 3.05) * 0.16 * wind
    tmpPos.z += (Math.cos(t * 1.75) * 0.32 + Math.sin(t * 3.8) * 0.1) * wind
    g.position.copy(tmpPos)

    // Keep a vertical swipe bias early; wobble all axes like a sheet in air; settle flat late
    tmpEuler.set(
      THREE.MathUtils.lerp(START_ROT.x, LAND_ROT.x, e)
        + Math.sin(t * 2.9) * wind * 0.85
        + Math.sin(t * 5.4) * wind * 0.22,
      THREE.MathUtils.lerp(START_ROT.y, LAND_ROT.y, e)
        + Math.sin(t * 1.55) * wind * 0.7
        + Math.cos(t * 3.2) * wind * 0.35,
      THREE.MathUtils.lerp(START_ROT.z, LAND_ROT.z, e)
        + Math.cos(t * 2.4) * wind * 1.05
        + Math.sin(t * 4.8) * wind * 0.28,
    )
    if (u > 0.62) {
      const k = smooth((u - 0.62) / 0.38)
      tmpEuler.x = THREE.MathUtils.lerp(tmpEuler.x, LAND_ROT.x, k)
      tmpEuler.y = THREE.MathUtils.lerp(tmpEuler.y, LAND_ROT.y, k)
      tmpEuler.z = THREE.MathUtils.lerp(tmpEuler.z, LAND_ROT.z, k)
    }
    g.rotation.copy(tmpEuler)
    g.scale.setScalar(THREE.MathUtils.lerp(FLY_SCALE, LAND_SCALE, e))

    if (u >= 1 && !s.cardLanded) {
      g.position.copy(LAND)
      g.rotation.copy(LAND_ROT)
      g.scale.setScalar(LAND_SCALE)
      s.cardLanded = true
      finishIntro(s)
    } else if (s.cardLanded) {
      // Stay planted — don't keep rewriting pose after land
      g.position.copy(LAND)
      g.rotation.copy(LAND_ROT)
      g.scale.setScalar(LAND_SCALE)
    }

    // Camera: slower pull so the faster card stays in frame
    if (driveCamera && !s.camHome) {
      if (!ready) {
        tmpLook.copy(g.position)
        setCam(CAM_START.pos, tmpLook, CAM_START.fov)
        return
      }
      const cu = Math.min(1, s.age / CAM_DUR)
      const ce = smooth(cu)
      camera.position.lerpVectors(CAM_START.pos, CAM_KIOSK.pos, ce)
      tmpLook.lerpVectors(CAM_START.look, CAM_KIOSK.look, ce)
      // Track the card longer so it doesn't slip out of POV mid-flight
      if (cu < 0.55) {
        tmpLook.lerp(g.position, (1 - cu / 0.55) * 0.65)
      }
      camera.lookAt(tmpLook)
      camera.fov = THREE.MathUtils.lerp(CAM_START.fov, CAM_KIOSK.fov, ce)
      camera.updateProjectionMatrix()
      if (cu >= 1) {
        setCam(CAM_KIOSK.pos, CAM_KIOSK.look, CAM_KIOSK.fov)
        s.camHome = true
        finishIntro(s)
      }
    }
  })

  return (
    <group ref={group} position={START.toArray()} scale={FLY_SCALE} rotation={START_ROT.toArray()}>
      <mesh>
        <planeGeometry args={TRASH_CARD.size} />
        {/* Opaque like FloorTrash — transparent + floor coplanar was eating the card on land */}
        <meshStandardMaterial
          map={texture}
          roughness={0.45}
          metalness={0.06}
          side={THREE.DoubleSide}
          emissive="#2a2418"
          emissiveIntensity={0.4}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh position={[0, 0, -0.004]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={TRASH_CARD.size} />
        <meshStandardMaterial color="#c49a28" roughness={0.65} metalness={0.12} />
      </mesh>
    </group>
  )
}

export function FloorTrash({ showMetroCard = true }) {
  const metroTex = useLoader(THREE.TextureLoader, '/metrocard.png')
  metroTex.colorSpace = THREE.SRGBColorSpace

  const atlas = useMemo(() => {
    const notes = [0, 1, 2, 3].map((i) => makeLitterMap(paintLitterNote, 900 + i * 17))
    const receipts = [0, 1].map((i) => makeLitterMap(paintLitterReceipt, 500 + i * 23))
    const bag = makeLitterMap(paintLitterBag, 777)
    return { notes, receipts, bag }
  }, [])

  useLayoutEffect(() => () => {
    atlas.notes.forEach((t) => t.dispose())
    atlas.receipts.forEach((t) => t.dispose())
    atlas.bag.dispose()
  }, [atlas])

  const bits = useMemo(() => {
    const rand = mulberry32(4804)
    const items = []
    const scatter = (n, kind) => {
      for (let i = 0; i < n; i += 1) {
        items.push({
          kind,
          x: -1.55 + rand() * 2.35,
          z: -7.6 + rand() * 3.4,
          rot: rand() * Math.PI * 2,
          tilt: (rand() - 0.5) * 0.22,
          crumple: (rand() - 0.5) * 0.45,
          sx: 0.07 + rand() * 0.12,
          sz: 0.06 + rand() * 0.1,
          variant: (rand() * 4) | 0,
          y: kind === 'bag' ? 0.028 + rand() * 0.02 : 0.008 + rand() * 0.006,
        })
      }
    }
    scatter(9, 'paper')
    scatter(5, 'receipt')
    scatter(4, 'green')
    scatter(3, 'photo')
    scatter(3, 'bag')
    scatter(1, 'mask')
    scatter(2, 'pink')
    return items
  }, [])

  return (
    <group>
      {showMetroCard ? (
        <>
          <mesh
            position={TRASH_CARD.pos}
            rotation={TRASH_CARD.rot}
            castShadow={false}
          >
            <planeGeometry args={TRASH_CARD.size} />
            <meshStandardMaterial
              map={metroTex}
              roughness={0.88}
              metalness={0.04}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh
            position={[TRASH_CARD.pos[0], TRASH_CARD.pos[1] - 0.003, TRASH_CARD.pos[2]]}
            rotation={TRASH_CARD.rot}
            castShadow={false}
          >
            <planeGeometry args={TRASH_CARD.size} />
            <meshStandardMaterial color="#c49a28" roughness={0.7} metalness={0.1} side={THREE.BackSide} />
          </mesh>
        </>
      ) : null}
      {bits.map((b, i) => {
        if (b.kind === 'bag') {
          return (
            <mesh
              key={i}
              position={[b.x, b.y, b.z]}
              rotation={[0.55 + b.tilt, b.rot, 0.4 + b.crumple]}
              scale={[b.sx * 4.5, 0.7, b.sz * 4.2]}
              castShadow={false}
            >
              <sphereGeometry args={[0.08, 6, 5]} />
              <meshStandardMaterial
                map={atlas.bag}
                color="#c8c4bc"
                roughness={0.98}
                metalness={0}
              />
            </mesh>
          )
        }
        if (b.kind === 'mask') {
          return (
            <mesh
              key={i}
              position={[b.x, b.y, b.z]}
              rotation={[-Math.PI / 2 + b.tilt, b.crumple * 0.3, b.rot]}
              castShadow={false}
            >
              <planeGeometry args={[0.18, 0.1]} />
              <meshStandardMaterial color="#b8b4ac" roughness={0.98} metalness={0} side={THREE.DoubleSide} />
            </mesh>
          )
        }
        if (b.kind === 'green') {
          return (
            <mesh
              key={i}
              position={[b.x, b.y, b.z]}
              rotation={[-Math.PI / 2 + b.tilt, b.crumple * 0.2, b.rot]}
              castShadow={false}
            >
              <planeGeometry args={[0.065, 0.065]} />
              <meshStandardMaterial color="#6e8810" roughness={0.95} metalness={0} side={THREE.DoubleSide} />
            </mesh>
          )
        }
        if (b.kind === 'pink') {
          return (
            <mesh
              key={i}
              position={[b.x, b.y, b.z]}
              rotation={[0.5, b.rot, 0.35]}
              scale={[1.2, 0.4, 0.9]}
              castShadow={false}
            >
              <sphereGeometry args={[0.07, 6, 5]} />
              <meshStandardMaterial color="#a84868" roughness={0.98} metalness={0} />
            </mesh>
          )
        }

        const map = b.kind === 'receipt'
          ? atlas.receipts[b.variant % atlas.receipts.length]
          : atlas.notes[b.variant % atlas.notes.length]
        const w = b.kind === 'receipt' ? 0.05 : b.kind === 'photo' ? 0.13 : b.sx * 1.55
        const d = b.kind === 'receipt' ? 0.15 : b.kind === 'photo' ? 0.1 : b.sz * 1.7
        return (
          <mesh
            key={i}
            position={[b.x, b.y, b.z]}
            rotation={[-Math.PI / 2 + b.tilt, b.crumple * 0.35, b.rot]}
            castShadow={false}
          >
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial
              map={map}
              color={b.kind === 'photo' ? '#9aa0a6' : '#d2c8b4'}
              roughness={0.96}
              metalness={0}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
      <group position={[-0.35, 0.035, -6.15]} rotation={[0.65, 0.9, 0.35]}>
        <mesh scale={[1.15, 0.42, 0.9]}>
          <sphereGeometry args={[0.11, 7, 5]} />
          <meshStandardMaterial map={atlas.bag} color="#bdbab4" roughness={0.97} metalness={0} />
        </mesh>
      </group>
    </group>
  )
}

/** Bottles, cans, junk in the track bed — kept low-poly. */
export function TrackTrash() {
  const bits = useMemo(() => {
    const rand = mulberry32(9173)
    const items = []
    // Visible stretch of trench from the kiosk
    for (let i = 0; i < 14; i += 1) {
      const kind = rand() < 0.55 ? 'bottle' : rand() < 0.75 ? 'can' : rand() < 0.9 ? 'bag' : 'paper'
      items.push({
        kind,
        x: TRACK_X0 + 0.35 + rand() * (TRACK_W - 0.7),
        z: -3.2 - rand() * 11.5,
        rotY: rand() * Math.PI * 2,
        rotX: kind === 'bottle' || kind === 'can' ? Math.PI / 2 + (rand() - 0.5) * 0.35 : 0.4 + rand() * 0.5,
        rotZ: (rand() - 0.5) * 0.5,
        color: kind === 'bottle'
          ? (['#2a5a32', '#5a3a1e', '#6a7a82', '#1a4a28'][Math.floor(rand() * 4)])
          : kind === 'can'
            ? (['#b0b4b8', '#c45a28', '#d8d0c0'][Math.floor(rand() * 3)])
            : kind === 'bag'
              ? (['#c8c4bc', '#2a2a2a', '#d4c8a8'][Math.floor(rand() * 3)])
              : '#b8b0a0',
        scale: 0.75 + rand() * 0.45,
      })
    }
    // Extra junk in the kiosk sightline (platform lip, mid-trench)
    for (let i = 0; i < 18; i += 1) {
      const kind = rand() < 0.4 ? 'bottle' : rand() < 0.7 ? 'can' : rand() < 0.88 ? 'bag' : 'paper'
      items.push({
        kind,
        x: TRACK_X0 + 0.12 + rand() * 1.15,
        z: -3.5 - rand() * 4.8,
        rotY: rand() * Math.PI * 2,
        rotX: kind === 'bottle' || kind === 'can' ? Math.PI / 2 + (rand() - 0.5) * 0.4 : 0.35 + rand() * 0.55,
        rotZ: (rand() - 0.5) * 0.55,
        color: kind === 'bottle'
          ? (['#2a5a32', '#5a3a1e', '#6a7a82', '#1a4a28'][Math.floor(rand() * 4)])
          : kind === 'can'
            ? (['#b0b4b8', '#c45a28', '#d8d0c0'][Math.floor(rand() * 3)])
            : kind === 'bag'
              ? (['#c8c4bc', '#2a2a2a', '#d4c8a8'][Math.floor(rand() * 3)])
              : '#b8b0a0',
        scale: 0.85 + rand() * 0.5,
      })
    }
    // A few upright bottles against the platform wall of the trench
    for (let i = 0; i < 4; i += 1) {
      items.push({
        kind: 'bottle',
        x: TRACK_X0 + 0.18 + rand() * 0.25,
        z: -4.5 - rand() * 8,
        rotY: rand() * Math.PI * 2,
        rotX: (rand() - 0.5) * 0.15,
        rotZ: (rand() - 0.5) * 0.12,
        color: ['#2a5a32', '#5a3a1e', '#8a9aa0'][Math.floor(rand() * 3)],
        scale: 0.9 + rand() * 0.25,
        upright: true,
      })
    }
    return items
  }, [])

  return (
    <group>
      {bits.map((b, i) => {
        const y = TRACK_Y + (b.upright ? 0.12 : 0.05)
        if (b.kind === 'bottle') {
          return (
            <group
              key={i}
              position={[b.x, y, b.z]}
              rotation={[b.rotX, b.rotY, b.rotZ]}
              scale={b.scale}
            >
              <mesh castShadow={false}>
                <cylinderGeometry args={[0.035, 0.04, 0.22, 8]} />
                <meshStandardMaterial
                  color={b.color}
                  roughness={0.35}
                  metalness={0.15}
                  transparent
                  opacity={0.88}
                />
              </mesh>
              <mesh position={[0, 0.1, 0]}>
                <cylinderGeometry args={[0.018, 0.03, 0.06, 6]} />
                <meshStandardMaterial color={b.color} roughness={0.4} metalness={0.1} transparent opacity={0.9} />
              </mesh>
              <mesh position={[0, 0.13, 0]}>
                <cylinderGeometry args={[0.022, 0.022, 0.02, 6]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.05} />
              </mesh>
            </group>
          )
        }
        if (b.kind === 'can') {
          return (
            <mesh
              key={i}
              position={[b.x, y, b.z]}
              rotation={[b.rotX, b.rotY, b.rotZ]}
              scale={b.scale}
              castShadow={false}
            >
              <cylinderGeometry args={[0.038, 0.038, 0.12, 8]} />
              <meshStandardMaterial color={b.color} roughness={0.45} metalness={0.55} />
            </mesh>
          )
        }
        if (b.kind === 'bag') {
          return (
            <mesh
              key={i}
              position={[b.x, TRACK_Y + 0.04, b.z]}
              rotation={[0.5, b.rotY, 0.35]}
              scale={[b.scale * 1.4, b.scale * 0.45, b.scale]}
              castShadow={false}
            >
              <sphereGeometry args={[0.09, 6, 5]} />
              <meshStandardMaterial color={b.color} roughness={0.95} metalness={0} />
            </mesh>
          )
        }
        return (
          <mesh
            key={i}
            position={[b.x, TRACK_Y + 0.02, b.z]}
            rotation={[-Math.PI / 2 + 0.1, 0, b.rotY]}
            castShadow={false}
          >
            <planeGeometry args={[0.1 * b.scale, 0.08 * b.scale]} />
            <meshStandardMaterial color={b.color} roughness={0.96} metalness={0} side={THREE.DoubleSide} />
          </mesh>
        )
      })}
    </group>
  )
}
