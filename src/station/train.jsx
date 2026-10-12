/* eslint-disable react/no-unknown-property */
import * as THREE from 'three'
import { HOSE, TRAIN_ARRIVE_Z, TRAIN_CAR_L, TRAIN_CAR_N, TRAIN_COUPLE, TRAIN_DEPART_Z, TRAIN_LINES, TRAIN_UNIT, makeCanvasTexture, makeLabelTexture, paintCarFront, paintCarSide, paintRoofRibs } from './textures'
import { TRACK_CX, TRAIN_Y, TRAIN_Z } from './space'
import { useFrame } from '@react-three/fiber'
import { useGfx } from '../lib/useGfx'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'

function createCarProfile(w, h, arch) {
  const hw = w / 2
  const wallTop = h - arch
  const shape = new THREE.Shape()
  shape.moveTo(-hw, 0)
  shape.lineTo(-hw, wallTop)
  // Gentle R62A-style roof arch
  shape.quadraticCurveTo(0, wallTop + arch * 2.05, hw, wallTop)
  shape.lineTo(hw, 0)
  shape.closePath()
  return shape
}

function createCarBodyGeometry(w, h, l, arch) {
  const geo = new THREE.ExtrudeGeometry(createCarProfile(w, h, arch), {
    depth: l,
    bevelEnabled: false,
    curveSegments: 20,
    steps: 1,
  })
  geo.translate(0, 0, -l)
  geo.computeVertexNormals()
  return geo
}

function createCarFrontGeometry(w, h, arch) {
  const geo = new THREE.ShapeGeometry(createCarProfile(w, h, arch), 20)
  // UV: shape is in XY; remap so the front texture covers the silhouette
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  const hw = w / 2
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    uv.setXY(i, (x + hw) / w, y / h)
  }
  uv.needsUpdate = true
  return geo
}

function createCarRoofGeometry(w, h, l, arch) {
  const hw = w / 2
  const wallTop = h - arch
  const inset = 0.12
  const shape = new THREE.Shape()
  // Roof cap only — sits on top of the walls, follows the same arch
  shape.moveTo(-hw - 0.01, wallTop - 0.02)
  shape.lineTo(-hw - 0.01, wallTop)
  shape.quadraticCurveTo(0, wallTop + arch * 2.05, hw + 0.01, wallTop)
  shape.lineTo(hw + 0.01, wallTop - 0.02)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: l - inset,
    bevelEnabled: false,
    curveSegments: 24,
    steps: 1,
  })
  // Stop short of the nose so the roof cap doesn't share a plane with the front
  geo.translate(0, 0, -l)
  geo.computeVertexNormals()
  return geo
}

function CarHardware({ carL, lead, tail }) {
  return (
    <group>
      {lead ? (
        <group>
          <mesh position={[0, 0.4, 0.42]}>
            <boxGeometry args={[0.3, 0.22, 0.4]} />
            <meshStandardMaterial color="#2a2e32" roughness={0.48} metalness={0.68} />
          </mesh>
          {[-0.22, 0.22].map((x) => (
            <mesh
              key={`hose-${x}`}
              position={[x, 0.28, 0.32]}
              rotation={[Math.PI / 2.2, 0, x > 0 ? 0.4 : -0.4]}
            >
              <torusGeometry args={[0.12, 0.024, 6, 10, Math.PI]} />
              <meshStandardMaterial {...HOSE} />
            </mesh>
          ))}
          {[-0.42, 0.42].map((x) => (
            <mesh key={`shackle-${x}`} position={[x, 0.38, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.07, 0.016, 6, 10]} />
              <meshStandardMaterial color="#3a3834" roughness={0.45} metalness={0.7} />
            </mesh>
          ))}
        </group>
      ) : null}
      {!tail ? (
        <group position={[0, 0.5, -carL - TRAIN_COUPLE * 0.5]}>
          <mesh>
            <boxGeometry args={[0.28, 0.22, Math.max(0.12, TRAIN_COUPLE)]} />
            <meshStandardMaterial color="#2a2c2e" roughness={0.55} metalness={0.65} />
          </mesh>
          {[-0.15, 0.15].map((x) => (
            <mesh
              key={x}
              position={[x, -0.06, 0]}
              rotation={[Math.PI / 2, 0, x > 0 ? 0.45 : -0.45]}
            >
              <torusGeometry args={[0.1, 0.018, 6, 12, Math.PI]} />
              <meshStandardMaterial {...HOSE} />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  )
}

function TrainCar({ maps, body, frontGeo, roofGeo, carL, carW, wallTop, zOffset, lead, tail, headLights }) {
  const { settings } = useGfx()
  return (
    <group position={[0, 0, zOffset]}>
      <mesh geometry={body} position={[0, 0, -0.03]}>
        <meshStandardMaterial color="#c8ced3" roughness={0.48} metalness={0.34} />
      </mesh>
      <mesh geometry={roofGeo} position={[0, 0.012, 0]}>
        <meshStandardMaterial
          map={maps.roof}
          color="#e4e8ec"
          roughness={0.48}
          metalness={0.28}
          emissive="#9aa4ae"
          emissiveIntensity={0.22}
        />
      </mesh>
      {lead ? (
        <mesh geometry={frontGeo} position={[0, 0, 0.035]}>
          <meshStandardMaterial
            map={maps.front}
            roughness={0.46}
            metalness={0.22}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ) : (
        <mesh position={[0, wallTop * 0.48, 0.02]}>
          <boxGeometry args={[carW * 0.96, wallTop * 0.92, 0.08]} />
          <meshStandardMaterial color="#aeb4ba" roughness={0.42} metalness={0.4} />
        </mesh>
      )}
      <mesh position={[0, wallTop * 0.48, -carL + 0.02]}>
        <boxGeometry args={[carW * 0.96, wallTop * 0.92, 0.08]} />
        <meshStandardMaterial color="#aeb4ba" roughness={0.42} metalness={0.4} />
      </mesh>
      {!tail ? (
        <mesh position={[0, wallTop * 0.5, -carL - TRAIN_COUPLE * 0.5]}>
          <boxGeometry args={[carW * 0.98, wallTop * 0.96, TRAIN_COUPLE + 0.22]} />
          <meshStandardMaterial color="#c4cad0" roughness={0.48} metalness={0.3} />
        </mesh>
      ) : null}
      {lead ? [-1, 1].map((side) => (
        <mesh key={`nose-${side}`} position={[side * (carW / 2), wallTop * 0.5, 0.04]}>
          <boxGeometry args={[0.08, wallTop, 0.14]} />
          <meshStandardMaterial color="#c8ced3" roughness={0.48} metalness={0.34} />
        </mesh>
      )) : null}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (carW / 2 + 0.01), wallTop * 0.5, -carL / 2 + 0.02]}
          rotation={[0, side * Math.PI / 2, 0]}
        >
          <planeGeometry args={[carL + 0.08, wallTop]} />
          <meshStandardMaterial
            map={side === -1 ? maps.sidePlatform : maps.side}
            roughness={0.46}
            metalness={0.22}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.13, -carL / 2]}>
        <boxGeometry args={[carW * 1.02, 0.26, carL * 0.98]} />
        <meshStandardMaterial color="#1a1c1e" roughness={0.88} metalness={0.12} />
      </mesh>
      <CarHardware carL={carL} lead={lead} tail={tail} />
      {lead && settings.extras
        ? [-0.62, 0.62].map((x, i) => (
          <pointLight
            key={x}
            ref={(node) => { if (headLights) headLights.current[i] = node }}
            position={[x, 1.05, 0.28]}
            color="#fff3c4"
            intensity={3.6}
            distance={8}
            decay={2}
          />
        ))
        : null}
    </group>
  )
}

export function Train({ invite = false, blockClicksRef }) {
  const { startSettings, settings } = useGfx()
  const root = useRef()
  const glowLight = useRef()
  const headLights = useRef([])
  const hover = useRef(0)
  const hoverTarget = useRef(0)
  const [lineIndex, setLineIndex] = useState(0)
  const line = TRAIN_LINES[lineIndex]
  const motion = useRef({
    phase: 'parked',
    z: TRAIN_Z,
    speed: 0,
    nextLine: 1,
  })
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  // Sides and roof do not include the route badge. Rebuilding them when
  // the line changes painted two 2048-wide canvases on the main thread
  // and froze clicks. Only the front texture depends on `line`.
  const bodyMaps = useMemo(() => {
    const side = makeLabelTexture(paintCarSide, startSettings.trainSide[0], startSettings.trainSide[1])
    const sidePlatform = makeLabelTexture(
      (ctx, w, h) => paintCarSide(ctx, w, h, { reverse: true }),
      startSettings.trainSide[0],
      startSettings.trainSide[1],
    )
    const roof = makeCanvasTexture(
      paintRoofRibs,
      startSettings.propPx ?? 256,
      THREE.SRGBColorSpace,
      startSettings.aniso ?? 4,
    )
    roof.wrapS = THREE.RepeatWrapping
    roof.wrapT = THREE.RepeatWrapping
    roof.repeat.set(8, 1)
    return { side, sidePlatform, roof }
  }, [startSettings])
  const front = useMemo(
    () => makeLabelTexture(
      (ctx, w, h) => paintCarFront(ctx, w, h, line),
      startSettings.trainFront,
      startSettings.trainFront,
    ),
    [line, startSettings],
  )
  const maps = useMemo(
    () => ({ front, ...bodyMaps }),
    [front, bodyMaps],
  )

  const carL = TRAIN_CAR_L
  const carW = 2.9
  const carH = 3.2
  const arch = 0.32
  const wallTop = carH - arch
  const body = useMemo(
    () => createCarBodyGeometry(carW, carH, carL, arch),
    [carW, carH, carL, arch],
  )
  const frontGeo = useMemo(
    () => createCarFrontGeometry(carW, carH, arch),
    [carW, carH, arch],
  )
  const roofGeo = useMemo(
    () => createCarRoofGeometry(carW, carH, carL, arch),
    [carW, carH, carL, arch],
  )
  useLayoutEffect(() => () => {
    front.dispose()
  }, [front])
  useLayoutEffect(() => () => {
    Object.values(bodyMaps).forEach((tex) => tex.dispose())
  }, [bodyMaps])
  useLayoutEffect(() => () => {
    body.dispose()
    frontGeo.dispose()
    roofGeo.dispose()
  }, [body, frontGeo, roofGeo])

  const y = TRAIN_Y
  const trainLen = TRAIN_CAR_N * TRAIN_UNIT

  useFrame((state, dt) => {
    if (!root.current) return
    const d = Math.min(dt, 0.05)
    const m = motion.current
    const t = state.clock.elapsedTime
    const parked = m.phase === 'parked' && !reducedMotion
    const idleMotion = settings.idleMotion !== false

    const wantHover = hoverTarget.current > 0 && parked
    hover.current = THREE.MathUtils.lerp(hover.current, wantHover ? 1 : 0, 1 - Math.exp(-10 * d))
    const h = hover.current
    const call = invite && parked
    const idle = parked && idleMotion ? 0.5 + 0.5 * Math.sin(t * (call ? 1.15 : 1.35)) : 0
    const s = 1 + h * 0.028 + idle * (call ? 0.018 : 0.008)
    root.current.scale.set(s, s, s)
    // Headlights stay on while rolling — parked-only used to kill them.
    if (glowLight.current) {
      glowLight.current.intensity = (parked
        ? (call ? 1.25 : 0.55) + idle * (call ? 1.7 : 0.85)
        : 0.85) + h * 3.4
    }
    headLights.current.forEach((light) => {
      if (light) light.intensity = 3.6 + (parked ? idle * (call ? 1.85 : 1.0) : 0.5) + h * 2.2
    })

    if (m.phase === 'departing') {
      hoverTarget.current = 0
      m.speed = Math.min(22, m.speed + d * 9)
      m.z += m.speed * d
      root.current.position.z = m.z
      if (m.z >= TRAIN_DEPART_Z) {
        const next = m.nextLine
        m.phase = 'arriving'
        m.z = TRAIN_ARRIVE_Z
        m.speed = 10
        root.current.position.z = m.z
        setLineIndex(next)
      }
      return
    }

    if (m.phase === 'arriving') {
      const remain = TRAIN_Z - m.z
      m.speed = Math.max(2.2, Math.min(14, remain * 0.55))
      m.z = Math.min(TRAIN_Z, m.z + m.speed * d)
      root.current.position.z = m.z
      if (m.z >= TRAIN_Z - 0.04) {
        m.z = TRAIN_Z
        m.speed = 0
        m.phase = 'parked'
        root.current.position.z = TRAIN_Z
      }
    }
  })

  const onTrainClick = (event) => {
    event.stopPropagation()
    // Close-up kiosk clicks fall through the CSS-3D menu on a bad frame
    // and used to start the departure instead of navigating.
    if (reducedMotion || blockClicksRef?.current) return
    const m = motion.current
    if (m.phase !== 'parked') return
    hoverTarget.current = 0
    m.phase = 'departing'
    m.speed = 1.2
    m.nextLine = (lineIndex + 1) % TRAIN_LINES.length
  }

  return (
    <group
      ref={root}
      position={[TRACK_CX, y, TRAIN_Z]}
      onClick={onTrainClick}
      onPointerOver={(e) => {
        e.stopPropagation()
        if (motion.current.phase === 'parked' && !reducedMotion && !blockClicksRef?.current) {
          hoverTarget.current = 1
          document.body.style.cursor = 'pointer'
        }
      }}
      onPointerOut={() => {
        hoverTarget.current = 0
        document.body.style.cursor = 'auto'
      }}
    >
      {settings.extras ? (
        <pointLight position={[-2.4, 2.1, 1.6]} color="#e4ebf2" intensity={5.5} distance={14} decay={2} />
      ) : null}
      <pointLight
        ref={glowLight}
        position={[0, 1.4, 1.1]}
        color="#fff6e0"
        intensity={0}
        distance={10}
        decay={2}
      />
      {Array.from({ length: TRAIN_CAR_N }, (_, i) => (
        <TrainCar
          key={i}
          maps={maps}
          body={body}
          frontGeo={frontGeo}
          roofGeo={roofGeo}
          carL={carL}
          carW={carW}
          carH={carH}
          arch={arch}
          wallTop={wallTop}
          zOffset={-i * TRAIN_UNIT}
          lead={i === 0}
          tail={i === TRAIN_CAR_N - 1}
          headLights={i === 0 ? headLights : null}
        />
      ))}
      <mesh position={[0, carH * 0.45, -trainLen * 0.45]}>
        <boxGeometry args={[carW * 1.2, carH, trainLen * 0.95]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
