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
 * 从按钮处向外扩散的径向渐变，模拟天色流转。
 *
 * 深色→浅色（月转日）：中心是月光白青冷色，向外渐入暖调晨光，最终铺开为白昼。
 * 浅色→深色（日转暮）：中心是白昼亮色，向外经落日橙、过渡紫，沉入暮空蓝夜色。
 */
function sunsetGradient(t: UiTheme) {
  if (t === 'light') {
    // 月转日：白青冷月 → 暖杏过渡 → 晨光暖白 → 白昼
    return `radial-gradient(
      circle closest-side,
      rgba(232, 244, 255, ${PEAK_ALPHA}) 0%,
      rgba(192, 224, 240, ${PEAK_ALPHA * 0.95}) 14%,
      rgba(214, 220, 200, ${PEAK_ALPHA * 0.9}) 32%,
      rgba(245, 230, 192, ${PEAK_ALPHA * 0.92}) 52%,
      rgba(255, 245, 224, ${PEAK_ALPHA * 0.95}) 72%,
      rgba(248, 250, 252, ${PEAK_ALPHA * 0.9}) 88%,
      rgba(238, 243, 249, ${PEAK_ALPHA * 0.85}) 100%
    )`
  }
  // 日转暮夜：白昼亮色 → 落日橙 → 过渡紫 → 暮空蓝夜色
  return `radial-gradient(
    circle closest-side,
    rgba(248, 250, 252, ${PEAK_ALPHA}) 0%,
    rgba(232, 236, 240, ${PEAK_ALPHA * 0.95}) 14%,
    rgba(217, 74, 38, ${PEAK_ALPHA * 0.9}) 34%,
    rgba(74, 59, 92, ${PEAK_ALPHA * 0.92}) 54%,
    rgba(26, 43, 76, ${PEAK_ALPHA * 0.94}) 74%,
    rgba(18, 28, 50, ${PEAK_ALPHA * 0.9}) 90%,
    rgba(10, 14, 26, ${PEAK_ALPHA * 0.85}) 100%
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
