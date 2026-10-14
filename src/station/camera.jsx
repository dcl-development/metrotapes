import * as THREE from 'three'
import { KIOSK_PAN_SEC, smootherstep, stepFlight } from './cameraMotion'
import { CAM, isWallPov, resolvePov } from './space'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'

const WALL_FLY_SEC = 1.28

export function CameraRig({ pov, kioskZoom = 'close', onArrive, locked = false, busyRef }) {
  const { camera, size } = useThree()
  const look = useRef(new THREE.Vector3(...CAM.lookAt))
  const goalPos = useMemo(() => new THREE.Vector3(), [])
  const goalLook = useMemo(() => new THREE.Vector3(), [])
  const arrivedFor = useRef(null)
  const wasLocked = useRef(locked)
  const lastPov = useRef(pov)
  const flyFrom = useMemo(() => new THREE.Vector3(), [])
  const flyLookFrom = useMemo(() => new THREE.Vector3(), [])
  const flyGoal = useMemo(() => new THREE.Vector3(), [])
  const flyLookGoal = useMemo(() => new THREE.Vector3(), [])
  const flyFovFrom = useRef(CAM.fov)
  const flyFovTo = useRef(CAM.fov)
  const flyT = useRef(1)
  const flyDur = useRef(WALL_FLY_SEC)
  // Kiosk left/right only. Wall flights use the branch below and must
  // not share this flag — a wall return still has its own curve.
  const panOn = useRef(false)
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const aspect = size.width / Math.max(1, size.height)
  const aspectRef = useRef(aspect)
  const povRef = useRef(pov)
  const zoomRef = useRef(kioskZoom)
  aspectRef.current = aspect
  povRef.current = pov
  zoomRef.current = kioskZoom
  const shotId = pov === 'kiosk'
    ? `kiosk:${kioskZoom}:${aspect < 0.85 ? 'tall' : 'wide'}`
    : pov
  // Wall flights ignore kioskZoom. Resetting the curve when the parent
  // snaps zoom back to "close" on the way out was a mid-flight restart.
  const flyKey = isWallPov(pov) ? pov : `${pov}:${kioskZoom}`

  useLayoutEffect(() => {
    if (locked) return
    const shot = resolvePov(pov, aspectRef.current, kioskZoom)
    camera.position.set(...shot.position)
    look.current.set(...shot.lookAt)
    camera.fov = shot.fov
    camera.lookAt(look.current)
    camera.updateProjectionMatrix()
    // Mount only. pov/zoom are applied by the frame loop below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera])

  useLayoutEffect(() => {
    const povNow = povRef.current
    const zoomNow = zoomRef.current
    if (locked) {
      arrivedFor.current = null
      lastPov.current = povNow
      panOn.current = false
      if (busyRef) busyRef.current = false
      return
    }
    arrivedFor.current = null
    const shot = resolvePov(povNow, aspectRef.current, zoomNow)
    if (isWallPov(povNow)) {
      panOn.current = false
      flyT.current = 0
      flyDur.current = WALL_FLY_SEC
      flyFrom.copy(camera.position)
      flyLookFrom.copy(look.current)
      flyFovFrom.current = camera.fov
      // Freeze the destination for this flight. Chasing a layout that
      // shifts under the curve (header, scrollbar) is what reads as a jerk.
      flyGoal.set(...shot.position)
      flyLookGoal.set(...shot.lookAt)
      flyFovTo.current = shot.fov
      if (busyRef) busyRef.current = true
      return
    }
    // Side shots and the return to the close-up. A wall→kiosk return
    // keeps the existing curve (lastPov is still the wall here).
    const kioskPan = povNow === 'kiosk' && !isWallPov(lastPov.current)
    if (!kioskPan) {
      panOn.current = false
      return
    }
    flyGoal.set(...shot.position)
    flyLookGoal.set(...shot.lookAt)
    const already = camera.position.distanceTo(flyGoal) < 0.08
      && look.current.distanceTo(flyLookGoal) < 0.08
      && Math.abs(camera.fov - shot.fov) < 0.4
    // Mount and the intro handoff are already on the shot. Starting a
    // pan there would replay 0.75s of nothing before the kiosk arrives.
    if (already) {
      panOn.current = false
      return
    }
    flyT.current = 0
    flyDur.current = KIOSK_PAN_SEC
    flyFrom.copy(camera.position)
    flyLookFrom.copy(look.current)
    flyFovFrom.current = camera.fov
    flyFovTo.current = shot.fov
    panOn.current = true
    if (busyRef) busyRef.current = true
  }, [flyKey, locked, camera, flyFrom, flyLookFrom, flyGoal, flyLookGoal, busyRef])

  useLayoutEffect(() => {
    if (locked) return
    arrivedFor.current = null
  }, [size.width, size.height, locked])

  useFrame((_, dt) => {
    if (locked) {
      wasLocked.current = true
      panOn.current = false
      if (busyRef) busyRef.current = false
      return
    }

    const shot = resolvePov(pov, aspect, kioskZoom)
    const d = Math.min(dt, 0.05)
    const fromWall = pov === 'kiosk' && isWallPov(lastPov.current)

    // Already settled on this POV — freeze so the CSS kiosk overlay
    // isn't rewritten every frame (that breaks button hit-testing).
    if (arrivedFor.current === shotId) {
      if (busyRef) busyRef.current = false
      return
    }
    if (busyRef) busyRef.current = true

    // Intro handoff — seed look so nothing pops
    if (wasLocked.current) {
      look.current.set(...shot.lookAt)
      wasLocked.current = false
    }

    goalPos.set(...shot.position)
    goalLook.set(...shot.lookAt)

    const settle = (fov = shot.fov) => {
      camera.position.copy(goalPos)
      look.current.copy(goalLook)
      camera.fov = fov
      camera.lookAt(look.current)
      camera.updateProjectionMatrix()
      arrivedFor.current = shotId
      lastPov.current = pov
      panOn.current = false
      if (busyRef) busyRef.current = false
      onArrive?.(pov)
    }

    if (reducedMotion) {
      settle()
      return
    }

    if (isWallPov(pov)) {
      // Keep the ease on the clock. Clamping a hitch to 50ms made the
      // shot fall behind, then catch up as a jerk on the next frames.
      flyT.current = stepFlight(flyT.current, dt, WALL_FLY_SEC)
      const u = smootherstep(flyT.current)
      camera.position.lerpVectors(flyFrom, flyGoal, u)
      look.current.lerpVectors(flyLookFrom, flyLookGoal, u)
      camera.fov = THREE.MathUtils.lerp(flyFovFrom.current, flyFovTo.current, u)
      camera.lookAt(look.current)
      camera.updateProjectionMatrix()
      if (flyT.current >= 1) settle()
      return
    }

    if (panOn.current) {
      // Frozen start and end. t = 1 is the goal, so the last frame is
      // the end of the ease, not a snap from a leftover distance.
      flyT.current = stepFlight(flyT.current, dt, flyDur.current)
      const u = smootherstep(flyT.current)
      camera.position.lerpVectors(flyFrom, flyGoal, u)
      look.current.lerpVectors(flyLookFrom, flyLookGoal, u)
      camera.fov = THREE.MathUtils.lerp(flyFovFrom.current, flyFovTo.current, u)
      camera.lookAt(look.current)
      camera.updateProjectionMatrix()
      if (flyT.current >= 1) {
        goalPos.copy(flyGoal)
        goalLook.copy(flyLookGoal)
        settle(flyFovTo.current)
      }
      return
    }

    let k = 1 - Math.exp(-(shot.ease ?? 1.25) * d)
    if (fromWall) {
      const rem = camera.position.distanceTo(goalPos)
      const cruise = 0.017
      const finish = 0.055
      const t = 1 - THREE.MathUtils.smoothstep(rem, 0.55, 2.4)
      k = Math.max(k, THREE.MathUtils.lerp(cruise, finish, t))
    }
    camera.position.lerp(goalPos, k)
    look.current.lerp(goalLook, k)
    camera.fov = THREE.MathUtils.lerp(camera.fov, shot.fov, k)
    camera.lookAt(look.current)
    camera.updateProjectionMatrix()

    const closeDist = fromWall ? 0.12 : 0.08
    const closeLook = fromWall ? 0.14 : 0.08
    const closeFov = fromWall ? 0.7 : 0.4
    const close = camera.position.distanceTo(goalPos) < closeDist
      && look.current.distanceTo(goalLook) < closeLook
      && Math.abs(camera.fov - shot.fov) < closeFov
    if (close) settle()
  })

  return null
}
