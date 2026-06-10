import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Usuario } from '../types'

interface AuthState {
  user: Usuario | null
  token: string | null
  refreshToken: string | null
  setAuth: (user: Usuario, token: string, refreshToken?: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      setAuth: (user, token, refreshToken) =>
        set((s) => ({ user, token, refreshToken: refreshToken ?? s.refreshToken })),
      logout: () => set({ user: null, token: null, refreshToken: null }),
    }),
    { name: 'auth-triplaa' },
  ),
)
