/* eslint-disable react/no-unknown-property */
import * as THREE from 'three'
import { TRACK_W, TRACK_X0, TRACK_Y, resolvePov } from './space'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGfx } from '../lib/useGfx'

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
 * `/metrocard.png` is 800×506 with a transparent chamfer in the top-right.
 * Cut the mesh to that outline so the hole is empty air, not a dark rectangle.
 */
const CARD_NOTCH = { u: 718 / 800, v: 82 / 506 }
/** A couple of millimeters of stock, scaled off the card's 85.6mm long edge. */
const CARD_THICK = TRASH_CARD.size[0] * (2 / 85.6)

/** First point of the flight. Camera sits on the −X side, looking toward the tracks. */
const FLIGHT_START = [1.85, 1.72, -1.55]
const CAM_FOLLOW = [-1.35, 0.28, 0.2]

/**
 * Close-up on the open track side (+X). The wall boards and kiosk screen
 * sit the other way, so the spinning card has empty space behind it.
 */
export const INTRO_CAM = {
  pos: [
    FLIGHT_START[0] + CAM_FOLLOW[0],
    FLIGHT_START[1] + CAM_FOLLOW[1],
    FLIGHT_START[2] + CAM_FOLLOW[2],
  ],
  look: FLIGHT_START,
  fov: 28,
}

/** ~3mm corner radius on the real 85.6mm card, matched to the PNG. */
const CARD_CORNER = 28 / 800

function roundedNotchShape(w, h) {
  const hw = w / 2
  const hh = h / 2
  const r = w * CARD_CORNER
  const notchX = -hw + CARD_NOTCH.u * w
  const notchY = hh - CARD_NOTCH.v * h
  const shape = new THREE.Shape()
  shape.moveTo(-hw + r, -hh)
  shape.lineTo(hw - r, -hh)
  shape.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(hw, notchY)
  shape.lineTo(notchX, hh)
  shape.lineTo(-hw + r, hh)
  shape.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(-hw, -hh + r)
  shape.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 3 / 2, false)
  return shape
}

function createNotchedCardGeometry() {
  const [w, h] = TRASH_CARD.size
  const hw = w / 2
  const hh = h / 2
  const geo = new THREE.ExtrudeGeometry(roundedNotchShape(w, h), {
    depth: CARD_THICK,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 8,
  })
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const u = (x + hw) / w
    const v = (y + hh) / h
    // z = 0 is the back cap. Mirror it so the art still reads from behind.
    uv.setXY(i, pos.getZ(i) < CARD_THICK * 0.5 ? 1 - u : u, v)
  }
  uv.needsUpdate = true
  geo.translate(0, 0, -CARD_THICK / 2)
  geo.computeVertexNormals()
  return geo
}

/** Rest pose is `base`. A small bow along the long edge; the notch stays a hole. */
function writeCardBend(geometry, base, amount) {
  const arr = geometry.attributes.position.array
  const hw = TRASH_CARD.size[0] * 0.5
  const hh = TRASH_CARD.size[1] * 0.5
  for (let i = 0; i < arr.length; i += 3) {
    const x = base[i]
    const y = base[i + 1]
    const along = x / hw
    const across = y / hh
    const bow = (1 - along * along) * (1 - 0.28 * across * across)
    arr[i] = x
    arr[i + 1] = y
    arr[i + 2] = base[i + 2] + bow * amount
  }
  geometry.attributes.position.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
}

function restoreCardBend(geometry, base) {
  geometry.attributes.position.array.set(base)
  geometry.attributes.position.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
}

/** Zero alpha outside the rounded, notched outline so square tips cannot fill in. */
function punchCardAlpha(texture) {
  const img = texture.image
  const w = img?.width
  const h = img?.height
  if (!w || !h) return texture
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)
  const image = ctx.getImageData(0, 0, w, h)
  const data = image.data
  const rad = CARD_CORNER * w
  const notchX = CARD_NOTCH.u * w
  const notchY = CARD_NOTCH.v * h
  const ax = w - notchX
  const ay = notchY
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const cx = Math.min(Math.max(x, rad), w - rad)
      const cy = Math.min(Math.max(y, rad), h - rad)
      const dx = x - cx
      const dy = y - cy
      const outsideRound = dx * dx + dy * dy > rad * rad
      const outsideNotch = ax * y - ay * (x - notchX) < 0
      if (outsideRound || outsideNotch) data[(y * w + x) * 4 + 3] = 0
    }
  }
  ctx.putImageData(image, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = texture.anisotropy || 4
  tex.needsUpdate = true
  return tex
}

function MetroCardBody({ texture, lit = false, meshRef }) {
  const geometry = useMemo(() => createNotchedCardGeometry(), [])
  const map = useMemo(() => punchCardAlpha(texture), [texture])
  const materials = useMemo(() => ([
    new THREE.MeshStandardMaterial({
      map,
      roughness: lit ? 0.45 : 0.88,
      metalness: lit ? 0.06 : 0.04,
      emissive: new THREE.Color('#2a2418'),
      emissiveIntensity: lit ? 0.4 : 0,
      // Discard the PNG's clear pixels. Blending ate the card against the floor.
      alphaTest: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    new THREE.MeshStandardMaterial({
      color: '#c49a28',
      roughness: 0.65,
      metalness: 0.12,
    }),
  ]), [map, lit])
  useLayoutEffect(() => () => {
    geometry.dispose()
    if (map !== texture) map.dispose()
    materials.forEach((m) => m.dispose())
  }, [geometry, map, materials, texture])
  return <mesh ref={meshRef} geometry={geometry} material={materials} />
}

/**
 * Intro: one continuous toss. The card is already spinning and already
 * moving on a single ease-out spline into the litter. Spin rate decays
 * with that same ease. The camera rides the same clock. Bend is a vertex
 * bow, skipped on low.
 */
export function WindCard({ ready, onCameraHome, reducedMotion, driveCamera = true }) {
  const group = useRef()
  const meshRef = useRef(null)
  const basePos = useRef(null)
  const { camera } = useThree()
  const { tier } = useGfx()
  const texture = useLoader(THREE.TextureLoader, '/metrocard.png')
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  const state = useRef({
    life: 0, // continuous clock — never resets (keeps flutter phase continuous)
    age: 0, // flight progress clock — only advances once ready
    camHome: false,
    cardLanded: false,
    finished: false,
    bent: false,
  })

  const LAND_SCALE = 1
  const HERO_SCALE = 1.55
  /** Whole turns around the long axis, so the extra spin is identity on landing. */
  const SPIN_TURNS = 3
  const CARD_DUR = 2.8
  const FACE_YAW = -Math.PI / 2

  const HERO = useMemo(() => new THREE.Vector3(...FLIGHT_START), [])
  const LAND = useMemo(() => new THREE.Vector3(...TRASH_CARD.pos), [])
  // Cross the open floor in front of the kiosk, then drop down the left side.
  // The screen plane stays off the arc, and the litter spot is unchanged.
  const flight = useMemo(() => new THREE.CubicBezierCurve3(
    HERO.clone(),
    new THREE.Vector3(0.15, 2.0, -1.7),
    new THREE.Vector3(-1.55, 0.55, -5.45),
    LAND.clone(),
  ), [HERO, LAND])
  const LAND_ROT = useMemo(() => new THREE.Euler(...TRASH_CARD.rot), [])
  const CAM_START = useMemo(() => ({
    pos: new THREE.Vector3(...INTRO_CAM.pos),
    look: HERO.clone(),
    fov: INTRO_CAM.fov,
  }), [HERO])
  const CAM_KIOSK = useMemo(() => {
    const shot = resolvePov('kiosk')
    return {
      pos: new THREE.Vector3(...shot.position),
      look: new THREE.Vector3(...shot.lookAt),
      fov: shot.fov,
    }
  }, [])
  const camPos = useMemo(() => new THREE.Vector3(), [])
  const tmpLook = useMemo(() => new THREE.Vector3(), [])

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
      bent: false,
    }
    if (basePos.current && meshRef.current) {
      restoreCardBend(meshRef.current.geometry, basePos.current)
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
    const setCam = (pos, look, fov) => {
      if (!driveCamera) return
      camera.position.copy(pos)
      camera.lookAt(look)
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    const flatten = () => {
      if (!s.bent || !basePos.current || !meshRef.current) return
      restoreCardBend(meshRef.current.geometry, basePos.current)
      s.bent = false
    }

    if (reducedMotion) {
      flatten()
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

    // One spline. Ease-out so speed and spin are already at full rate on the first frame.
    const raw = Math.min(1, s.age / CARD_DUR)
    const e = 1 - (1 - raw) ** 3
    const t = s.life

    if (raw >= 1) {
      if (s.bent) flatten()
      g.position.copy(LAND)
      g.rotation.copy(LAND_ROT)
      g.scale.setScalar(LAND_SCALE)
      s.cardLanded = true
      if (driveCamera && !s.camHome) {
        setCam(CAM_KIOSK.pos, CAM_KIOSK.look, CAM_KIOSK.fov)
        s.camHome = true
      }
      finishIntro(s)
      return
    }

    flight.getPointAt(e, g.position)
    const spin = (1 - e) * Math.PI * 2 * SPIN_TURNS
    g.rotation.set(
      THREE.MathUtils.lerp(0, LAND_ROT.x, e) + spin,
      THREE.MathUtils.lerp(FACE_YAW, LAND_ROT.y, e),
      THREE.MathUtils.lerp(0, LAND_ROT.z, e),
    )
    g.scale.setScalar(THREE.MathUtils.lerp(HERO_SCALE, LAND_SCALE, e))

    const mesh = meshRef.current
    if (mesh && !basePos.current) {
      basePos.current = new Float32Array(mesh.geometry.attributes.position.array)
    }
    if (mesh && basePos.current) {
      const bow = tier === 'low'
        ? 0
        : Math.sin(t * 2.05) * 0.012 * (0.35 + 0.65 * (1 - e))
      if (Math.abs(bow) > 0.001) {
        writeCardBend(mesh.geometry, basePos.current, bow)
        s.bent = true
      } else if (s.bent) {
        restoreCardBend(mesh.geometry, basePos.current)
        s.bent = false
      }
    }

    // Same clock as the card: follow from the open side, aim eases onto the kiosk.
    if (driveCamera && !s.camHome) {
      camPos.copy(g.position)
      camPos.x += CAM_FOLLOW[0]
      camPos.y += CAM_FOLLOW[1]
      camPos.z += CAM_FOLLOW[2]
      camPos.lerp(CAM_KIOSK.pos, e)
      tmpLook.copy(g.position).lerp(CAM_KIOSK.look, e * e * e)
      const fov = THREE.MathUtils.lerp(INTRO_CAM.fov, CAM_KIOSK.fov, e)
      setCam(camPos, tmpLook, fov)
    }
  })

  return (
    <group ref={group} position={HERO.toArray()} scale={HERO_SCALE} rotation={[0, FACE_YAW, 0]}>
      <MetroCardBody texture={texture} lit meshRef={meshRef} />
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
        <group position={TRASH_CARD.pos} rotation={TRASH_CARD.rot}>
          <MetroCardBody texture={metroTex} />
        </group>
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
