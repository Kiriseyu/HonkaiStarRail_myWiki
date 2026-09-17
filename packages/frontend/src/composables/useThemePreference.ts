import { ref, watch } from 'vue'

export type UiTheme = 'dark' | 'light'

const STORAGE_KEY = 'hsr-team-builder:ui-theme:v1'
const theme = ref<UiTheme>('dark')

/** 扩散时长：稍从容，让光晕与粒子有呼吸感 */
const GROW_MS = 280
/** 淡出时长 */
const FADE_MS = 140
/**
 * 峰值不透明度：半透明，让底层内容隐约可见，避免「糊屏」感。
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
 * 深色→浅色（月转日）：中心是小圈月光白青冷色，迅速过渡到暖调晨光，铺开白昼。
 * 浅色→深色（日转暮）：白昼亮色 → 窄带落日橙（日暮短暂）→ 过渡紫 → 暮空蓝夜色。
 */
function sunsetGradient(t: UiTheme) {
  if (t === 'light') {
    // 月转日：内圈白青冷月（收窄）→ 暖杏 → 晨光暖白 → 白昼
    return `radial-gradient(
      circle closest-side,
      rgba(232, 244, 255, ${PEAK_ALPHA}) 0%,
      rgba(192, 224, 240, ${PEAK_ALPHA * 0.92}) 8%,
      rgba(220, 228, 210, ${PEAK_ALPHA * 0.88}) 20%,
      rgba(245, 230, 192, ${PEAK_ALPHA * 0.9}) 38%,
      rgba(255, 245, 224, ${PEAK_ALPHA * 0.94}) 58%,
      rgba(248, 250, 252, ${PEAK_ALPHA * 0.9}) 78%,
      rgba(238, 243, 249, ${PEAK_ALPHA * 0.85}) 100%
    )`
  }
  // 日转暮夜：白昼亮色 → 窄带落日橙 → 过渡紫 → 暮空蓝夜色
  return `radial-gradient(
    circle closest-side,
    rgba(248, 250, 252, ${PEAK_ALPHA}) 0%,
    rgba(232, 236, 240, ${PEAK_ALPHA * 0.92}) 12%,
    rgba(217, 74, 38, ${PEAK_ALPHA * 0.88}) 28%,
    rgba(74, 59, 92, ${PEAK_ALPHA * 0.9}) 44%,
    rgba(26, 43, 76, ${PEAK_ALPHA * 0.94}) 66%,
    rgba(18, 28, 50, ${PEAK_ALPHA * 0.9}) 86%,
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

/** 随机数生成（粒子分布用） */
function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

/**
 * 切暮色（→dark）：随光圈追出的星星粒子。
 * 菱形白点，与按钮 .eg-ts-stars 同风格，向外飘散并闪烁。
 */
function spawnStars(origin: { x: number; y: number }, container: HTMLElement) {
  const count = 14
  for (let i = 0; i < count; i++) {
    const star = document.createElement('span')
    star.className = 'theme-veil-star'
    star.setAttribute('aria-hidden', 'true')
    // 尺寸与按钮星星一致：2–5px 菱形
    const size = rand(2, 5)
    const angle = rand(0, Math.PI * 2)
    // 起点在按钮附近，终点向外扩散
    const startR = rand(8, 28)
    const endR = rand(60, 180)
    const x0 = origin.x + Math.cos(angle) * startR
    const y0 = origin.y + Math.sin(angle) * startR
    const x1 = origin.x + Math.cos(angle) * endR
    const y1 = origin.y + Math.sin(angle) * endR - rand(10, 40)
    star.style.width = `${size}px`
    star.style.height = `${size}px`
    star.style.left = `${x0}px`
    star.style.top = `${y0}px`
    star.style.setProperty('--star-dx', `${x1 - x0}px`)
    star.style.setProperty('--star-dy', `${y1 - y0}px`)
    star.style.animationDelay = `${rand(0, 120)}ms`
    star.style.animationDuration = `${rand(320, 480)}ms`
    container.appendChild(star)
  }
}

/**
 * 切浅色（→light）：随光圈浮出的白云粒子。
 * 圆角白团，与按钮 .eg-ts-clouds 同风格，轻盈上浮消散。
 */
function spawnClouds(origin: { x: number; y: number }, container: HTMLElement) {
  const count = 8
  for (let i = 0; i < count; i++) {
    const cloud = document.createElement('i')
    cloud.className = 'theme-veil-cloud'
    cloud.setAttribute('aria-hidden', 'true')
    const w = rand(14, 32)
    const h = rand(8, 14)
    const angle = rand(-Math.PI * 0.85, -Math.PI * 0.15)
    const startR = rand(12, 32)
    const endR = rand(70, 160)
    const x0 = origin.x + Math.cos(angle) * startR
    const y0 = origin.y + Math.sin(angle) * startR
    const x1 = origin.x + Math.cos(angle) * endR + rand(-20, 20)
    const y1 = origin.y + Math.sin(angle) * endR - rand(20, 50)
    cloud.style.width = `${w}px`
    cloud.style.height = `${h}px`
    cloud.style.left = `${x0}px`
    cloud.style.top = `${y0}px`
    cloud.style.setProperty('--cloud-dx', `${x1 - x0}px`)
    cloud.style.setProperty('--cloud-dy', `${y1 - y0}px`)
    cloud.style.animationDelay = `${rand(0, 140)}ms`
    cloud.style.animationDuration = `${rand(360, 520)}ms`
    container.appendChild(cloud)
  }
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

  // 粒子层：星星或白云，随光圈一起淡出
  const fx = document.createElement('div')
  fx.className = 'theme-veil-fx'
  fx.setAttribute('aria-hidden', 'true')
  if (t === 'dark') {
    spawnStars(origin, fx)
  } else {
    spawnClouds(origin, fx)
  }
  document.body.appendChild(fx)

  // 主光晕层
  const veil = document.createElement('div')
  veil.className = 'theme-veil theme-veil--burst'
  veil.setAttribute('aria-hidden', 'true')
  veil.style.background = sunsetGradient(t)
  veil.style.setProperty('--theme-veil-size', `${size}px`)
  veil.style.left = `${origin.x}px`
  veil.style.top = `${origin.y}px`
  document.body.appendChild(veil)

  // 强制回流后再触发 scale 扩散
  void veil.offsetHeight
  veil.classList.add('is-active')

  // 扩到全屏时提交主题
  window.setTimeout(() => {
    const target = queuedTheme ?? t
    queuedTheme = null
    commitDom(target)
    veil.style.background = sunsetGradient(target)
    veil.classList.add('is-out')
    fx.classList.add('is-out')
    window.setTimeout(() => {
      veil.remove()
      fx.remove()
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
