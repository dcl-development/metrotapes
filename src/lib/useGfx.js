import { useContext } from 'react'
import { GFX } from './gfxDetect.js'
import { GfxContext } from './gfxContext.js'

export function useGfx() {
  const value = useContext(GfxContext)
  if (!value) {
    return {
      tier: 'mid',
      ceiling: 'mid',
      settings: GFX.mid,
      startSettings: GFX.mid,
      soften: () => {},
      drop: () => {},
      promote: () => {},
      finishWarm: () => {},
      canSoften: false,
      canDrop: false,
      canPromote: false,
      warmCorrectable: false,
      locked: false,
    }
  }
  return value
}
