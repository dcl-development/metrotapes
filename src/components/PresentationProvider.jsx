import { useCallback, useMemo, useState } from 'react'
import { hasWebGL } from '../lib/webglSupport'
import { stationEnabled } from '../lib/pageMount'
import { readPresentation, writePresentation } from '../lib/presentation'
import { PresentationContext } from '../lib/presentationContext'

export function PresentationProvider({ children }) {
  const [mode, setModeState] = useState(readPresentation)
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
