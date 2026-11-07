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

/**
 * 角色帧素材：Image1-11 为白三月七，Image12-22 为黑长夜月。
 * 浅色→深色按 1→22 播放（白转黑），深色→浅色反向播放（黑转白），
 * 与主题语义一致：亮色人格对应浅色主题，暗色人格对应深色主题。
 */
const FRAME_COUNT = 22
/** 单帧停留时长：22 帧 ≈ 0.92s，比光晕扩散稍长，形成「变身」节奏 */
const FRAME_INTERVAL_MS = 42
/**
 * 定格虚化停留时长：帧序列播完后保留目标角色画面（浅色=白三月七，深色=黑长夜月），
 * 模糊成氛围层停留一段时间，让「变身」有落点而不是瞬间消失。
 */
const SETTLE_MS = 1600
/** 虚化层整体淡出时长：比普通淡出更慢，收尾更柔和 */
const SETTLE_FADE_MS = 500

function frameUrl(index: number) {
  return `/images/theme-switch/Image${index}.jpg`
}

let framesPreloaded = false
/** 当前存活的角色帧层：连续切换时先移除上一层的虚化定格，避免叠加糊屏 */
let activeFrameVeil: HTMLElement | null = null

/**
 * 预载全部帧（约 0.8MB），放在浏览器空闲时执行。
 * 否则首次切换要逐帧请求，交叉淡入会出现空白帧。
 */
function preloadThemeFrames() {
  if (framesPreloaded || typeof window === 'undefined') return
  framesPreloaded = true
  const run = () => {
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image()
      img.decoding = 'async'
      img.src = frameUrl(i)
    }
  }
  // requestIdleCallback 不在标准 DOM 类型里，这里做兼容探测
  const idle = (window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  }).requestIdleCallback
  if (typeof idle === 'function') idle(run, { timeout: 4000 })
  else window.setTimeout(run, 1500)
}

/**
 * 全屏角色帧动画：两层 <img> 交替作为前景，交叉淡入完成形态转换。
 * 播放结束后不掉头淡出，而是定格到目标角色帧并虚化停留一段时间
 * （浅色主题=白三月七起始帧 Image1，深色主题=黑长夜月末帧 Image22），
 * 再缓慢淡出。只做视觉叠加（pointer-events: none），主题提交时机仍由 playSunsetBurst 控制。
 */
function playCharacterFrames(t: UiTheme) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return

  // 上一段定格还在屏幕上时直接移除，避免新动画叠在虚化层上
  activeFrameVeil?.remove()

  const veil = document.createElement('div')
  veil.className = 'theme-frame-veil'
  veil.setAttribute('aria-hidden', 'true')
  activeFrameVeil = veil

  const layers = [document.createElement('img'), document.createElement('img')]
  for (const layer of layers) {
    layer.className = 'theme-frame-layer'
    layer.alt = ''
    layer.draggable = false
  }
  veil.append(layers[0]!, layers[1]!)
  document.body.appendChild(veil)

  /** forward=true 时按 1→22，false 时按 22→1 */
  const forward = t === 'dark'
  const frameAt = (step: number) => (forward ? step + 1 : FRAME_COUNT - step)

  let front = 0
  layers[0]!.src = frameUrl(frameAt(0))
  layers[1]!.src = frameUrl(frameAt(0))
  layers[0]!.classList.add('is-front')

  // 强制回流后淡入，保证 opacity 过渡真正生效
  void veil.offsetHeight
  veil.classList.add('is-active')

  let step = 0
  let frozen = false
  const timer = window.setInterval(() => {
    step += 1
    if (step >= FRAME_COUNT) {
      window.clearInterval(timer)
      return
    }
    const back = 1 - front
    layers[back]!.src = frameUrl(frameAt(step))
    // 等一帧渲染再换前景层，让新图先绘制到后台层再开始淡入
    window.requestAnimationFrame(() => {
      // 已进入定格阶段：忽略残余的回调，避免把手动指定的定格帧又切走
      if (frozen) return
      layers[front]!.classList.remove('is-front')
      layers[back]!.classList.add('is-front')
      front = back
    })
  }, FRAME_INTERVAL_MS)

  /** 定格帧：正向（转深色）停在黑长夜月末帧，反向（转浅色）停在白三月七起始帧 */
  const settleFrame = forward ? FRAME_COUNT : 1

  // 播完所有帧后定格并虚化停留，最后整体淡出销毁，生命周期与光晕层解耦
  window.setTimeout(() => {
    frozen = true
    // 帧调度有毫秒级误差，显式指定目标角色帧为前景，避免停在过渡帧
    const settled = layers[front]!
    settled.src = frameUrl(settleFrame)
    settled.classList.add('is-front')
    layers[1 - front]!.classList.remove('is-front')

    veil.classList.add('is-settling')
    window.setTimeout(() => {
      veil.classList.add('is-out')
      window.setTimeout(() => {
        veil.remove()
        if (activeFrameVeil === veil) activeFrameVeil = null
      }, SETTLE_FADE_MS)
    }, SETTLE_MS)
  }, FRAME_COUNT * FRAME_INTERVAL_MS)
}

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
 * 切暮色（→dark）：星星以按钮为圆心，点击瞬间放射闪出。
 * left/top 直接定位到元素中心（减去半宽高），transform 只负责动画位移。
 */
function spawnStars(origin: { x: number; y: number }, container: HTMLElement, maxR: number) {
  const count = 22
  const startR = rand(2, 8)
  for (let i = 0; i < count; i++) {
    const star = document.createElement('span')
    star.className = 'theme-veil-star'
    star.setAttribute('aria-hidden', 'true')
    const size = rand(8, 16)
    const half = size / 2
    const angle = rand(0, Math.PI * 2)
    const dist = Math.sqrt(Math.random()) * maxR * 0.9
    // 位移向量（从起点指向终点）
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist
    // 起点：按钮附近，left/top 减去半宽高使元素中心对准起点
    const sx = origin.x + Math.cos(angle + rand(-0.1, 0.1)) * startR - half
    const sy = origin.y + Math.sin(angle + rand(-0.1, 0.1)) * startR - half
    star.style.width = `${size}px`
    star.style.height = `${size}px`
    star.style.left = `${sx}px`
    star.style.top = `${sy}px`
    star.style.opacity = '0'
    container.appendChild(star)

    const delay = (dist / maxR) * 50 + rand(0, 30)
    const duration = rand(300, 450)
    star.animate(
      [
        {
          opacity: 0,
          transform: 'rotate(45deg) scale(0.2)',
        },
        {
          opacity: 1,
          transform: `rotate(45deg) translate(${dx * 0.12}px, ${dy * 0.12}px) scale(1.6)`,
          offset: 0.15,
        },
        {
          opacity: 0.9,
          transform: `rotate(45deg) translate(${dx * 0.5}px, ${dy * 0.5}px) scale(1.2)`,
          offset: 0.5,
        },
        {
          opacity: 0,
          transform: `rotate(45deg) translate(${dx}px, ${dy}px) scale(0.2)`,
        },
      ],
      {
        duration,
        delay,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards',
      },
    )
  }
}

/**
 * 切浅色（→light）：白云散布在光晕覆盖范围内，随光圈浮出并轻盈上飘。
 */
function spawnClouds(origin: { x: number; y: number }, container: HTMLElement, maxR: number) {
  const count = 10
  for (let i = 0; i < count; i++) {
    const cloud = document.createElement('i')
    cloud.className = 'theme-veil-cloud'
    cloud.setAttribute('aria-hidden', 'true')
    const w = rand(40, 80)
    const h = rand(18, 32)
    const angle = rand(0, Math.PI * 2)
    const dist = Math.sqrt(Math.random()) * maxR * 0.85
    const x = origin.x + Math.cos(angle) * dist - w / 2
    const y = origin.y + Math.sin(angle) * dist - h / 2
    const dx = rand(-30, 30)
    const dy = -rand(28, 60)
    cloud.style.width = `${w}px`
    cloud.style.height = `${h}px`
    cloud.style.left = `${x}px`
    cloud.style.top = `${y}px`
    cloud.style.opacity = '0'
    container.appendChild(cloud)

    const delay = (dist / maxR) * 50 + rand(0, 30)
    const duration = rand(380, 560)
    cloud.animate(
      [
        {
          opacity: 0,
          transform: 'scale(0.5)',
        },
        {
          opacity: 0.9,
          transform: `translate(${dx * 0.2}px, ${dy * 0.2}px) scale(1)`,
          offset: 0.25,
        },
        {
          opacity: 0.6,
          transform: `translate(${dx * 0.65}px, ${dy * 0.65}px) scale(1)`,
          offset: 0.65,
        },
        {
          opacity: 0,
          transform: `translate(${dx}px, ${dy}px) scale(0.75)`,
        },
      ],
      {
        duration,
        delay,
        easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        fill: 'forwards',
      },
    )
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
  const maxR = size / 2

  // 粒子层：散布在光晕覆盖范围内，随光圈依次亮起
  const fx = document.createElement('div')
  fx.className = 'theme-veil-fx'
  fx.setAttribute('aria-hidden', 'true')
  if (t === 'dark') {
    spawnStars(origin, fx, maxR)
  } else {
    spawnClouds(origin, fx, maxR)
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

  // 角色帧层：与光晕同时启动，白/黑三月七逐帧交叉淡入（z-index 更高，覆盖在其上）
  playCharacterFrames(t)

  // 强制回流后再触发 scale 扩散
  void veil.offsetHeight
  veil.classList.add('is-active')

  // 粒子层独立存活：等所有星星/云动画播完再移除
  // 最大 delay (~80ms) + 最大 duration (~560ms) + buffer
  const fxLife = 800
  window.setTimeout(() => {
    fx.remove()
  }, fxLife)

  // 扩到全屏时提交主题（光晕层正常淡出）
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
  // 空闲预载 22 张切换帧，避免首次切换时逐帧请求导致空白
  preloadThemeFrames()
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
