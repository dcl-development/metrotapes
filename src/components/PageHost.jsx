import { useLocation } from 'react-router-dom'
import { pageMount } from '../lib/pageMount'
import { usePresentation } from '../lib/usePresentation'

/** Flat document host. Station routes render inside the scene instead. */
export default function PageHost({ children }) {
  const { station } = usePresentation()
  const { pathname } = useLocation()
  const kind = pageMount({ station, pathname })
  if (kind === 'hidden' || kind === 'station') return null
  return children
}
