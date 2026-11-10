import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { readStorage, writeStorage } from '@/lib/storage'

export type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'edupath.theme'

interface ThemeValue {
  theme: Theme
  resolved: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

function readTheme(): Theme {
  const saved = readStorage(STORAGE_KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

const media = () => window.matchMedia?.('(prefers-color-scheme: dark)')

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme)
  const [systemDark, setSystemDark] = useState(() => media()?.matches ?? false)

  useEffect(() => {
    const query = media()
    if (!query) return
    const listener = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    writeStorage(STORAGE_KEY, next)
  }, [])

  const toggle = useCallback(() => setTheme(resolved === 'dark' ? 'light' : 'dark'), [resolved, setTheme])

  return <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
