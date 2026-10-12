import { useContext } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { pageMount } from '../lib/pageMount'
import { usePresentation } from '../lib/usePresentation'
import { WallSlotContext } from '../lib/wallSlotContext'

const WALL_ID = {
  '/photo': 'photo',
  '/video': 'video',
  '/about': 'about',
}

export default function PageHost({ children }) {
  const { station } = usePresentation()
  const { pathname } = useLocation()
  const { slotsRef, epoch } = useContext(WallSlotContext)
  const id = WALL_ID[pathname]
  const slot = id && epoch >= 0 ? slotsRef.current[id] : null
  const kind = pageMount({ station, pathname, slotReady: Boolean(slot) })

  if (kind === 'hidden' || kind === 'wait') return null
  if (kind === 'portal') return createPortal(children, slot)
  return children
}
