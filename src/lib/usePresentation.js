import { useContext } from 'react'
import { PresentationContext } from './presentationContext.js'

export function usePresentation() {
  const value = useContext(PresentationContext)
  if (!value) {
    return {
      mode: 'full',
      setMode: () => {},
      contextLost: false,
      setContextLost: () => {},
      station: false,
    }
  }
  return value
}
