/* eslint-disable react/no-unknown-property */
import * as THREE from 'three'
import { KIOSK, applyCss3dCamera, makeRoundedBoxGeometry, makeRoundedPlaneGeometry, objectCssMatrix } from './css3d'
import { KIOSK_RADIUS_M } from '../lib/kioskSize'
import { makeCanvasTexture, paintKioskPlastic, paintKioskRough } from './textures'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useGfx } from '../lib/useGfx'
import { useLayoutEffect, useMemo, useRef } from 'react'

export function InfoKiosk({ hud, showBoot = true, pickable = false, onPick, projectHtml = true }) {
  const { settings } = useGfx()
  const { cabW, cabH, cabD, postH, postW, screenW, screenH, panelW, panelH } = KIOSK
  const yCab = postH + cabH / 2
  const screen = useRef()
  const { camera, size, gl } = useThree()
  const camDir = useMemo(() => new THREE.Vector3(), [])
  const toObj = useMemo(() => new THREE.Vector3(), [])
  const pxPerMeter = panelW / screenW
  const lastCam = useRef('')
  const lastObj = useRef('')
  const logoTex = useLoader(THREE.TextureLoader, '/mta-logo.jpg')

  useLayoutEffect(() => {
    logoTex.colorSpace = THREE.SRGBColorSpace
    logoTex.anisotropy = 4
    logoTex.needsUpdate = true
  }, [logoTex])

  // CSS-3D projection — keep transforms warm even while hidden (boot / intro).
  useFrame(() => {
    const root = hud?.current?.root
    const camEl = hud?.current?.cam
    const objEl = hud?.current?.obj
    if (!screen.current || !root || !camEl || !objEl) {
      // Overlay unmounted — drop cache so remount re-applies transforms
      lastCam.current = ''
      lastObj.current = ''
      return
    }
    camera.updateMatrixWorld()
    screen.current.updateWorldMatrix(true, false)
    camera.getWorldDirection(camDir)
    toObj.setFromMatrixPosition(screen.current.matrixWorld).sub(camera.position)
    const facing = toObj.angleTo(camDir) <= Math.PI / 2
    const camXform = applyCss3dCamera(root, camera, size, gl.domElement, camEl)
    const objXform = objectCssMatrix(screen.current.matrixWorld, pxPerMeter, panelW, panelH)
    // Remounted nodes have empty style — must write even if xform string matches last trip
    if (camXform !== lastCam.current || camEl.style.transform !== camXform) {
      lastCam.current = camXform
      camEl.style.transform = camXform
    }
    if (objXform !== lastObj.current || objEl.style.transform !== objXform) {
      lastObj.current = objXform
      objEl.style.transform = objXform
    }
    // Reveal only when projecting + facing (avoids top-left flash on remount)
    root.style.opacity = projectHtml && facing ? '1' : '0'
  })

  const faceZ = cabD / 2
  /** LCD sits behind the lip so the 3D bezel frames it (not a flush sticker). */
  const screenZ = faceZ - 0.018
  const well = 0.026
  const holeW = screenW + well * 2
  const holeH = screenH + well * 2
  const outerR = KIOSK_RADIUS_M + 0.022
  const holeR = KIOSK_RADIUS_M + 0.006
  const logoW = screenW * 0.52
  const logoH = logoW * (144 / 256)
  const cabGeo = useMemo(
    () => makeRoundedBoxGeometry(cabW, cabH, cabD, outerR, holeW, holeH, holeR),
    [cabW, cabH, cabD, outerR, holeW, holeH, holeR],
  )
  const linerGeo = useMemo(
    () => makeRoundedBoxGeometry(
      holeW - 0.003,
      holeH - 0.003,
      cabD - 0.05,
      Math.max(0.01, holeR - 0.004),
      screenW + 0.002,
      screenH + 0.002,
      KIOSK_RADIUS_M,
    ),
    [cabD, holeW, holeH, holeR, screenW, screenH],
  )
  const lipGeo = useMemo(
    () => makeRoundedBoxGeometry(
      holeW - 0.002,
      holeH - 0.002,
      0.024,
      holeR,
      screenW + 0.001,
      screenH + 0.001,
      KIOSK_RADIUS_M,
    ),
    [holeW, holeH, holeR, screenW, screenH],
  )
  const screenGeo = useMemo(
    () => makeRoundedPlaneGeometry(screenW + 0.004, screenH + 0.004, KIOSK_RADIUS_M),
    [screenW, screenH],
  )
  const plastic = useMemo(() => {
    const map = makeCanvasTexture(paintKioskPlastic, 256, THREE.SRGBColorSpace)
    const rough = makeCanvasTexture(paintKioskRough, 256, THREE.NoColorSpace)
    map.repeat.set(1.2, 2)
    rough.repeat.set(1.2, 2)
    return { map, rough }
  }, [])
  const blobTex = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62)
    g.addColorStop(0, 'rgba(0,0,0,0.62)')
    g.addColorStop(0.35, 'rgba(0,0,0,0.28)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }, [])
  useLayoutEffect(() => () => {
    cabGeo.dispose()
    linerGeo.dispose()
    lipGeo.dispose()
    screenGeo.dispose()
    plastic.map.dispose()
    plastic.rough.dispose()
    blobTex.dispose()
  }, [blobTex, cabGeo, linerGeo, lipGeo, plastic, screenGeo])

  const shell = {
    map: plastic.map,
    roughnessMap: plastic.rough,
    bumpMap: plastic.rough,
    bumpScale: 0.04,
    color: '#c2c4be',
    roughness: 0.3,
    metalness: 0.38,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
  }

  return (
    <group
      position={[KIOSK.x, 0, KIOSK.z]}
      onClick={pickable ? (e) => {
        e.stopPropagation()
        onPick?.()
      } : undefined}
      onPointerOver={pickable ? (e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      } : undefined}
      onPointerOut={pickable ? () => {
        document.body.style.cursor = 'auto'
      } : undefined}
    >
      {settings.kioskFill ? (
        <pointLight
          position={[0.15, yCab + 0.82, 0.72]}
          color="#fff1d4"
          intensity={settings.kioskFill}
          distance={5}
          decay={2}
        />
      ) : null}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0.04]} raycast={() => null}>
        <planeGeometry args={[1.2, 0.78]} />
        <meshBasicMaterial map={blobTex} transparent opacity={1} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.032, 0]}>
        <cylinderGeometry args={[0.34, 0.37, 0.064, 24]} />
        <meshPhysicalMaterial {...shell} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.22, postH / 2, 0]}>
          <cylinderGeometry args={[postW * 0.48, postW * 0.56, postH, 14]} />
          <meshPhysicalMaterial {...shell} />
        </mesh>
      ))}
      <group position={[0, yCab, 0]}>
        <mesh geometry={cabGeo}>
          <meshPhysicalMaterial {...shell} />
        </mesh>
        <mesh geometry={linerGeo}>
          <meshStandardMaterial color="#121214" roughness={0.92} metalness={0.04} />
        </mesh>
        <mesh position={[0, 0, faceZ - 0.012]} geometry={lipGeo}>
          <meshStandardMaterial color="#0c0d10" roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0, -cabD / 2 + 0.014]} geometry={screenGeo}>
          <meshBasicMaterial color="#050505" toneMapped={false} />
        </mesh>
        {showBoot ? (
          <mesh position={[0, 0, -cabD / 2 + 0.016]}>
            <planeGeometry args={[logoW, logoH]} />
            <meshBasicMaterial map={logoTex} toneMapped={false} />
          </mesh>
        ) : (
          <pointLight
            position={[0.1, 0.14, faceZ + 0.2]}
            color="#c5d6ea"
            intensity={2.6}
            distance={1.7}
            decay={2}
          />
        )}
        <object3D ref={screen} position={[0, 0, screenZ]} />
      </group>
      {pickable ? (
        <mesh position={[0, (postH + cabH) * 0.5, 0]}>
          <boxGeometry args={[cabW + 0.2, postH + cabH + 0.16, cabD + 0.22]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  )
}
