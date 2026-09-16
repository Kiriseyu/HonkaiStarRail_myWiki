import { ref, watch } from 'vue'

export type UiTheme = 'dark' | 'light'

const STORAGE_KEY = 'hsr-team-builder:ui-theme:v1'
const theme = ref<UiTheme>('dark')

const GROW_MS = 360
const FADE_MS = 260
/** 峰值透明度：够盖住跳变又不至于糊成纯色刷屏 */
const PEAK_ALPHA = 0.55

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

function veilRgb(t: UiTheme) {
  return t === 'light' ? '248, 250, 252' : '10, 12, 22'
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

function coverSize(x: number, y: number) {
  const w = window.innerWidth
  const h = window.innerHeight
  const r = Math.max(
    Math.hypot(x, y),
    Math.hypot(w - x, y),
    Math.hypot(x, h - y),
    Math.hypot(w - x, h - y),
  )
  return Math.ceil(r * 2) + 8
}

let animating = false
/** 动画期间再次切换：只记目标主题，盖满后提交，避免 DOM 与 ref 脱节 */
let queuedTheme: UiTheme | null = null

function playCircleVeil(t: UiTheme, origin: { x: number; y: number }) {
  if (animating) {
    queuedTheme = t
    return
  }
  animating = true

  const size = coverSize(origin.x, origin.y)
  const veil = document.createElement('div')
  veil.className = 'theme-veil'
  veil.setAttribute('aria-hidden', 'true')
  veil.style.left = `${origin.x}px`
  veil.style.top = `${origin.y}px`
  veil.style.background = `radial-gradient(
    circle closest-side,
    rgba(${veilRgb(t)}, ${PEAK_ALPHA}) 62%,
    rgba(${veilRgb(t)}, ${PEAK_ALPHA * 0.35}) 100%
  )`
  veil.style.setProperty('--theme-veil-size', `${size}px`)
  document.body.appendChild(veil)

  requestAnimationFrame(() => {
    veil.classList.add('is-active')
    window.setTimeout(() => {
      const target = queuedTheme ?? t
      queuedTheme = null
      commitDom(target)
      veil.style.backgroundColor = `radial-gradient(
        circle closest-side,
        rgba(${veilRgb(target)}, ${PEAK_ALPHA}) 62%,
        rgba(${veilRgb(target)}, ${PEAK_ALPHA * 0.35}) 100%
      )`
      veil.classList.add('is-out')
      window.setTimeout(() => {
        veil.remove()
        animating = false
        if (queuedTheme) {
          const next = queuedTheme
          queuedTheme = null
          commitDom(next)
        }
      }, FADE_MS)
    }, GROW_MS)
  })
}

function applyDom(t: UiTheme, origin?: { x: number; y: number }) {
  if (typeof document === 'undefined') return
  if (!origin || prefersReducedMotion()) {
    commitDom(t)
    return
  }
  playCircleVeil(t, origin)
}

let booted = false
let pendingOrigin: { x: number; y: number } | null = null

function ensureBooted() {
  if (booted || typeof window === 'undefined') return
  theme.value = detectInitial()
  applyDom(theme.value)
  watch(theme, (t) => {
    const origin = pendingOrigin ?? null
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
