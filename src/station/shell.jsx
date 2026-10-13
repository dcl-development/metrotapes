/* eslint-disable react/no-unknown-property */
import * as THREE from 'three'
import { COL, EDGE_X, FLOOR_W, HEIGHT, LEN, MID_Z, PILLAR_GAP, PILLAR_N, PILLAR_X, PILLAR_Z0, PLAT_W, STAIR_N, STAIR_RISE, STAIR_RUN, STAIR_W, STAIR_X, STAIR_Z0, TILE, TRACK_Y, WALL_H, WALL_R, WALL_X, hash01 } from './space'
import { STATION_MAP_REV, makeCanvasTexture, paintWood } from './textures'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { useLayoutEffect, useMemo, useRef } from 'react'

function TiledWall({ maps, x, rotY, z, len }) {
  const tiled = useMemo(() => {
    const wallMap = maps.wallMap.clone()
    const wallBump = maps.wallBump.clone()
    const wallRough = maps.wallRough.clone()
    const rx = len / TILE
    wallMap.repeat.set(rx, 1)
    wallBump.repeat.set(rx, 1)
    wallRough.repeat.set(rx, 1)
    return { wallMap, wallBump, wallRough }
  }, [len, maps.wallBump, maps.wallMap, maps.wallRough])

  useLayoutEffect(() => () => {
    tiled.wallMap.dispose()
    tiled.wallBump.dispose()
    tiled.wallRough.dispose()
  }, [tiled])

  return (
    <mesh rotation={[0, rotY, 0]} position={[x, WALL_H / 2, z]}>
      <planeGeometry args={[len, WALL_H]} />
      <meshPhysicalMaterial
        map={tiled.wallMap}
        bumpMap={tiled.wallBump}
        bumpScale={0.028}
        roughnessMap={tiled.wallRough}
        roughness={0.42}
        metalness={0.02}
        clearcoat={0.12}
        clearcoatRoughness={0.55}
      />
    </mesh>
  )
}

export function Shell({ maps }) {
  const endH = HEIGHT - TRACK_Y

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[WALL_X + PLAT_W / 2, 0, MID_Z]}>
        <planeGeometry args={[PLAT_W, LEN]} />
        <meshStandardMaterial
          map={maps.floorMap}
          color="#8a847a"
          roughness={0.98}
          metalness={0}
        />
      </mesh>
      <TiledWall maps={maps} x={WALL_R} rotY={-Math.PI / 2} z={MID_Z} len={LEN} />
      <TiledWall maps={maps} x={WALL_X} rotY={Math.PI / 2} z={MID_Z} len={LEN} />
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[WALL_X + FLOOR_W / 2, HEIGHT, MID_Z]}>
        <planeGeometry args={[FLOOR_W, LEN]} />
        <meshStandardMaterial map={maps.ceilingMap} roughness={0.97} metalness={0} />
      </mesh>
      <mesh position={[WALL_X + FLOOR_W / 2, TRACK_Y + endH / 2, MID_Z - LEN / 2]}>
        <planeGeometry args={[FLOOR_W, endH]} />
        <meshStandardMaterial color={COL.end} roughness={1} metalness={0} />
      </mesh>
    </group>
  )
}

function createIBeamGeometry(height) {
  const web = new THREE.BoxGeometry(0.055, height, 0.2)
  const near = new THREE.BoxGeometry(0.3, height, 0.042)
  const far = new THREE.BoxGeometry(0.3, height, 0.042)
  near.translate(0, 0, 0.1)
  far.translate(0, 0, -0.1)
  const merged = mergeGeometries([web, near, far])
  web.dispose()
  near.dispose()
  far.dispose()
  return merged
}

function createCeilingBeamGeometry(length) {
  const web = new THREE.BoxGeometry(length, 0.22, 0.05)
  const top = new THREE.BoxGeometry(length, 0.04, 0.28)
  const bot = new THREE.BoxGeometry(length, 0.04, 0.28)
  web.translate(0, -0.15, 0)
  top.translate(0, -0.02, 0)
  bot.translate(0, -0.28, 0)
  const merged = mergeGeometries([web, top, bot])
  web.dispose()
  top.dispose()
  bot.dispose()
  return merged
}

const CEIL_BEAM_N = 34
const CEIL_BEAM_GAP = 1.55
const CEIL_BEAM_Z0 = 6.2

export function CeilingBeams({ maps }) {
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geometry = useMemo(() => createCeilingBeamGeometry(FLOOR_W + 0.32), [])
  const steel = {
    map: maps.steelMap,
    color: '#c4b8a8',
    roughness: 0.78,
    metalness: 0.28,
  }

  useLayoutEffect(() => {
    const inst = mesh.current
    if (!inst) return
    const x = WALL_X + FLOOR_W / 2 - 0.08
    const tint = new THREE.Color()
    for (let i = 0; i < CEIL_BEAM_N; i += 1) {
      dummy.position.set(x, HEIGHT, CEIL_BEAM_Z0 - i * CEIL_BEAM_GAP)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
      const n = hash01(i * 19 + 4)
      tint.setRGB(0.62 + n * 0.28, 0.52 + n * 0.18, 0.4 + n * 0.12)
      inst.setColorAt(i, tint)
    }
    inst.instanceMatrix.needsUpdate = true
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true
  }, [dummy, geometry])

  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group>
      <instancedMesh ref={mesh} args={[geometry, null, CEIL_BEAM_N]}>
        <meshStandardMaterial
          map={maps.steelMap}
          color="#ffffff"
          roughness={0.78}
          metalness={0.28}
        />
      </instancedMesh>
      <mesh position={[WALL_X + 0.06, HEIGHT - 0.1, MID_Z]}>
        <boxGeometry args={[0.14, 0.22, LEN]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      <mesh position={[PILLAR_X, HEIGHT - 0.12, MID_Z]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[LEN, 0.18, 0.22]} />
        <meshStandardMaterial {...steel} />
      </mesh>
    </group>
  )
}

export function Pillars() {
  const mesh = useRef()
  const geometry = useMemo(() => createIBeamGeometry(HEIGHT), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  // Keep I-beams down the platform; skip the one in the kiosk / zoom-out sightline.
  const zs = useMemo(
    () => Array.from({ length: PILLAR_N }, (_, i) => PILLAR_Z0 - i * PILLAR_GAP).filter((z) => z < -4),
    [],
  )

  useLayoutEffect(() => {
    const inst = mesh.current
    if (!inst) return
    zs.forEach((z, i) => {
      dummy.position.set(PILLAR_X, HEIGHT / 2, z)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    })
    inst.instanceMatrix.needsUpdate = true
    inst.count = zs.length
  }, [dummy, geometry, zs])

  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  return (
    <instancedMesh ref={mesh} args={[geometry, null, zs.length]}>
      <meshStandardMaterial color={COL.steel} roughness={0.42} metalness={0.62} />
    </instancedMesh>
  )
}

export function YellowStrip({ maps }) {
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const stripW = 0.42
  const cols = 3
  const step = 0.13
  const rows = Math.floor(LEN / step)
  const count = cols * rows
  const dome = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.042, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)
    geo.scale(1, 0.52, 1)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const top = 0.042 * 0.52
    for (let i = 0; i < pos.count; i += 1) {
      const t = Math.max(0, Math.min(1, pos.getY(i) / top))
      const grit = hash01(i * 13 + 8) * 0.06
      // Dirt collects at the rim; crown stays yellow
      const k = 0.78 + t * 0.22 - grit
      colors[i * 3] = 0.89 * k
      colors[i * 3 + 1] = 0.70 * k
      colors[i * 3 + 2] = 0.06 * k
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  useLayoutEffect(() => {
    const inst = mesh.current
    if (!inst) return
    const x0 = EDGE_X - (cols - 1) * step * 0.5
    const z0 = MID_Z + LEN / 2 - step * 0.5
    let i = 0
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        dummy.position.set(x0 + c * step, 0.024, z0 - r * step)
        dummy.updateMatrix()
        inst.setMatrixAt(i, dummy.matrix)
        i += 1
      }
    }
    inst.instanceMatrix.needsUpdate = true
  }, [dummy, count, rows, cols, step])

  useLayoutEffect(() => () => dome.dispose(), [dome])

  return (
    <group>
    <mesh position={[EDGE_X, 0.012, MID_Z]}>
        <boxGeometry args={[stripW, 0.024, LEN]} />
        <meshStandardMaterial
          map={maps.yellowMap}
          roughness={0.86}
          metalness={0}
        />
    </mesh>
      <instancedMesh key={STATION_MAP_REV} ref={mesh} args={[dome, null, count]}>
        <meshStandardMaterial vertexColors roughness={0.84} metalness={0} />
      </instancedMesh>
    </group>
  )
}

export function Benches() {
  const maps = useMemo(() => {
    const wood = makeCanvasTexture(paintWood, 512, THREE.SRGBColorSpace)
    wood.anisotropy = 8
    wood.repeat.set(0.45, 2.2)
    return { wood }
  }, [])

  useLayoutEffect(() => () => {
    maps.wood.dispose()
  }, [maps])

  const len = 2.35
  const depth = 0.52
  const seatT = 0.09
  const seatTop = 0.42
  const seatY = seatTop - seatT / 2
  // Backrest sits on the armrests (overlap), not floating above a gap.
  const backH = 0.19
  const backT = 0.07
  const divHEnd = 0.2
  const divHMid = 0.175
  const backBottom = seatTop + divHEnd * 0.35
  const nDiv = 6
  const divW = 0.07
  const x = WALL_X + depth * 0.5 + 0.06
  const zs = [-3.4, -5.8]
  const oak = { map: maps.wood, roughness: 0.72, metalness: 0.02 }

  return (
    <group>
      {zs.map((z) => (
        <group key={z} position={[x, 0, z]}>
          {[1, 4].map((i) => {
            const dz = -len / 2 + (i / (nDiv - 1)) * len
            return (
              <mesh key={dz} position={[-0.05, seatY - seatT / 2 - 0.155, dz]}>
                <boxGeometry args={[depth * 0.52, 0.31, 0.09]} />
                <meshStandardMaterial {...oak} />
              </mesh>
            )
          })}
          <mesh position={[0, seatY, 0]}>
            <boxGeometry args={[depth, seatT, len]} />
            <meshStandardMaterial {...oak} />
          </mesh>
          {/* Overlap armrests in depth so the joint reads as attached. */}
          <mesh position={[-depth / 2 - backT / 2 + 0.012, backBottom + backH / 2, 0]}>
            <boxGeometry args={[backT, backH, len]} />
            <meshStandardMaterial {...oak} />
          </mesh>
          {Array.from({ length: nDiv }, (_, i) => {
            const end = i === 0 || i === nDiv - 1
            const divD = end ? depth * 0.55 : depth * 0.4
            const divH = end ? divHEnd : divHMid
            const dz = -len / 2 + (i / (nDiv - 1)) * len
            // Back face flush with seat rear / into the backrest.
            const dx = -depth / 2 + divD / 2
            return (
              <mesh key={i} position={[dx, seatTop + divH / 2, dz]}>
                <boxGeometry args={[divD, divH, divW]} />
                <meshStandardMaterial {...oak} />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

export function Stairwell({ maps }) {
  // Chambers-style: freestanding on the platform, facing camera, climbing away (−Z)
  const stepsDepth = STAIR_N * STAIR_RUN
  const topZ = STAIR_Z0 - stepsDepth
  const topY = STAIR_N * STAIR_RISE
  const railLen = Math.hypot(stepsDepth, topY)
  // Tip cylinder toward −Z as it climbs (Three +X rot tips toward +Z)
  const railPitch = -Math.atan2(stepsDepth, topY)
  const colGeom = useMemo(() => createIBeamGeometry(HEIGHT), [])
  useLayoutEffect(() => () => colGeom.dispose(), [colGeom])

  return (
    <group position={[STAIR_X, 0, 0]}>
      {/* Flanking I-beams at the base — Chambers mouth */}
      {[-1, 1].map((s) => (
        <mesh
          key={`col-${s}`}
          geometry={colGeom}
          position={[s * (STAIR_W * 0.58), HEIGHT / 2, STAIR_Z0 + 0.2]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <meshStandardMaterial color={COL.steel} roughness={0.42} metalness={0.62} />
        </mesh>
      ))}
      {/* Yellow strip at bottom landing */}
      <mesh position={[0, 0.02, STAIR_Z0 + 0.32]}>
        <boxGeometry args={[STAIR_W + 0.2, 0.04, 0.42]} />
        <meshStandardMaterial
          map={maps.yellowMap}
          roughness={0.86}
          metalness={0}
        />
      </mesh>
      {/* Steps — each further from camera and higher */}
      {Array.from({ length: STAIR_N }, (_, i) => {
        const z = STAIR_Z0 - STAIR_RUN * (i + 0.5)
        const y = STAIR_RISE * (i + 0.5)
        const isEdge = i === 0 || i === STAIR_N - 1
        return (
          <group key={i}>
            <mesh position={[0, y, z]}>
              <boxGeometry args={[STAIR_W, STAIR_RISE, STAIR_RUN * 0.96]} />
              <meshStandardMaterial color="#2e3032" roughness={0.88} metalness={0} />
            </mesh>
            {isEdge ? (
              <mesh position={[0, y + STAIR_RISE * 0.52, z + STAIR_RUN * 0.28]}>
                <boxGeometry args={[STAIR_W, 0.022, 0.055]} />
                <meshStandardMaterial
                  map={maps.yellowMap}
                  roughness={0.84}
                  metalness={0}
                />
              </mesh>
            ) : null}
          </group>
        )
      })}
      {/* Top landing + yellow nosing */}
      <mesh position={[0, topY + 0.04, topZ - 0.4]}>
        <boxGeometry args={[STAIR_W + 0.08, 0.08, 0.85]} />
        <meshStandardMaterial color="#2a2c2e" roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[0, topY + 0.09, topZ - 0.05]}>
        <boxGeometry args={[STAIR_W + 0.08, 0.025, 0.08]} />
        <meshStandardMaterial
          map={maps.yellowMap}
          roughness={0.84}
          metalness={0}
        />
      </mesh>
      {/* Dark mouth above landing — exit up */}
      <mesh position={[0, topY + 1.05, topZ - 0.95]}>
        <boxGeometry args={[STAIR_W + 0.55, 1.9, 1.15]} />
        <meshStandardMaterial
          color="#060806"
          roughness={1}
          metalness={0}
          side={THREE.BackSide}
        />
      </mesh>
      {/* Open sides: black rail frames + chrome handrails */}
      {[-1, 1].map((s) => {
        const rx = s * (STAIR_W * 0.48)
        const midZ = STAIR_Z0 - stepsDepth * 0.5
        return (
          <group key={`rail-${s}`}>
            <mesh position={[rx, topY * 0.5 + 0.72, midZ]} rotation={[railPitch, 0, 0]}>
              <cylinderGeometry args={[0.028, 0.028, railLen, 8]} />
              <meshStandardMaterial color="#1a1c1e" roughness={0.55} metalness={0.4} />
            </mesh>
            <mesh
              position={[rx - s * 0.05, topY * 0.5 + 0.92, midZ]}
              rotation={[railPitch, 0, 0]}
            >
              <cylinderGeometry args={[0.02, 0.02, railLen, 8]} />
              <meshStandardMaterial color="#c8cdd2" roughness={0.28} metalness={0.72} />
            </mesh>
            <mesh position={[rx, 0.55, STAIR_Z0 + 0.08]}>
              <cylinderGeometry args={[0.035, 0.035, 1.1, 8]} />
              <meshStandardMaterial color="#1a1c1e" roughness={0.5} metalness={0.45} />
            </mesh>
          </group>
        )
      })}
      <pointLight
        position={[0, topY + 1.35, topZ - 0.25]}
        color="#e8eef2"
        intensity={7}
        distance={7}
        decay={2}
      />
    </group>
  )
}
