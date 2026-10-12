/* eslint-disable react/no-unknown-property */
import * as THREE from 'three'
import { LEN, MID_Z, RAIL_HALF, TRACK_CX, TRACK_W, TRACK_X0, TRACK_Y, hash01 } from './space'
import { useLayoutEffect, useMemo, useRef } from 'react'

export function Tracks({ maps }) {
  const tieMesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tieGap = 0.55
  const tieN = Math.floor(LEN / tieGap)
  const tieGeo = useMemo(() => new THREE.BoxGeometry(2.55, 0.12, 0.22), [])
  const riserH = -TRACK_Y

  useLayoutEffect(() => {
    const inst = tieMesh.current
    if (!inst) return
    const z0 = MID_Z + LEN / 2 - tieGap * 0.5
    const tint = new THREE.Color()
    for (let i = 0; i < tieN; i += 1) {
      dummy.position.set(TRACK_CX, TRACK_Y + 0.06, z0 - i * tieGap)
      dummy.rotation.y = ((i * 17) % 7 - 3) * 0.008
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
      const n = hash01(i * 11 + 2)
      tint.setRGB(0.62 + n * 0.22, 0.48 + n * 0.16, 0.32 + n * 0.1)
      inst.setColorAt(i, tint)
    }
    inst.instanceMatrix.needsUpdate = true
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true
  }, [dummy, tieN])

  useLayoutEffect(() => () => tieGeo.dispose(), [tieGeo])

  const railY = TRACK_Y + 0.16

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[TRACK_X0 + TRACK_W / 2, TRACK_Y, MID_Z]}>
        <planeGeometry args={[TRACK_W, LEN]} />
        <meshStandardMaterial
          map={maps.ballastMap}
          color="#6a5340"
          roughness={0.98}
          metalness={0}
        />
      </mesh>
      <mesh position={[TRACK_X0 + 0.015, TRACK_Y + riserH / 2, MID_Z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[LEN, riserH]} />
        <meshStandardMaterial map={maps.riserMap} roughness={0.96} metalness={0} />
      </mesh>
      <mesh position={[TRACK_X0, -0.03, MID_Z]}>
        <boxGeometry args={[0.18, 0.08, LEN]} />
        <meshStandardMaterial map={maps.riserMap} color="#9a9080" roughness={0.9} metalness={0} />
      </mesh>
      {[0.22, 0.48].map((yOff, i) => (
        <mesh key={i} position={[TRACK_X0 + 0.05, TRACK_Y + yOff, MID_Z]}>
          <boxGeometry args={[0.055, 0.038, LEN]} />
          <meshStandardMaterial
            color={i ? '#4a3424' : '#2e281c'}
            roughness={0.72}
            metalness={0.32}
          />
        </mesh>
      ))}
      <instancedMesh ref={tieMesh} args={[tieGeo, null, tieN]}>
        <meshStandardMaterial color="#2c1a0e" roughness={0.94} metalness={0} />
      </instancedMesh>
      {[-RAIL_HALF, RAIL_HALF].map((x) => (
        <group key={x} position={[TRACK_CX + x, railY, MID_Z]}>
          <mesh>
            <boxGeometry args={[0.07, 0.1, LEN]} />
            <meshStandardMaterial color="#1a1816" roughness={0.55} metalness={0.55} />
        </mesh>
          <mesh position={[0, 0.055, 0]}>
            <boxGeometry args={[0.085, 0.018, LEN]} />
            <meshStandardMaterial color="#3a3834" roughness={0.35} metalness={0.7} />
          </mesh>
        </group>
      ))}
      <mesh position={[TRACK_CX + RAIL_HALF + 0.55, TRACK_Y + 0.2, MID_Z]}>
        <boxGeometry args={[0.12, 0.08, LEN]} />
        <meshStandardMaterial color="#141210" roughness={0.7} metalness={0.4} />
      </mesh>
    </group>
  )
}
