import { useMemo, useState } from 'react'
import { hasWebGL } from '../lib/webglSupport'
import { stationEnabled } from '../lib/pageMount'
import { PresentationContext } from '../lib/presentationContext'

export function PresentationProvider({ children }) {
  const [contextLost, setContextLost] = useState(false)
  const webgl = useMemo(() => hasWebGL(), [])
  const station = stationEnabled({ webgl, contextLost })
  const value = useMemo(() => ({
    mode: 'full',
    setMode: () => {},
    contextLost,
    setContextLost,
    station,
  }), [contextLost, setContextLost, station])

  return (
    <PresentationContext.Provider value={value}>
      {children}
    </PresentationContext.Provider>
  )
}
