import { ref, watch } from 'vue'

export type UiTheme = 'dark' | 'light'

const STORAGE_KEY = 'hsr-team-builder:ui-theme:v1'
const theme = ref<UiTheme>('dark')

/** 扫过整屏的时长：足够感知「天色在变」，又不拖泥带水 */
const SWEEP_MS = 180
/** 淡出时长：扫完立刻退场 */
const FADE_MS = 80
/** 峰值不透明度：主题切换瞬间完全盖住旧色，消除闪跳 */
const PEAK_ALPHA = 0.97

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
 * 日升（→浅色）/ 日落（→深色）的天色渐变。
 * 用一条「地平线光带」扫过整屏，光带两侧分别是目标主题的底色，
 * 扫过瞬间光带中心接近不透明，正好遮住 data-theme 跳变。
 */
function horizonGradient(t: UiTheme) {
  if (t === 'light') {
    // 日出：深空蓝 → 琥珀地平线 → 晨光天蓝
    return `linear-gradient(
      180deg,
      rgba(20, 28, 48, ${PEAK_ALPHA}) 0%,
      rgba(40, 48, 72, ${PEAK_ALPHA * 0.98}) 18%,
      rgba(120, 100, 80, ${PEAK_ALPHA * 0.9}) 38%,
      rgba(255, 190, 100, ${PEAK_ALPHA}) 48%,
      rgba(255, 230, 170, ${PEAK_ALPHA}) 52%,
      rgba(140, 170, 210, ${PEAK_ALPHA * 0.9}) 62%,
      rgba(200, 220, 240, ${PEAK_ALPHA * 0.98}) 82%,
      rgba(238, 244, 251, ${PEAK_ALPHA}) 100%
    )`
  }
  // 日落：暮光天顶 → 落日余晖 → 夜色地平线
  return `linear-gradient(
    180deg,
    rgba(243, 246, 250, ${PEAK_ALPHA}) 0%,
    rgba(220, 228, 240, ${PEAK_ALPHA * 0.98}) 18%,
    rgba(180, 140, 120, ${PEAK_ALPHA * 0.9}) 38%,
    rgba(255, 140, 70, ${PEAK_ALPHA}) 48%,
    rgba(255, 100, 60, ${PEAK_ALPHA}) 52%,
    rgba(90, 70, 110, ${PEAK_ALPHA * 0.9}) 62%,
    rgba(30, 32, 56, ${PEAK_ALPHA * 0.98}) 82%,
    rgba(11, 16, 32, ${PEAK_ALPHA}) 100%
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

let animating = false
/** 动画期间再次切换：只记目标主题，扫过结束后提交，避免 DOM 与 ref 脱节 */
let queuedTheme: UiTheme | null = null

function playHorizonSweep(t: UiTheme) {
  if (animating) {
    queuedTheme = t
    return
  }
  animating = true

  // 日出从底部升起，日落从顶部沉下——方向暗示时间流逝
  const fromY = t === 'light' ? '100%' : '-100%'
  const veil = document.createElement('div')
  veil.className = 'theme-veil theme-veil--horizon'
  veil.setAttribute('aria-hidden', 'true')
  veil.style.background = horizonGradient(t)
  veil.style.transform = `translateY(${fromY})`
  document.body.appendChild(veil)

  // 强制回流后再触发过渡
  void veil.offsetHeight
  veil.style.transform = 'translateY(0%)'

  // 扫完后再提交主题：此刻光带已盖满全屏，无闪跳
  window.setTimeout(() => {
    const target = queuedTheme ?? t
    queuedTheme = null
    commitDom(target)
    // 换成目标主题对应的天色，短促淡出
    veil.style.background = horizonGradient(target)
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
  }, SWEEP_MS)
}

function applyDom(t: UiTheme, origin?: { x: number; y: number }) {
  if (typeof document === 'undefined') return
  if (!origin || prefersReducedMotion()) {
    commitDom(t)
    return
  }
  playHorizonSweep(t)
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
