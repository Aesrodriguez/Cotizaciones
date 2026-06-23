import { create } from 'zustand'

type Status = 'online' | 'reconnecting' | 'offline'

interface ConnectionStore {
  status: Status
  setOnline: () => void
  setReconnecting: () => void
  setOffline: () => void
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: 'online',
  setOnline: () => set({ status: 'online' }),
  setReconnecting: () => set({ status: 'reconnecting' }),
  setOffline: () => set({ status: 'offline' }),
}))
