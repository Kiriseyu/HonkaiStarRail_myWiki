import { ref, watch } from 'vue'

export type UiTheme = 'dark' | 'light'

const STORAGE_KEY = 'hsr-team-builder:ui-theme:v1'
const theme = ref<UiTheme>('dark')

function isValid(value: unknown): value is UiTheme {
  return value === 'dark' || value === 'light'
}

function readStored(): UiTheme | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return isValid(v) ? v : null
  } catch {
    return null
  }
}

function detectInitial(): UiTheme {
  const stored = readStored()
  if (stored) return stored
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return 'dark'
}

function applyDom(t: UiTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', t)
  document.documentElement.style.colorScheme = t
}

let booted = false

function ensureBooted() {
  if (booted || typeof window === 'undefined') return
  theme.value = detectInitial()
  applyDom(theme.value)
  watch(theme, (t) => {
    applyDom(t)
  })
  booted = true
}

/**
 * 与 useAvatarPreference 同源的偏好模式；
 * 视觉语义来自项目内 WPF 主题切换按钮（浅/深）。
 */
export function useThemePreference() {
  ensureBooted()

  const setTheme = (next: UiTheme) => {
    theme.value = next
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  const toggleTheme = () => {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: () => theme.value === 'dark',
  }
}
