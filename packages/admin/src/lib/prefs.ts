import { useCallback, useState, useSyncExternalStore } from 'react'

/** Per-browser preferences. Storage can be unavailable (private mode), so every access is guarded. */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

export function usePref<T extends string>(key: string, fallback: T): [T, (value: T) => void] {
  // Keyed by `key` too: when it changes (another page or device), the value is read again.
  const [state, setState] = useState<{ key: string; value: T }>(() => ({
    key,
    value: (read(key) as T | null) ?? fallback,
  }))
  const value = state.key === key ? state.value : ((read(key) as T | null) ?? fallback)
  const update = useCallback(
    (next: T) => {
      setState({ key, value: next })
      write(key, next)
    },
    [key],
  )
  return [value, update]
}

export type Theme = 'light' | 'dark' | 'system'

// One theme for the whole app: a tiny shared store so every control reflects the same value.
let theme: Theme = (read('mz-theme') as Theme | null) ?? 'system'
const themeListeners = new Set<() => void>()
const media = matchMedia('(prefers-color-scheme: dark)')
const applyTheme = () =>
  document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches))
media.addEventListener('change', applyTheme)

function setTheme(next: Theme) {
  theme = next
  write('mz-theme', next)
  applyTheme()
  for (const l of themeListeners) l()
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      themeListeners.add(cb)
      return () => themeListeners.delete(cb)
    },
    () => theme,
  )
  return [value, setTheme]
}
