import { ref, watch } from 'vue'

export type UiTheme = 'dark' | 'light'

const STORAGE_KEY = 'hsr-team-builder:ui-theme:v1'
const theme = ref<UiTheme>('dark')

const WIPE_MS = 520

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

function setWipeVars(x: number, y: number) {
  const root = document.documentElement
  root.style.setProperty('--theme-wipe-x', `${x}px`)
  root.style.setProperty('--theme-wipe-y', `${y}px`)
  root.style.setProperty('--theme-wipe-r', `${wipeRadius(x, y)}px`)
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
  if (typeof ev.clientX === 'number' && typeof ev.clientY === 'number') {
    // 0,0 多半是程序触发而非真实点击
    if (ev.clientX || ev.clientY || ev.screenX || ev.screenY) {
      return { x: ev.clientX, y: ev.clientY }
    }
  }
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.16 }
}

/** 降级：从按钮点向外扩一层目标色圆形，盖满后再提交主题 */
function playWipeOverlay(t: UiTheme, x: number, y: number) {
  const size = wipeRadius(x, y) * 2 + 32
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
    layer.remove()
  }, WIPE_MS)
}

function applyDom(t: UiTheme, origin?: { x: number; y: number }) {
  if (typeof document === 'undefined') return
  const motionOk = Boolean(origin) && !prefersReducedMotion()

  if (!motionOk) {
    commitDom(t)
    return
  }

  const { x, y } = origin!
  setWipeVars(x, y)

  if (typeof document.startViewTransition === 'function') {
    try {
      document.startViewTransition(() => commitDom(t))
      return
    } catch {
      /* fall through */
    }
  }

  playWipeOverlay(t, x, y)
}

let booted = false
/** 一次变更只播一次擦除，避免 watch + 手动调用叠两层 */
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
