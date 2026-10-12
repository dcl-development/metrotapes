/* eslint-disable react/no-unknown-property */
import * as THREE from 'three'
import { STAIR_N, STAIR_RUN, STAIR_X, STAIR_Z0, WALL_X, isWallPov } from './space'
import { WALL_BEZEL, getWallFace } from '../lib/wallSize'
import { applyCss3dCamera, isIOSWebKit, objectCssMatrix } from './css3d'
import { lumaAsAlpha, makeLabelTexture, paintExitSign } from './textures'
import { haloTexture } from './glow'
import { makeBoardLabel, wallBoardList } from './boards'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useGfx } from '../lib/useGfx'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'

export function Signage({ locked = false }) {
  const { settings } = useGfx()
  const [metal, arrowTex] = useLoader(THREE.TextureLoader, [
    '/subwaysign.jpg',
    '/subway-arrow-down.png',
  ])
  const [maps, setMaps] = useState(null)

  useLayoutEffect(() => {
    const arrowImg = arrowTex.image ? lumaAsAlpha(arrowTex.image) : null
    const exitMap = makeLabelTexture(
      (ctx, w, h) => paintExitSign(ctx, w, h, metal.image, arrowImg),
      2000,
      400,
    )
    const bodyMap = metal.clone()
    bodyMap.wrapS = THREE.RepeatWrapping
    bodyMap.wrapT = THREE.RepeatWrapping
    bodyMap.repeat.set(2.4, 0.55)
    bodyMap.colorSpace = THREE.SRGBColorSpace
    bodyMap.anisotropy = 8
    bodyMap.needsUpdate = true
    setMaps({ exitMap, bodyMap })
    return () => {
    exitMap.dispose()
    bodyMap.dispose()
    }
  }, [metal, arrowTex])

  const signW = 2.02
  const signH = 0.41
  const rodH = 0.64
  const unit = useRef()
  const hoverAmt = useRef(0)
  const hovering = useRef(false)
  const kickZ = useRef(0)
  const kickVZ = useRef(0)
  const kickX = useRef(0)
  const kickVX = useRef(0)
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const kickDirZ = useRef(1)
  const kickDirX = useRef(-1)

  useFrame((state, dt) => {
    if (!unit.current) return
    const d = Math.min(dt, 0.05)
    const t = state.clock.elapsedTime
    const want = hovering.current && !locked && !reducedMotion
    hoverAmt.current = THREE.MathUtils.lerp(hoverAmt.current, want ? 1 : 0, 1 - Math.exp(-10 * d))
    const h = hoverAmt.current

    kickVZ.current += -kickZ.current * 52 * d
    kickVZ.current *= Math.exp(-8.5 * d)
    kickZ.current = THREE.MathUtils.clamp(kickZ.current + kickVZ.current * d, -0.045, 0.045)
    kickVX.current += -kickX.current * 48 * d
    kickVX.current *= Math.exp(-8.2 * d)
    kickX.current = THREE.MathUtils.clamp(kickX.current + kickVX.current * d, -0.04, 0.04)

    const live = !locked && !reducedMotion
    const sway = live ? 1 : 0
    const s = 1 + h * 0.035
    unit.current.scale.set(s, s, s)
    unit.current.rotation.z = Math.sin(t * 1.15) * 0.012 * sway + kickZ.current
    unit.current.rotation.x = Math.sin(t * 0.88) * 0.011 * sway + kickX.current
  })

  const onHit = (event) => {
    event.stopPropagation()
    if (locked || reducedMotion) return
    kickDirZ.current *= -1
    kickDirX.current *= Math.random() > 0.3 ? -1 : 1
    kickVZ.current += kickDirZ.current * (0.65 + Math.random() * 0.45)
    kickVX.current += kickDirX.current * (0.6 + Math.random() * 0.5)
  }

  return (
    <group position={[STAIR_X, 2.95, STAIR_Z0 - STAIR_N * STAIR_RUN * 0.28]} rotation={[0, 0.04, 0]}>
      {/* Ceiling pivot — rods and board are one rigid piece under this */}
      <group
        ref={unit}
        onClick={onHit}
        onPointerOver={(e) => {
          e.stopPropagation()
          if (locked) return
          hovering.current = true
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          hovering.current = false
          document.body.style.cursor = 'auto'
        }}
      >
        {[-signW * 0.3, signW * 0.3].map((x) => (
          <mesh key={x} position={[x, -rodH / 2, 0]}>
            <cylinderGeometry args={[0.01, 0.01, rodH, 8]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.55} metalness={0.35} />
          </mesh>
        ))}
        <group position={[0, -rodH - signH / 2, 0]}>
          {maps ? (
            <>
              <mesh position={[0, 0, -0.016]} frustumCulled={false}>
            <boxGeometry args={[signW, signH, 0.032]} />
            <meshStandardMaterial
                  map={maps.bodyMap}
              color="#9a9a9a"
              roughness={0.52}
              metalness={0.12}
            />
          </mesh>
              <mesh position={[0, 0, 0.011]} frustumCulled={false}>
            <planeGeometry args={[signW - 0.02, signH - 0.016]} />
                <meshBasicMaterial map={maps.exitMap} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
              {settings.cheapGlow ? (
                <mesh position={[0, 0, 0.02]} frustumCulled={false} raycast={() => null}>
                  <planeGeometry args={[signW * 1.45, signH * 2.4]} />
                  <meshBasicMaterial
                    map={haloTexture()}
                    color="#ff2a3a"
                    transparent
                    opacity={0.55}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    toneMapped={false}
                  />
                </mesh>
              ) : null}
            </>
          ) : (
            <mesh frustumCulled={false}>
              <boxGeometry args={[signW, signH, 0.032]} />
              <meshStandardMaterial color="#888888" roughness={0.55} metalness={0.1} />
            </mesh>
          )}
          <mesh>
            <boxGeometry args={[signW * 1.05, signH * 1.15, 0.08]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export function WallBoards({ wall, wallHuds, immersed = false, immersedId = null, onSelect, invite = false, projectHtml = true, busyRef }) {
  const { tier, settings, startSettings } = useGfx()
  const face = wall || getWallFace()
  const boards = wallBoardList()
  const labels = useMemo(() => {
    const w = startSettings.labelPx ?? 512
    const h = Math.max(96, Math.round(w * 96 / 512))
    const aniso = startSettings.aniso ?? 4
    return Object.fromEntries(
      wallBoardList().map((b) => [b.id, makeBoardLabel(b.title, b.accent, w, h, aniso)]),
    )
  }, [startSettings])
  const screens = useRef({})
  const glowMats = useRef({})
  const glowLights = useRef({})
  const inviteRef = useRef(invite)
  inviteRef.current = invite
  const { camera, size, scene, gl } = useThree()
  const camDir = useMemo(() => new THREE.Vector3(), [])
  const toObj = useMemo(() => new THREE.Vector3(), [])
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const lastCam = useRef('')
  const lastObj = useRef({ photo: '', video: '', about: '' })
  const shown = useRef({})
  const lastRayAt = useRef(0)
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useLayoutEffect(() => () => {
    Object.values(labels).forEach((t) => t.dispose())
  }, [labels])

  useFrame((state) => {
    const liveBoards = wallBoardList()
    const pulse = inviteRef.current && !reducedMotion && !immersed
      ? 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 1.2)
      : 0
    liveBoards.forEach((b) => {
      const mat = glowMats.current[b.id]
      const rest = settings.cheapGlow ? 0.16 : 0
      if (mat) mat.opacity = pulse ? Math.max(rest, 0.05 + pulse * 0.14) : rest
      const light = glowLights.current[b.id]
      if (light) light.intensity = pulse ? 0.12 + pulse * 0.28 : 0
    })

    const { panelW, panelH, contentW } = getWallFace()
    const pxPerMeter = panelW / contentW
    const root = wallHuds?.current?.root || document.querySelector('[data-wall-hud="root"]')
    const camEl = wallHuds?.current?.cam || document.querySelector('[data-wall-hud="cam"]')
    if (!root || !camEl) return

    if (!projectHtml && !(immersed && isWallPov(immersedId))) {
      // Still drive CSS-3D so transforms are warm before intro ends — stay invisible.
      camera.updateMatrixWorld()
      const camXform = applyCss3dCamera(root, camera, size, gl.domElement, camEl)
      if (camXform !== lastCam.current || camEl.style.transform !== camXform) {
        lastCam.current = camXform
        camEl.style.transform = camXform
      }
      liveBoards.forEach((b) => {
        const objEl = wallHuds.current.obj?.[b.id] || document.querySelector(`[data-wall-hud="obj-${b.id}"]`)
        const mesh = screens.current[b.id]
        if (!objEl || !mesh) return
        mesh.updateWorldMatrix(true, false)
        const objXform = objectCssMatrix(mesh.matrixWorld, pxPerMeter, panelW, panelH)
        if (objXform !== lastObj.current[b.id] || objEl.style.transform !== objXform) {
          lastObj.current[b.id] = objXform
          objEl.style.transform = objXform
        }
        objEl.style.visibility = 'hidden'
      })
      root.style.opacity = '0'
      return
    }

    if (immersed && isWallPov(immersedId)) {
      root.style.opacity = '1'
      root.style.perspective = 'none'
      root.style.perspectiveOrigin = '50% 50%'
      root.style.position = 'absolute'
      root.style.top = '0px'
      root.style.left = '0px'
      root.style.width = `${size.width}px`
      root.style.height = `${size.height}px`
      camEl.style.transform = 'none'
      camEl.style.transformOrigin = '50% 50%'
      lastCam.current = ''
      liveBoards.forEach((b) => {
        const objEl = wallHuds.current.obj?.[b.id] || document.querySelector(`[data-wall-hud="obj-${b.id}"]`)
        if (!objEl) return
        if (b.id === immersedId) {
          objEl.style.transform = 'none'
          objEl.style.visibility = 'visible'
          lastObj.current[b.id] = ''
        } else {
          objEl.style.visibility = 'hidden'
        }
      })
      return
    }

    camera.updateMatrixWorld()
    camera.getWorldDirection(camDir)

    const moving = Boolean(busyRef?.current)
    const now = state.clock.elapsedTime
    // Recursive raycasts against the kiosk bevels are the expensive part of
    // a wall flight. Skip them while the camera is moving, and on low tier
    // don't repeat them every frame once the shot is still.
    const runRays = !moving && (tier !== 'low' || now - lastRayAt.current >= 0.25)
    if (runRays) lastRayAt.current = now

    const camXform = applyCss3dCamera(root, camera, size, gl.domElement, camEl)
    if (camXform !== lastCam.current || camEl.style.transform !== camXform) {
      lastCam.current = camXform
      camEl.style.transform = camXform
    }

    let closestId = null
    let closestDist = Infinity
    const facing = []
    liveBoards.forEach((b) => {
      const objEl = wallHuds.current.obj?.[b.id] || document.querySelector(`[data-wall-hud="obj-${b.id}"]`)
      const mesh = screens.current[b.id]
      if (!objEl || !mesh) return

      mesh.updateWorldMatrix(true, false)
      toObj.setFromMatrixPosition(mesh.matrixWorld).sub(camera.position)
      const dist = toObj.length()
      const seen = toObj.angleTo(camDir) <= Math.PI / 2
      facing.push({ b, objEl, mesh, dist, seen })
      if (seen && dist < closestDist) {
        closestDist = dist
        closestId = b.id
      }
    })

    const closeup = closestDist < 2.2
    const kiosk = scene.getObjectByName('kiosk-occlude')
    const pillars = scene.getObjectByName('pillar-occlude')
    let anyFacing = false
    facing.forEach(({ b, objEl, mesh, dist, seen }) => {
      let show = seen && (!closeup || b.id === closestId)
      if (moving && shown.current[b.id] != null) {
        show = Boolean(shown.current[b.id]) && seen
      } else if (show && dist > 0.2 && runRays) {
        toObj.setFromMatrixPosition(mesh.matrixWorld).sub(camera.position)
        ray.set(camera.position, toObj.normalize())
        ray.far = dist - 0.1
        const hitKiosk = dist < 3.6 && kiosk && ray.intersectObject(kiosk, true).length
        const hitPillar = pillars && ray.intersectObject(pillars, true).length
        if (hitKiosk || hitPillar) show = false
      } else if (!runRays && shown.current[b.id] === false) {
        show = false
      }
      shown.current[b.id] = show
      if (!show) {
        objEl.style.visibility = 'hidden'
        return
      }

      const objXform = objectCssMatrix(mesh.matrixWorld, pxPerMeter, panelW, panelH)
      if (objXform !== lastObj.current[b.id] || objEl.style.transform !== objXform) {
        lastObj.current[b.id] = objXform
        objEl.style.transform = objXform
      }
      objEl.style.visibility = 'visible'
      anyFacing = true
    })
    root.style.opacity = anyFacing ? '1' : '0'
  })

  const x = WALL_X + 0.04
  const faceX = 0.035
  const contentX = 0.038
  const lip = WALL_BEZEL
  const frameD = 0.032
  const chrome = { color: '#e8ebef', roughness: 0.2, metalness: 0.86 }
  const { boardW, boardH, boardY, contentW, contentH, contentY, titleY, titleH } = face
  const y = Number.isFinite(boardY) ? boardY : 1.72
  // iOS residual: HTML sits high in the chrome hole. Move the 3D anchor down only —
  // do not touch CSS perspective / transform-origin (that blanks overlays).
  const screenY = y + contentY + (isIOSWebKit() ? -titleH * 1.15 : 0)

  return (
    <group>
      {boards.map((b) => (
        <group key={`${b.id}-${boardW.toFixed(2)}-${boardH.toFixed(2)}-${y.toFixed(2)}`} position={[x, y, b.z]}>
          <mesh position={[0.018, (boardH + lip) / 2, 0]}>
            <boxGeometry args={[frameD, lip, boardW + lip * 2]} />
            <meshStandardMaterial {...chrome} />
          </mesh>
          <mesh position={[0.018, -(boardH + lip) / 2, 0]}>
            <boxGeometry args={[frameD, lip, boardW + lip * 2]} />
            <meshStandardMaterial {...chrome} />
          </mesh>
          <mesh position={[0.018, 0, (boardW + lip) / 2]}>
            <boxGeometry args={[frameD, boardH, lip]} />
            <meshStandardMaterial {...chrome} />
          </mesh>
          <mesh position={[0.018, 0, -(boardW + lip) / 2]}>
            <boxGeometry args={[frameD, boardH, lip]} />
            <meshStandardMaterial {...chrome} />
          </mesh>
          <mesh position={[faceX, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[boardW + lip * 0.6, boardH + lip * 0.6]} />
            <meshBasicMaterial color="#0c0e10" toneMapped={false} />
          </mesh>
          <pointLight
            ref={(n) => { glowLights.current[b.id] = n }}
            position={[0.28, 0, 0]}
            color={b.accent}
            intensity={0}
            distance={2.6}
            decay={2}
          />
          <mesh position={[faceX + 0.012, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[boardW + 0.12, boardH + 0.12]} />
            <meshBasicMaterial
              ref={(n) => { glowMats.current[b.id] = n }}
              color={b.accent}
              transparent
              opacity={settings.cheapGlow ? 0.16 : 0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[faceX + 0.002, titleY, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[boardW + lip * 0.4, titleH]} />
            <meshBasicMaterial map={labels[b.id]} toneMapped={false} />
          </mesh>
          <mesh
            position={[contentX, contentY, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[contentW, contentH]} />
            <meshBasicMaterial color="#0c0e10" toneMapped={false} />
          </mesh>
          {immersed ? null : (
            <mesh
              position={[contentX + 0.02, 0, 0]}
              rotation={[0, Math.PI / 2, 0]}
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.(b.id)
              }}
              onPointerOver={(e) => {
                e.stopPropagation()
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto'
              }}
            >
              <planeGeometry args={[boardW, boardH]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          )}
        </group>
      ))}
      {boards.map((b) => (
        <object3D
          key={`${b.id}-screen`}
          ref={(n) => { screens.current[b.id] = n }}
          position={[x + contentX + 0.004, screenY, b.z]}
          rotation={[0, Math.PI / 2, 0]}
        />
      ))}
    </group>
  )
}
