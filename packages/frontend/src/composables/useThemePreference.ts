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

const THEME_ANIM_MS = 420

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function commitDom(t: UiTheme) {
  document.documentElement.setAttribute('data-theme', t)
  document.documentElement.style.colorScheme = t
}

function applyDom(t: UiTheme, animate = false) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const motionOk = animate && !prefersReducedMotion()

  if (motionOk && typeof document.startViewTransition === 'function') {
    try {
      document.startViewTransition(() => commitDom(t))
      return
    } catch {
      /* fall through to CSS class transition */
    }
  }

  if (motionOk) {
    root.classList.add('theme-animating')
    commitDom(t)
    window.setTimeout(() => {
      root.classList.remove('theme-animating')
    }, THEME_ANIM_MS)
    return
  }

  commitDom(t)
}

let booted = false

function ensureBooted() {
  if (booted || typeof window === 'undefined') return
  theme.value = detectInitial()
  // 首次应用不播过渡，避免 FOUC
  applyDom(theme.value, false)
  watch(theme, (t) => {
    applyDom(t, true)
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
