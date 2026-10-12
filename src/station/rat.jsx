/* eslint-disable react/no-unknown-property */
import * as THREE from 'three'
import { TRACK_W, TRACK_X0, TRACK_Y } from './space'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'

/** Tiny NYC vibe rat — pear body, pink feet/tail, bob-scurry every so often */
const RAT_FUR = '#7a5a44'
const RAT_FUR_DARK = '#5a4030'
const RAT_PINK = '#f0b0be'
const RAT_PINK_DEEP = '#e08098'
const RAT_EYE = '#14110f'

// Track-only left↔right: duck under the platform lip (TRACK_X0) ↔ far side of the trench
const RAT_UNDER = TRACK_X0 - 0.42
const RAT_FAR = TRACK_X0 + TRACK_W - 0.35
const RAT_Y = TRACK_Y + 0.11

const RAT_PATHS = [
  { a: [RAT_FAR, RAT_Y, -3.6], b: [RAT_UNDER, RAT_Y, -3.65], speed: 2.6 },
  { a: [RAT_UNDER, RAT_Y, -4.5], b: [RAT_FAR, RAT_Y, -4.55], speed: 2.5 },
  { a: [RAT_FAR, RAT_Y, -5.4], b: [RAT_UNDER, RAT_Y, -5.35], speed: 2.7 },
  { a: [RAT_UNDER, RAT_Y, -6.3], b: [RAT_FAR, RAT_Y, -6.35], speed: 2.4 },
  { a: [RAT_FAR, RAT_Y, -7.1], b: [RAT_UNDER, RAT_Y, -7.15], speed: 2.8 },
]

export default function VibeRat() {
  const root = useRef()
  const body = useRef()
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const state = useRef({
    mode: 'wait',
    t: 0.4 + Math.random() * 0.8,
    path: RAT_PATHS[0],
    progress: 0,
  })

  useFrame((_, dt) => {
    if (!root.current || reducedMotion) return
    const d = Math.min(dt, 0.05)
    const s = state.current
    const g = root.current

    if (s.mode === 'wait') {
      g.visible = false
      s.t -= d
      if (s.t > 0) return
      s.path = RAT_PATHS[Math.floor(Math.random() * RAT_PATHS.length)]
      s.progress = 0
      s.mode = 'run'
      const { a, b } = s.path
      g.position.set(a[0], a[1], a[2])
      g.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2])
      g.rotation.z = 0
      g.visible = true
      return
    }

    // run
    const { a, b, speed } = s.path
    const span = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1
    s.progress = Math.min(1, s.progress + (d * speed) / span)
    const t = s.progress
    const x = a[0] + (b[0] - a[0]) * t
    const z = a[2] + (b[2] - a[2]) * t
    const baseY = a[1] + (b[1] - a[1]) * t
    const bob = Math.abs(Math.sin(t * Math.PI * 10)) * 0.04
    g.position.set(x, baseY + bob, z)
    g.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2])
    g.rotation.z = Math.sin(t * Math.PI * 12) * 0.14
    if (body.current) {
      body.current.rotation.x = Math.sin(t * Math.PI * 14) * 0.1
    }

    if (t >= 1) {
      s.mode = 'wait'
      s.t = 1.5 + Math.random() * 2.5
      g.visible = false
    }
  })

  if (reducedMotion) return null

  return (
    <group ref={root} visible={false} scale={0.52} frustumCulled={false}>
      <group ref={body}>
        {/* pear body — fat rear, taper toward nose */}
        <mesh position={[0, 0.22, -0.08]} scale={[0.95, 0.88, 1.15]}>
          <sphereGeometry args={[0.42, 14, 12]} />
          <meshStandardMaterial color={RAT_FUR} roughness={0.88} metalness={0} />
        </mesh>
        <mesh position={[0, 0.2, 0.28]} scale={[0.72, 0.68, 0.78]}>
          <sphereGeometry args={[0.32, 12, 10]} />
          <meshStandardMaterial color={RAT_FUR} roughness={0.86} metalness={0} />
        </mesh>
        {/* ears */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.22, 0.42, 0.32]} rotation={[0.35, side * -0.4, side * 0.35]}>
            <mesh>
              <circleGeometry args={[0.14, 10]} />
              <meshStandardMaterial color={RAT_FUR_DARK} roughness={0.95} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0, 0.01]} scale={0.62}>
              <circleGeometry args={[0.14, 10]} />
              <meshStandardMaterial color={RAT_PINK} roughness={0.85} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
        {/* eyes */}
        {[-1, 1].map((side) => (
          <mesh key={`e-${side}`} position={[side * 0.11, 0.26, 0.48]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color={RAT_EYE} roughness={0.4} metalness={0.1} />
          </mesh>
        ))}
        {/* snout + nose */}
        <mesh position={[0, 0.16, 0.52]} scale={[0.7, 0.55, 0.85]}>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial color={RAT_FUR_DARK} roughness={0.9} metalness={0} />
        </mesh>
        <mesh position={[0, 0.15, 0.62]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color={RAT_PINK_DEEP} roughness={0.7} metalness={0} />
        </mesh>
        {/* pink feet */}
        {[
          [-0.18, 0.04, 0.18],
          [0.18, 0.04, 0.18],
          [-0.2, 0.04, -0.22],
          [0.2, 0.04, -0.22],
        ].map((p, i) => (
          <mesh key={`f-${i}`} position={p} scale={[1, 0.55, 1.25]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color={RAT_PINK} roughness={0.8} metalness={0} />
          </mesh>
        ))}
        {/* tail — pink curve trailing behind */}
        <group position={[0, 0.18, -0.48]} rotation={[0.4, 0, 0.45]}>
          <mesh position={[0, 0, -0.22]} rotation={[0.5, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.018, 0.55, 6]} />
            <meshStandardMaterial color={RAT_PINK} roughness={0.75} metalness={0} />
          </mesh>
          <mesh position={[0.02, -0.08, -0.52]} rotation={[0.9, 0.2, 0]}>
            <cylinderGeometry args={[0.018, 0.01, 0.28, 6]} />
            <meshStandardMaterial color={RAT_PINK_DEEP} roughness={0.75} metalness={0} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
