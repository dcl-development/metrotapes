import { useContext } from 'react'
import { KioskLeaveContext } from './kioskLeaveContext'

/** Returns tryLeave / goHome for header + kiosk nav. */
export function useKioskLeave() {
  return useContext(KioskLeaveContext)
}
