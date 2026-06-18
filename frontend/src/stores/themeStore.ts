import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeStore {
  theme: 'dark' | 'light'
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: next })
        document.documentElement.setAttribute('data-theme', next)
      },
    }),
    { name: 'triplaa-theme' }
  )
)

// Apply saved theme immediately on module load
const saved = localStorage.getItem('triplaa-theme')
try {
  const parsed = JSON.parse(saved ?? '{}')
  const t = parsed?.state?.theme ?? 'dark'
  document.documentElement.setAttribute('data-theme', t)
} catch {
  document.documentElement.setAttribute('data-theme', 'dark')
}
