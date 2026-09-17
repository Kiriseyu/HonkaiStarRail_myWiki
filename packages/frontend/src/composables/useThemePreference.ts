import { ref, watch } from 'vue'

export type UiTheme = 'dark' | 'light'

const STORAGE_KEY = 'hsr-team-builder:ui-theme:v1'
const theme = ref<UiTheme>('dark')

/** 扩散时长：足够感知光晕扩散，又不拖泥带水 */
const GROW_MS = 200
/** 淡出时长 */
const FADE_MS = 100
/**
 * 峰值不透明度：半透明，让底层内容隐约可见，避免「糊屏」感。
 * 日落/日出的暮色本身就是半透的，0.78 刚好盖住跳变又保留层次。
 */
const PEAK_ALPHA = 0.78

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

/**
 * 暮色日落/日出的径向渐变，从按钮处向外扩散。
 * 色板：暮空蓝 #1A2B4C · 过渡紫 #4A3B5C · 落日橙 #D94A26 · 草坪绿 #1E5E2F
 *
 * 浅色（日出）：中心是晨曦暖橙，向外过渡到紫、蓝，最外层透出晨光绿意。
 * 深色（日落）：中心是落日余晖，向外过渡到紫、蓝夜幕，外缘沉入夜色。
 */
function sunsetGradient(t: UiTheme) {
  if (t === 'light') {
    // 日出：暖橙中心 → 紫 → 蓝 → 微绿晨光
    return `radial-gradient(
      circle closest-side,
      rgba(217, 74, 38, ${PEAK_ALPHA}) 0%,
      rgba(217, 74, 38, ${PEAK_ALPHA * 0.92}) 18%,
      rgba(74, 59, 92, ${PEAK_ALPHA * 0.88}) 42%,
      rgba(26, 43, 76, ${PEAK_ALPHA * 0.92}) 68%,
      rgba(30, 94, 47, ${PEAK_ALPHA * 0.72}) 88%,
      rgba(26, 43, 76, ${PEAK_ALPHA * 0.85}) 100%
    )`
  }
  // 日落：橙红中心 → 紫 → 暮蓝 → 深夜
  return `radial-gradient(
    circle closest-side,
    rgba(217, 74, 38, ${PEAK_ALPHA}) 0%,
    rgba(217, 74, 38, ${PEAK_ALPHA * 0.9}) 16%,
    rgba(74, 59, 92, ${PEAK_ALPHA * 0.9}) 40%,
    rgba(26, 43, 76, ${PEAK_ALPHA * 0.94}) 66%,
    rgba(30, 94, 47, ${PEAK_ALPHA * 0.55}) 86%,
    rgba(26, 43, 76, ${PEAK_ALPHA * 0.88}) 100%
  )`
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

/** 计算从 (x,y) 覆盖全屏所需的圆形直径 */
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

function playSunsetBurst(t: UiTheme, origin: { x: number; y: number }) {
  if (animating) {
    queuedTheme = t
    return
  }
  animating = true

  const size = coverSize(origin.x, origin.y)
  const veil = document.createElement('div')
  veil.className = 'theme-veil theme-veil--burst'
  veil.setAttribute('aria-hidden', 'true')
  veil.style.left = `${origin.x}px`
  veil.style.top = `${origin.y}px`
  veil.style.background = sunsetGradient(t)
  veil.style.setProperty('--theme-veil-size', `${size}px`)
  document.body.appendChild(veil)

  // 强制回流后再触发 scale 扩散
  void veil.offsetHeight
  veil.classList.add('is-active')

  // 扩到全屏时提交主题：此刻光晕已铺满，配合半透明无闪跳感
  window.setTimeout(() => {
    const target = queuedTheme ?? t
    queuedTheme = null
    commitDom(target)
    veil.style.background = sunsetGradient(target)
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
}

function applyDom(t: UiTheme, origin?: { x: number; y: number }) {
  if (typeof document === 'undefined') return
  if (!origin || prefersReducedMotion()) {
    commitDom(t)
    return
  }
  playSunsetBurst(t, origin)
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
