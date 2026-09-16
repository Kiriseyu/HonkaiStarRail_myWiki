import { ref, watch } from 'vue'

export type UiTheme = 'dark' | 'light'

const STORAGE_KEY = 'hsr-team-builder:ui-theme:v1'
const theme = ref<UiTheme>('dark')

const WIPE_MS = 480

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

function wipeRadius(x: number, y: number) {
  const w = window.innerWidth
  const h = window.innerHeight
  return Math.ceil(
    Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y)),
  )
}

function originFromEvent(e?: MouseEvent | TouchEvent | { clientX: number; clientY: number }) {
  if (!e || typeof window === 'undefined') {
    return { x: window.innerWidth / 2, y: window.innerHeight * 0.16 }
  }
  if ('changedTouches' in e && e.changedTouches?.[0]) {
    const t = e.changedTouches[0]
    return { x: t.clientX, y: t.clientY }
  }
  const ev = e as MouseEvent
  if (typeof ev.clientX === 'number' && typeof ev.clientY === 'number' && (ev.clientX || ev.clientY)) {
    return { x: ev.clientX, y: ev.clientY }
  }
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.16 }
}

let wiping = false

/**
 * 用圆形遮罩从按钮扩满屏幕；盖住后再提交主题。
 * 过渡期间不换 CSS 主题，避免两套布局叠影/位移。
 */
function playWipeOverlay(t: UiTheme, x: number, y: number) {
  if (wiping) return
  wiping = true

  const size = wipeRadius(x, y) * 2 + 40
  const color = t === 'light' ? '#eef3f9' : '#0f0f23'
  const layer = document.createElement('div')
  layer.className = 'theme-wipe-overlay'
  layer.setAttribute('aria-hidden', 'true')
  layer.style.left = `${x}px`
  layer.style.top = `${y}px`
  layer.style.background = color
  layer.style.setProperty('--theme-wipe-size', `${size}px`)
  document.body.appendChild(layer)

  void layer.offsetWidth
  layer.classList.add('is-active')

  window.setTimeout(() => {
    commitDom(t)
    // 盖住后立刻再淡出一层，避免色块硬切
    layer.style.transition = 'opacity 0.16s ease'
    layer.style.opacity = '0'
    window.setTimeout(() => {
      layer.remove()
      wiping = false
    }, 170)
  }, WIPE_MS)
}

function applyDom(t: UiTheme, origin?: { x: number; y: number }) {
  if (typeof document === 'undefined') return

  if (!origin || prefersReducedMotion()) {
    commitDom(t)
    return
  }

  playWipeOverlay(t, origin.x, origin.y)
}

let booted = false
let pendingOrigin: { x: number; y: number } | null = null

function ensureBooted() {
  if (booted || typeof window === 'undefined') return
  theme.value = detectInitial()
  applyDom(theme.value)
  watch(theme, (t) => {
    const origin = pendingOrigin ?? originFromEvent()
    pendingOrigin = null
    applyDom(t, origin)
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

  const setTheme = (next: UiTheme, origin?: { x: number; y: number }) => {
    if (next === theme.value) return
    persist(next)
    pendingOrigin = origin ?? null
    theme.value = next
  }

  const toggleTheme = (e?: MouseEvent | TouchEvent) => {
    const next: UiTheme = theme.value === 'dark' ? 'light' : 'dark'
    persist(next)
    pendingOrigin = originFromEvent(e)
    theme.value = next
  }

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: () => theme.value === 'dark',
  }
}
