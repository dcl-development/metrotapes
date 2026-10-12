import { createContext } from 'react'

export const WallSlotContext = createContext({
  slotsRef: { current: { photo: null, video: null, about: null } },
  epoch: 0,
  bindSlot: () => {},
})
