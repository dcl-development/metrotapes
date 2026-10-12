/* eslint-disable react/no-unknown-property */
import { AdditiveBlending } from 'three'
import { COL, FLOOR_W, HEIGHT, WALL_X } from './space'
import { tubeGlowTexture } from './glow'
import { useFrame } from '@react-three/fiber'
import { useGfx } from '../lib/useGfx'
import { useMemo, useRef } from 'react'

// Cross-fixture: short tubes that span the ceiling width, receding into depth
const FIXTURE_COLOR = '#f5f0e8'   // warm off-white, slightly yellowish like real fluorescents
const FIXTURE_W     = FLOOR_W * 0.72   // fixture spans most of ceiling width
const FIXTURE_COUNT = 6           // what you can actually see from the kiosk
const FIXTURE_Z0    = 2.0
const FIXTURE_STEP  = 3.8

// One cross-ceiling fluorescent row
function CeilingFixture({ z, index, lit = true, flicker, gain = 5.4, cheapGlow = false }) {
  const tubeRef  = useRef()
  const diffuserRef = useRef()
  const lightRef = useRef()

  useFrame(() => {
    if (!lit && index > 3) return
    const pulse = flicker?.current
    const level = pulse && pulse.index === index ? pulse.mul : 1
    const tube = level * 10
    const diff = level * 2.2
    const litLevel = level * gain
    // Skip the write when the tube is idle. Six fixtures were touching
    // materials every frame even when nothing flickered.
    const tubeMat = tubeRef.current?.material
    if (tubeMat && tubeMat.emissiveIntensity !== tube) tubeMat.emissiveIntensity = tube
    const diffMat = diffuserRef.current?.material
    if (diffMat && diffMat.emissiveIntensity !== diff) diffMat.emissiveIntensity = diff
    if (lightRef.current && lightRef.current.intensity !== litLevel) {
      lightRef.current.intensity = litLevel
    }
  })

  const y = HEIGHT - 0.34
  const cx = WALL_X + FLOOR_W * 0.42   // centre of ceiling span

  return (
    <group position={[cx, y, z]}>
      <mesh>
        <boxGeometry args={[FIXTURE_W, 0.055, 0.28]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh ref={diffuserRef} position={[0, -0.026, 0]}>
        <boxGeometry args={[FIXTURE_W - 0.04, 0.008, 0.2]} />
        <meshStandardMaterial
          color={FIXTURE_COLOR}
          emissive={FIXTURE_COLOR}
          emissiveIntensity={2.2}
          roughness={0.18}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={tubeRef} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, FIXTURE_W - 0.08, 8]} />
        <meshStandardMaterial
          color={FIXTURE_COLOR}
          emissive={FIXTURE_COLOR}
          emissiveIntensity={10}
          roughness={0.1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      {cheapGlow ? (
        <mesh position={[0, -0.2, 0.02]} raycast={() => null}>
          <planeGeometry args={[FIXTURE_W + 0.35, 0.62]} />
          <meshBasicMaterial
            map={tubeGlowTexture()}
            color={FIXTURE_COLOR}
            transparent
            opacity={0.92}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ) : null}
      {/* Real lights only on nearer rows — bloom still sells the glow farther back */}
      {lit ? (
        <pointLight
        ref={lightRef}
          color={FIXTURE_COLOR}
          intensity={gain}
          distance={6.5}
          decay={2}
          position={[0, -0.35, 0]}
        />
      ) : null}
    </group>
  )
}

function Fluorescents() {
  const { settings } = useGfx()
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  // One nearby tube, every ~5–6s: two tiny dips so it reads as a ballast stutter.
  const flicker = useRef({
    index: -1,
    mul: 1,
    wait: 5.2,
    hold: 0,
    stage: 0,
  })

  useFrame((_, dt) => {
    const f = flicker.current
    if (reducedMotion || settings.idleMotion === false) {
      f.index = -1
      f.mul = 1
      return
    }
    const d = Math.min(dt, 0.05)
    if (f.hold > 0) {
      f.hold -= d
      if (f.stage === 1) f.mul = 0.78
      else if (f.stage === 2) f.mul = 1
      else if (f.stage === 3) f.mul = 0.84
      if (f.hold > 0) return
      if (f.stage === 1) {
        f.stage = 2
        f.hold = 0.04
        f.mul = 1
      } else if (f.stage === 2) {
        f.stage = 3
        f.hold = 0.055 + Math.random() * 0.035
        f.mul = 0.84
      } else {
        f.stage = 0
        f.index = -1
        f.mul = 1
        f.wait = 5.05 + Math.random() * 1.15
      }
      return
    }
    f.wait -= d
    if (f.wait > 0) return
    f.index = 1 + Math.floor(Math.random() * 3)
    f.stage = 1
    f.hold = 0.048 + Math.random() * 0.03
    f.mul = 0.78
  })

  return (
    <group>
      {Array.from({ length: FIXTURE_COUNT }, (_, i) => (
        <CeilingFixture
          key={i}
          index={i}
          z={FIXTURE_Z0 - i * FIXTURE_STEP}
          lit={i < settings.lights}
          gain={settings.tube}
          flicker={flicker}
          cheapGlow={settings.cheapGlow}
        />
      ))}
    </group>
  )
}

export function Atmosphere() {
  const { settings } = useGfx()
  return (
    <>
      <color attach="background" args={[COL.clear]} />
      <fogExp2 attach="fog" args={[COL.clear, settings.fog]} />
      <hemisphereLight args={['#e8e4dc', '#3a3632', settings.hemi]} />
      <ambientLight intensity={settings.ambient} color="#f0ebe4" />
      <Fluorescents />
    </>
  )
}
