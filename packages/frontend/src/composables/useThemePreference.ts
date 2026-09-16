import { ref, watch } from 'vue'

export type UiTheme = 'dark' | 'light'

const STORAGE_KEY = 'hsr-team-builder:ui-theme:v1'
const theme = ref<UiTheme>('dark')

const FADE_MS = 320
/** 遮罩峰值透明度：能盖住跳变又不会完全糊住页面 */
const PEAK_ALPHA = 0.72

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

/** 目标主题的半透明纱色：切浅用白纱，切深用黑纱 */
function veilColor(t: UiTheme) {
  return t === 'light' ? '255, 255, 255' : '8, 10, 18'
}

let fading = false

function playVeil(t: UiTheme) {
  if (fading || typeof document === 'undefined') return
  fading = true

  const rgb = veilColor(t)
  const veil = document.createElement('div')
  veil.className = 'theme-veil'
  veil.setAttribute('aria-hidden', 'true')
  veil.style.backgroundColor = `rgba(${rgb}, ${PEAK_ALPHA})`
  document.body.appendChild(veil)

  // 下一帧再触发淡入
  requestAnimationFrame(() => {
    veil.classList.add('is-active')
    window.setTimeout(() => {
      commitDom(t)
      veil.classList.add('is-out')
      window.setTimeout(() => {
        veil.remove()
        fading = false
      }, FADE_MS)
    }, FADE_MS)
  })
}

function applyDom(t: UiTheme, animate = false) {
  if (typeof document === 'undefined') return
  if (!animate || prefersReducedMotion()) {
    commitDom(t)
    return
  }
  playVeil(t)
}

let booted = false
let pendingAnimate = false

function ensureBooted() {
  if (booted || typeof window === 'undefined') return
  theme.value = detectInitial()
  applyDom(theme.value)
  watch(theme, (t) => {
    const animate = pendingAnimate
    pendingAnimate = false
    applyDom(t, animate)
  })
  booted = true
}

/**
 * 与 useAvatarPreference 同源的偏好模式；
 * 视觉语义来自项目内 WPF 主题切换按钮（浅/深）。
 */
export function useThemePreference() {
  ensureBooted()

  const persist = (next: UiTheme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  const setTheme = (next: UiTheme, animate = true) => {
    if (next === theme.value) return
    persist(next)
    pendingAnimate = animate
    theme.value = next
  }

  const toggleTheme = () => {
    const next: UiTheme = theme.value === 'dark' ? 'light' : 'dark'
    persist(next)
    pendingAnimate = true
    theme.value = next
  }

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: () => theme.value === 'dark',
  }
}
