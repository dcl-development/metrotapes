import { KioskLeaveContext } from './kioskLeaveContext'

export function KioskLeaveProvider({ value, children }) {
  return (
    <KioskLeaveContext.Provider value={value}>
      {children}
    </KioskLeaveContext.Provider>
  )
}
