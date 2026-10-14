import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as THREE from 'three'
import {
  KIOSK,
  css3dLayerLive,
  css3dProject,
} from './css3d.js'
import { WALL_BOARD_Z0, WALL_X, POVS } from './space.js'
import { layoutWallFace, setWallFace } from '../lib/wallSize.js'

function placeCamera(shot, width, height) {
  const camera = new THREE.PerspectiveCamera(shot.fov, width / height, 0.1, 90)
  camera.position.set(...shot.position)
  camera.lookAt(...shot.lookAt)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return camera
}

function kioskScreen() {
  const screen = new THREE.Object3D()
  const group = new THREE.Group()
  group.position.set(KIOSK.x, 0, KIOSK.z)
  const cab = new THREE.Group()
  cab.position.set(0, KIOSK.postH + KIOSK.cabH / 2, 0)
  group.add(cab)
  cab.add(screen)
  screen.position.set(0, 0, KIOSK.cabD / 2 - 0.018)
  group.updateMatrixWorld(true)
  return screen
}

function photoBoard(face) {
  const screen = new THREE.Object3D()
  const y = face.boardY + face.contentY
  screen.position.set(WALL_X + 0.04 + 0.038 + 0.004, y, WALL_BOARD_Z0)
  screen.rotation.y = Math.PI / 2
  screen.updateMatrixWorld(true)
  return screen
}

describe('css3d projection', () => {
  it('keeps the kiosk LCD well in front of the clip plane and on the WebGL quad', () => {
    const width = 1440
    const height = 900
    const camera = placeCamera(POVS.kiosk, width, height)
    const screen = kioskScreen()
    const proj = css3dProject(
      screen.matrixWorld,
      camera,
      width,
      height,
      KIOSK.panelW / KIOSK.screenW,
      KIOSK.panelW,
      KIOSK.panelH,
    )
    assert.ok(proj)
    assert.ok(proj.minW > 0.8, `minW ${proj.minW}`)
    const gl = [
      [-KIOSK.screenW / 2, KIOSK.screenH / 2],
      [KIOSK.screenW / 2, KIOSK.screenH / 2],
      [-KIOSK.screenW / 2, -KIOSK.screenH / 2],
      [KIOSK.screenW / 2, -KIOSK.screenH / 2],
    ].map(([x, y]) => screen.localToWorld(new THREE.Vector3(x, y, 0)).project(camera))
    proj.ndc.forEach((p, i) => {
      const err = Math.hypot(p.x - gl[i].x, p.y - gl[i].y)
      assert.ok(err < 0.02, `corner ${i} err ${err}`)
    })
    assert.equal(css3dLayerLive(
      screen.matrixWorld,
      camera,
      { width, height },
      KIOSK.panelW / KIOSK.screenW,
      KIOSK.panelW,
      KIOSK.panelH,
    ), true)
  })

  it('keeps the phone kiosk on screen', () => {
    const width = 390
    const height = 700
    const camera = placeCamera(POVS.kioskMobile, width, height)
    const screen = kioskScreen()
    const proj = css3dProject(
      screen.matrixWorld,
      camera,
      width,
      height,
      KIOSK.panelW / KIOSK.screenW,
      KIOSK.panelW,
      KIOSK.panelH,
    )
    assert.ok(proj.minW > 0.5, `minW ${proj.minW}`)
    assert.equal(css3dLayerLive(
      screen.matrixWorld,
      camera,
      { width, height },
      KIOSK.panelW / KIOSK.screenW,
      KIOSK.panelW,
      KIOSK.panelH,
    ), true)
  })

  it('does not composite a wall quad that crosses the camera plane', () => {
    const width = 1440
    const height = 900
    const face = setWallFace(layoutWallFace(width, height - 64))
    const camera = placeCamera(POVS.kiosk, width, height)
    const board = photoBoard(face)
    const px = face.panelW / face.contentW
    const proj = css3dProject(
      board.matrixWorld,
      camera,
      width,
      height,
      px,
      face.panelW,
      face.panelH,
    )
    assert.ok(proj.minW < 0.2, `expected the near corner to graze the plane, minW ${proj.minW}`)
    assert.equal(css3dLayerLive(
      board.matrixWorld,
      camera,
      { width, height },
      px,
      face.panelW,
      face.panelH,
    ), false)
  })

  it('shows the photo board once the camera looks at the wall', () => {
    const width = 1440
    const height = 900
    const face = setWallFace(layoutWallFace(width, height - 64))
    const camera = placeCamera(POVS.kioskWideLeft, width, height)
    const board = photoBoard(face)
    const px = face.panelW / face.contentW
    const proj = css3dProject(
      board.matrixWorld,
      camera,
      width,
      height,
      px,
      face.panelW,
      face.panelH,
    )
    assert.ok(proj.minW > 0.4, `minW ${proj.minW}`)
    assert.equal(css3dLayerLive(
      board.matrixWorld,
      camera,
      { width, height },
      px,
      face.panelW,
      face.panelH,
    ), true)
  })
})
