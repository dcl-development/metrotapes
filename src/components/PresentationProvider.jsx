import { useCallback, useMemo, useState } from 'react'
import { hasWebGL } from '../lib/webglSupport'
import { stationEnabled } from '../lib/pageMount'
import { writePresentation } from '../lib/presentation'
import { PresentationContext } from '../lib/presentationContext'

export function PresentationProvider({ children }) {
  // The header toggle is gone. A stored "lite" choice would leave the
  // station off with no way back. Automatic quality still lives in GfxWatch.
  const [mode, setModeState] = useState('full')
  const [contextLost, setContextLost] = useState(false)
  const webgl = useMemo(() => hasWebGL(), [])

  const setMode = useCallback((next) => {
    const stored = writePresentation(next)
    setModeState(stored)
    if (stored === 'full') setContextLost(false)
  }, [])

  const station = stationEnabled({ webgl, mode, contextLost })
  const value = useMemo(() => ({
    mode,
    setMode,
    contextLost,
    setContextLost,
    station,
  }), [mode, setMode, contextLost, setContextLost, station])

  return (
    <PresentationContext.Provider value={value}>
      {children}
    </PresentationContext.Provider>
  )
}
