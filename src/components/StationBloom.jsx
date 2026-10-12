import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BloomEffect, EffectComposer, EffectPass, FXAAEffect, RenderPass } from 'postprocessing'
import * as THREE from 'three'
import { composerBufferStale } from '../lib/stationFrame'

/** Bloom + FXAA. Loaded only while the high tier is active. */
export default function StationBloom() {
  const { gl, scene, camera } = useThree()
  const drawingSize = useMemo(() => new THREE.Vector2(), [])
  const cssSize = useMemo(() => new THREE.Vector2(), [])
  const sized = useRef('')
  const composer = useMemo(() => {
    const next = new EffectComposer(gl, {
      multisampling: 0,
      frameBufferType: THREE.HalfFloatType,
    })
    next.addPass(new RenderPass(scene, camera))
    next.addPass(new EffectPass(camera, new BloomEffect({
      intensity: 1.35,
      luminanceThreshold: 0.72,
      luminanceSmoothing: 0.42,
      mipmapBlur: true,
    })))
    next.addPass(new EffectPass(camera, new FXAAEffect()))
    return next
  }, [camera, gl, scene])

  useEffect(() => () => {
    composer.dispose()
    // EffectComposer turns autoClear off and does not put it back.
    // After a tier drop the default renderer would smear the last frame,
    // including whatever was left in the lower half of a stale target.
    gl.autoClear = true
    gl.setRenderTarget(null)
  }, [composer, gl])

  useFrame((_, delta) => {
    // Sync from the drawing buffer, not CSS size alone. A DPR soften keeps
    // CSS pixels and leaves bloom targets at the previous height — the pass
    // then paints the top of that target and the lower canvas stays stale.
    // updateStyle false: do not fight R3F for the canvas CSS size.
    const drawing = gl.getDrawingBufferSize(drawingSize)
    const key = `${drawing.x}x${drawing.y}`
    if (sized.current !== key) {
      if (drawing.x > 0 && drawing.y > 0 && composerBufferStale(
        composer.inputBuffer.width,
        composer.inputBuffer.height,
        drawing.x,
        drawing.y,
      )) {
        const css = gl.getSize(cssSize)
        composer.setSize(css.x, css.y, false)
      }
      sized.current = key
    }
    composer.render(delta)
  }, 1)

  return null
}
