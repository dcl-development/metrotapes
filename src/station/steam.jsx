/* eslint-disable react/no-unknown-property */
import * as THREE from 'three'
import { TRACK_CX, TRACK_Y, TRAIN_Z } from './space'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'

/** Winter-exhaust style steam off the train undercarriage — not station-wide dust */
const STEAM_N = 48

export default function TrainSteam() {
  const points = useRef()
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const { positions, vel, life } = useMemo(() => {
    const pos = new Float32Array(STEAM_N * 3)
    const v = new Float32Array(STEAM_N * 3)
    const lf = new Float32Array(STEAM_N)
    const trainY = TRACK_Y + 0.14
    for (let i = 0; i < STEAM_N; i += 1) {
      const i3 = i * 3
      pos[i3] = TRACK_CX - 1.15 + (Math.random() - 0.5) * 0.55
      pos[i3 + 1] = trainY + 0.15 + Math.random() * 0.35
      pos[i3 + 2] = TRAIN_Z - Math.random() * 12
      v[i3] = -0.04 + Math.random() * 0.08
      v[i3 + 1] = 0.35 + Math.random() * 0.55
      v[i3 + 2] = -0.12 + Math.random() * 0.2
      lf[i] = Math.random()
    }
    return { positions: pos, vel: v, life: lf }
  }, [])

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, dt) => {
    if (reducedMotion || !points.current) return
    const d = Math.min(dt, 0.05)
    const arr = points.current.geometry.attributes.position.array
    const trainY = TRACK_Y + 0.14
    const mat = points.current.material
    let alive = 0
    for (let i = 0; i < STEAM_N; i += 1) {
      const i3 = i * 3
      life[i] += d * (0.35 + (i % 5) * 0.04)
      arr[i3] += vel[i3] * d
      arr[i3 + 1] += vel[i3 + 1] * d
      arr[i3 + 2] += vel[i3 + 2] * d
      vel[i3 + 1] *= 1 - 0.35 * d
      if (life[i] > 1 || arr[i3 + 1] > trainY + 2.4) {
        life[i] = 0
        arr[i3] = TRACK_CX - 1.15 + (Math.random() - 0.5) * 0.55
        arr[i3 + 1] = trainY + 0.12 + Math.random() * 0.25
        arr[i3 + 2] = TRAIN_Z - Math.random() * 12
        vel[i3] = -0.04 + Math.random() * 0.08
        vel[i3 + 1] = 0.4 + Math.random() * 0.5
        vel[i3 + 2] = -0.12 + Math.random() * 0.2
      } else {
        alive += 1 - life[i]
      }
    }
    points.current.geometry.attributes.position.needsUpdate = true
    if (mat) mat.opacity = 0.18 + (alive / STEAM_N) * 0.22
  })

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color="#dce4e8"
        size={0.22}
        sizeAttenuation
        transparent
        opacity={0.32}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
