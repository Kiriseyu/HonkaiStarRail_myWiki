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
/** 单帧停留时长：22 帧 ≈ 0.92s，与素材原始帧率接近，硬切换帧才有流畅感 */
const FRAME_INTERVAL_MS = 42
/**
 * 定格虚化停留时长：帧序列播完后保留目标角色画面（浅色=白三月七，深色=黑长夜月），
 * 模糊成氛围层停留一段时间，让「变身」有落点而不是瞬间消失。
 */
const SETTLE_MS = 1200
/** 虚化层整体淡出时长：与 main.css 的 1s 渐隐对齐，多留 100ms 确保淡完再销毁 */
const SETTLE_FADE_MS = 1100
/**
 * 素材上下各有约 5% 的黑边：绘制时直接从源图裁掉。
 * 之前靠 transform: scale(1.14) 放大裁切，在不同宽高比下要么露黑边、要么切到人物头部。
 */
const FRAME_BAR_RATIO = 0.05
/**
 * 竖屏适配：以「宽度铺满 + 6% 余量」放大（余量只用来消除边缘缝隙，几乎不裁内容），
 * 同时把画面高度限制在视口的 62%，避免平板上画面过高。
 */
const PORTRAIT_ZOOM = 1.06
const PORTRAIT_MAX_HEIGHT_RATIO = 0.62
/** 边缘羽化宽度（相对画面边长的比例）：让画面融回页面，避免出现矩形硬边 */
const FEATHER_EDGE = 0.1

function frameUrl(index: number) {
  return `/images/theme-switch/Image${index}.jpg`
}

let framesPreloaded = false
/** 当前存活的角色帧层与其清理函数：连续切换时先彻底停掉上一段动画，避免叠加 */
let activeFrameVeil: HTMLElement | null = null
let activeFrameCleanup: (() => void) | null = null
/**
 * 预载后的 Image 引用必须持有：没有引用的 Image 会被 GC 回收，
 * 浏览器随之中断未完成的请求（线上表现为部分帧 ERR_ABORTED + 切换时空白）。
 * 数组按 1..22 的下标存放，绘制时直接按帧号取用。
 */
const preloadedFrames: HTMLImageElement[] = []

/**
 * 预载并解码全部帧（约 780KB）。
 * 首次切换如果要逐帧请求 + 临时解码，画面会闪白或卡顿，所以提前加载；
 * 同时保留引用，避免 GC 回收导致请求中断。
 */
function preloadThemeFrames() {
  if (framesPreloaded || typeof window === 'undefined') return
  framesPreloaded = true
  // 用 0ms 定时器而不是 requestIdleCallback：空闲窗口在低端设备上可能很晚（甚至不触发），
  // 首次切换时就拿不到帧。图片很小，直接异步加载即可，不阻塞首屏渲染。
  window.setTimeout(() => {
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image()
      img.decoding = 'async'
      img.src = frameUrl(i)
      preloadedFrames[i] = img
      // 提前解码：切帧时若临时同步解码，会出现一帧空白/闪动
      void img.decode?.().catch(() => {})
    }
  }, 0)
}

/**
 * 全屏角色帧动画：用 canvas 逐帧硬切换（不做交叉淡入）。
 * 交叉淡入时两层同时半透明，整体亮度会随帧率起伏，视觉上就是「抖动」；
 * 素材本身是连续动画帧，硬切换才是正确的播放方式。
 * 裁黑边、按视口宽高比适配、边缘羽化都在绘制阶段完成，桌面与手机表现一致。
 * 播放结束后定格到目标角色帧并虚化停留（浅色=白三月七 Image1，深色=黑长夜月 Image22），
 * 再缓慢淡出。只做视觉叠加（pointer-events: none），主题提交时机仍由 playSunsetBurst 控制。
 */
function playCharacterFrames(t: UiTheme) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return

  // 上一段还在播放或定格没淡完：先彻底清理，避免两层动画叠加
  activeFrameCleanup?.()

  const veil = document.createElement('div')
  veil.className = 'theme-frame-veil'
  veil.setAttribute('aria-hidden', 'true')

  const canvas = document.createElement('canvas')
  canvas.className = 'theme-frame-canvas'
  veil.appendChild(canvas)
  document.body.appendChild(veil)
  activeFrameVeil = veil

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    veil.remove()
    activeFrameVeil = null
    return
  }

  /** 装饰层按 2 倍封顶：再高只会白耗内存与填充率，视觉上已无差别 */
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  function sizeCanvas(el: HTMLCanvasElement) {
    el.width = Math.round(window.innerWidth * dpr)
    el.height = Math.round(window.innerHeight * dpr)
  }
  sizeCanvas(canvas)

  type FrameRect = {
    sx: number
    sy: number
    sw: number
    sh: number
    dx: number
    dy: number
    dw: number
    dh: number
  }

  /**
   * 计算源图裁剪区与目标绘制区。
   * 横屏（桌面）：按高度完整展示方形素材，人物头部不会被上下裁掉，左右留空交给羽化；
   * 竖屏（手机/平板）：以宽度为基准放大 PORTRAIT_ZOOM 倍，并把高度限制在视口的 62%。
   */
  function layout(img: HTMLImageElement): FrameRect {
    const sw = img.naturalWidth || 1080
    const sh = img.naturalHeight || 1080
    const bar = Math.round(sh * FRAME_BAR_RATIO)
    const srcH = sh - bar * 2
    const vw = canvas.width
    const vh = canvas.height
    const scale =
      vw >= vh
        ? Math.min(vw / sw, vh / srcH)
        : Math.min((vw / sw) * PORTRAIT_ZOOM, (vh * PORTRAIT_MAX_HEIGHT_RATIO) / srcH)
    const dw = sw * scale
    const dh = srcH * scale
    return {
      sx: 0,
      sy: bar,
      sw,
      sh: srcH,
      dx: (vw - dw) / 2,
      // 视觉重心略高于正中，更贴合人像构图
      dy: (vh - dh) * 0.44,
      dw,
      dh,
    }
  }

  /**
   * 边缘羽化：用 destination-out 把贴边像素擦淡，让画面融回页面。
   * 只在有留白的方向做——画面正好铺满的方向不需要羽化，否则会擦掉人物头部。
   * 相比 CSS mask，省掉全屏遮罩在每次合成时的重采样开销。
   */
  function feather(r: FrameRect) {
    const vw = canvas.width
    const vh = canvas.height
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    if (r.dw < vw) {
      const g = ctx.createLinearGradient(r.dx, 0, r.dx + r.dw, 0)
      g.addColorStop(0, 'rgba(0, 0, 0, 1)')
      g.addColorStop(FEATHER_EDGE, 'rgba(0, 0, 0, 0)')
      g.addColorStop(1 - FEATHER_EDGE, 'rgba(0, 0, 0, 0)')
      g.addColorStop(1, 'rgba(0, 0, 0, 1)')
      ctx.fillStyle = g
      ctx.fillRect(r.dx, 0, r.dw, vh)
    }
    if (r.dh < vh) {
      const g = ctx.createLinearGradient(0, r.dy, 0, r.dy + r.dh)
      g.addColorStop(0, 'rgba(0, 0, 0, 1)')
      g.addColorStop(FEATHER_EDGE, 'rgba(0, 0, 0, 0)')
      g.addColorStop(1 - FEATHER_EDGE, 'rgba(0, 0, 0, 0)')
      g.addColorStop(1, 'rgba(0, 0, 0, 1)')
      ctx.fillStyle = g
      ctx.fillRect(0, r.dy, vw, r.dh)
    }
    ctx.restore()
  }

  /** 绘制单帧。素材尚未加载完成时返回 false，保留上一帧，避免闪白 */
  function drawFrame(img: HTMLImageElement | undefined) {
    if (!img || !img.complete || !img.naturalWidth) return false
    const r = layout(img)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.filter = 'none'
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh)
    feather(r)
    return true
  }

  /**
   * 定格快照：把当前画面模糊 + 轻微放大一次画到独立画布。
   * blur 只算一次，之后靠不透明度交叉淡入，避免逐帧重算全屏模糊（手机端会明显掉帧）。
   */
  function paintBlur(target: HTMLCanvasElement) {
    const bctx = target.getContext('2d')
    if (!bctx) return
    bctx.setTransform(1, 0, 0, 1, 0, 0)
    bctx.globalCompositeOperation = 'source-over'
    bctx.clearRect(0, 0, target.width, target.height)
    bctx.filter = `blur(${Math.round(14 * dpr)}px) saturate(1.08)`
    // 放大 8%：模糊后边缘不会露出空白
    bctx.drawImage(
      canvas,
      -target.width * 0.04,
      -target.height * 0.04,
      target.width * 1.08,
      target.height * 1.08,
    )
  }

  /** forward=true 时按 1→22，false 时按 22→1 */
  const forward = t === 'dark'
  const frameAt = (step: number) => (forward ? step + 1 : FRAME_COUNT - step)

  const timers: number[] = []
  let currentStep = 0
  let blurLayer: HTMLCanvasElement | null = null
  let stepTimer = 0
  let disposed = false

  /** 清理：停定时器、移除监听与图层。连续切换时由下一次调用触发 */
  const dispose = () => {
    if (disposed) return
    disposed = true
    window.clearInterval(startTimer)
    window.clearInterval(stepTimer)
    for (const id of timers) window.clearTimeout(id)
    window.removeEventListener('resize', onResize)
    veil.remove()
    if (activeFrameVeil === veil) activeFrameVeil = null
    activeFrameCleanup = null
  }
  activeFrameCleanup = dispose

  /** 播放中改窗口尺寸：重算画布并重绘当前帧，避免画面被拉伸变形 */
  const onResize = () => {
    sizeCanvas(canvas)
    drawFrame(preloadedFrames[frameAt(currentStep)])
    if (blurLayer) {
      sizeCanvas(blurLayer)
      paintBlur(blurLayer)
    }
  }
  window.addEventListener('resize', onResize)

  /** 定格帧：正向（转深色）停在黑长夜月末帧，反向（转浅色）停在白三月七起始帧 */
  const settleFrame = forward ? FRAME_COUNT : 1

  const startPlay = () => {
    stepTimer = window.setInterval(() => {
      currentStep += 1
      if (currentStep >= FRAME_COUNT) {
        window.clearInterval(stepTimer)
        return
      }
      drawFrame(preloadedFrames[frameAt(currentStep)])
    }, FRAME_INTERVAL_MS)

    // 播完所有帧后定格并虚化停留，最后整体淡出销毁，生命周期与光晕层解耦
    timers.push(
      window.setTimeout(() => {
        window.clearInterval(stepTimer)
        // 定时器有毫秒级误差：显式重绘目标角色帧，避免停在过渡帧
        drawFrame(preloadedFrames[settleFrame])

        blurLayer = document.createElement('canvas')
        blurLayer.className = 'theme-frame-canvas theme-frame-canvas--blur'
        sizeCanvas(blurLayer)
        paintBlur(blurLayer)
        veil.appendChild(blurLayer)

        veil.classList.add('is-settling')
        timers.push(
          window.setTimeout(() => {
            veil.classList.add('is-out')
            timers.push(window.setTimeout(dispose, SETTLE_FADE_MS))
          }, SETTLE_MS),
        )
      }, FRAME_COUNT * FRAME_INTERVAL_MS),
    )
  }

  // 首帧可能还没加载完（刚打开页面就点切换）：最多等 300ms，
  // 拿到首帧再播放；实在没有就只保留光晕切换，绝不在屏幕上闪一块空白
  let waited = 0
  const startTimer = window.setInterval(() => {
    if (disposed) return
    if (!drawFrame(preloadedFrames[frameAt(0)])) {
      waited += 1
      if (waited >= 6) {
        window.clearInterval(startTimer)
        dispose()
      }
      return
    }
    window.clearInterval(startTimer)
    // 强制回流后淡入，保证 opacity 过渡真正生效
    void veil.offsetHeight
    veil.classList.add('is-active')
    startPlay()
  }, 50)
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

  // 角色帧层：与光晕同时启动，白/黑三月七逐帧硬切换（z-index 更高，覆盖在其上）
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
    // 不再改写光晕背景：满屏瞬间换色会与角色帧叠成一记闪光，
    // 保持按下时的渐变直接淡出更平顺
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
