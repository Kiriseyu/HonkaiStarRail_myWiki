import { computed, ref } from 'vue'
import charactersJson from '@/data/endgame/characters.json'
import stagesJson from '@/data/endgame/stages_current.json'
import { characterMap, scoreTeam } from '@/utils/endgameScoring'
import type {
  CharactersFile,
  EndgameCharacter,
  EndgameModeId,
  EndgameModeStage,
  EndgameStagesFile,
  TeamScore,
} from '@/utils/endgameTypes'

const charactersFile = charactersJson as CharactersFile
const stagesFile = stagesJson as EndgameStagesFile

const STORAGE_KEY = 'hsr-team-builder:custom-roster:v1'
const SIZE_KEY = 'hsr-team-builder:custom-roster-size:v1'

export interface RosterPanelSize {
  width: number
  height: number
}

const MIN_W = 420
const MIN_H = 360
const MAX_W = 1400
const MAX_H = 900

function loadSize(): RosterPanelSize {
  try {
    const raw = localStorage.getItem(SIZE_KEY)
    if (!raw) return { width: 0, height: 0 }
    const o = JSON.parse(raw)
    const width = Math.max(MIN_W, Math.min(MAX_W, Number(o.width) || 0))
    const height = Math.max(MIN_H, Math.min(MAX_H, Number(o.height) || 0))
    return { width, height }
  } catch {
    return { width: 0, height: 0 }
  }
}

function saveSize(size: RosterPanelSize) {
  try {
    localStorage.setItem(SIZE_KEY, JSON.stringify(size))
  } catch {
    /* ignore */
  }
}

export interface BuildGuide {
  mainStats: string[]
  subStats: string[]
  relics: string[]
  priority: string[]
  tips: string[]
}

export interface RosterPick {
  id: string
  note?: string
}

function loadStored(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').slice(0, 4) : []
  } catch {
    return []
  }
}

function saveStored(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

// 模块级单例，保证 Dock 与父页面共享同一状态
const open = ref(false)
const query = ref('')
const elementFilter = ref('')
const pathFilter = ref('')
const selectedIds = ref<string[]>(typeof localStorage !== 'undefined' ? loadStored() : [])
const activeDetailId = ref<string | null>(selectedIds.value[0] || null)
const modeId = ref<EndgameModeId>('moc')
const stage = ref<EndgameModeStage>(stagesFile.modes.moc)
const customScore = ref<TeamScore | null>(null)
const panelSize = ref<RosterPanelSize>(
  typeof localStorage !== 'undefined' ? loadSize() : { width: 0, height: 0 },
)
const resizing = ref(false)

const characters = charactersFile.characters
const charMap = characterMap(characters)

function buildGuideFor(c: EndgameCharacter): BuildGuide {
  const roles = c.roles || []
  const tags = c.tags || []
  const path = c.path
  const isDps =
    roles.includes('主C') || roles.includes('副C') || tags.some((t) => ['对群', '对单', '爆发', '击破', 'DoT', '追加攻击', '反击'].includes(t))
  const isSupport = roles.includes('辅助') || path === '同谐' || path === '虚无'
  const isSustain = roles.includes('生存') || path === '丰饶' || path === '存护'
  const isBreak = tags.includes('击破') || tags.includes('超击破')
  const isFua = tags.includes('追加攻击') || tags.includes('欢愉')
  const isDoT = tags.includes('DoT')
  const isSummon = tags.includes('召唤') || path === '记忆'

  const mainStats: string[] = []
  const subStats: string[] = []
  const relics: string[] = []
  const priority: string[] = []
  const tips: string[] = []

  if (isBreak) {
    mainStats.push('躯干：暴击率/暴击伤害', '脚部：速度', '位面球：属性伤害', '连接绳：击破特攻')
    subStats.push('击破特攻 > 速度 > 暴击 > 攻击')
    relics.push('击破相关套装 / 速度2件套')
    priority.push('天赋/战技 > 终结技 > 普攻', '突破特攻与速度阈值优先')
    tips.push('击破环境优先保证削韧窗口，配合超击破辅助')
  } else if (isDoT) {
    mainStats.push('躯干：效果命中', '脚部：速度', '位面球：属性伤害', '连接绳：攻击/击破')
    subStats.push('效果命中 > 速度 > 攻击 > 暴击（视机制）')
    relics.push('持续伤害 / 效果命中套装')
    priority.push('战技/天赋 > 终结技', '保证 DoT 覆盖与层数')
    tips.push('与卡芙卡/海瑟音等引爆位协同，注意效果命中阈值')
  } else if (isSummon) {
    mainStats.push('躯干：暴击率/暴击伤害', '脚部：速度', '位面球：属性伤害', '连接绳：攻击/充能')
    subStats.push('暴击 > 攻击 > 速度 > 充能')
    relics.push('召唤/记忆相关或通用攻击暴击套')
    priority.push('召唤相关技能优先', '充能与拉条位配合压缩循环')
    tips.push('搭配星期日/晴歌等拉条回能收益高')
  } else if (isFua) {
    mainStats.push('躯干：暴击率/暴击伤害', '脚部：速度/攻击', '位面球：属性伤害', '连接绳：攻击')
    subStats.push('暴击 > 攻击 > 速度 > 暴伤')
    relics.push('追加攻击套装 / 通用输出套')
    priority.push('追加攻击相关 > 战技 > 终结技')
    tips.push('高频队友攻击可加速资源循环，适配欢愉环境')
  } else if (isDps) {
    mainStats.push('躯干：暴击率/暴击伤害', '脚部：速度/攻击', '位面球：属性伤害', '连接绳：攻击/充能')
    subStats.push('暴击 > 暴伤 > 攻击 > 速度')
    relics.push('通用输出四件套 + 属性伤害位面')
    priority.push('核心输出技能 > 战技 > 终结技 > 普攻')
    tips.push('保证暴击阈值后堆暴伤与攻击，再优化速度轴')
  } else if (isSupport) {
    if (path === '虚无') {
      mainStats.push('躯干：效果命中', '脚部：速度', '位面球：生命/防御', '连接绳：充能/攻击')
      subStats.push('效果命中 > 速度 > 充能 > 生存')
      relics.push('辅助减益套装 / 速度套')
      priority.push('减益覆盖技能优先', '保证命中阈值')
      tips.push('与主C弱点/机制对齐，避免浪费行动点')
    } else {
      mainStats.push('躯干：暴击伤害/治疗加成', '脚部：速度', '位面球：生命/防御', '连接绳：充能')
      subStats.push('速度 > 充能 > 生存 > 暴伤（拐）')
      relics.push('同谐辅助套 / 速度套')
      priority.push('增益/拉条技能优先', '终结技对齐主C爆发窗口')
      tips.push('注意队伍行动顺序，拉条对齐输出轴')
    }
  } else if (isSustain) {
    if (path === '存护') {
      mainStats.push('躯干/位面球/连接绳：防御/生命', '脚部：速度')
      subStats.push('防御 > 生命 > 速度 > 效果抵抗')
      relics.push('存护生存套')
      priority.push('护盾/减伤技能优先', '终结技应急')
      tips.push('保证盾覆盖，高压波次可提前开大')
    } else {
      mainStats.push('躯干：治疗加成', '脚部：速度', '位面球：生命', '连接绳：充能')
      subStats.push('治疗 > 生命 > 速度 > 充能')
      relics.push('丰饶治疗套')
      priority.push('治疗/解控优先', '大招应对点名/控场')
      tips.push('解控与群奶优先级高，注意回合差')
    }
  } else {
    mainStats.push('速度 > 生存词条优先')
    subStats.push('按定位补足生存与辅助词条')
    relics.push('通用生存/辅助套')
    priority.push('保证生存循环后再补输出')
    tips.push('可参考同定位五星角色构筑')
  }

  if (c.rarity === 4) {
    tips.push('四星注意命座与专属光锥上限，优先保证机制完整')
  }
  if (c.strength >= 92) {
    tips.push('当前环境泛用度较高，可优先投入资源')
  }

  return { mainStats, subStats, relics, priority, tips }
}

export function useCustomRoster() {
  const elements = computed(() => [...new Set(characters.map((c) => c.element))].sort())
  const paths = computed(() => [...new Set(characters.map((c) => c.path))].sort())

  const filtered = computed(() => {
    const q = query.value.trim().toLowerCase()
    return characters
      .filter((c) => {
        if (elementFilter.value && c.element !== elementFilter.value) return false
        if (pathFilter.value && c.path !== pathFilter.value) return false
        if (!q) return true
        return (
          c.name.toLowerCase().includes(q) ||
          c.id.includes(q) ||
          c.element.includes(q) ||
          c.path.includes(q) ||
          (c.tags || []).some((t) => t.toLowerCase().includes(q))
        )
      })
      .slice()
      .sort((a, b) => (b.strength || 0) - (a.strength || 0))
  })

  const selectedChars = computed(() =>
    selectedIds.value.map((id) => charMap[id]).filter(Boolean) as EndgameCharacter[],
  )

  const activeDetail = computed(() =>
    activeDetailId.value ? charMap[activeDetailId.value] || null : null,
  )

  const activeGuide = computed(() =>
    activeDetail.value ? buildGuideFor(activeDetail.value) : null,
  )

  function setStageContext(mode: EndgameModeId, stageData: EndgameModeStage) {
    modeId.value = mode
    stage.value = stageData
    rescore()
  }

  function rescore() {
    if (selectedChars.value.length < 4) {
      customScore.value = null
      return
    }
    customScore.value = scoreTeam(selectedChars.value, stage.value, modeId.value, undefined, undefined)
  }

  function togglePick(id: string) {
    const idx = selectedIds.value.indexOf(id)
    if (idx >= 0) {
      selectedIds.value = selectedIds.value.filter((x) => x !== id)
      if (activeDetailId.value === id) activeDetailId.value = selectedIds.value[0] || null
    } else {
      const next = [...selectedIds.value]
      if (next.length >= 4) next.shift()
      next.push(id)
      selectedIds.value = next
      activeDetailId.value = id
    }
    saveStored(selectedIds.value)
    rescore()
  }

  function removePick(id: string) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
    saveStored(selectedIds.value)
    rescore()
  }

  function clearPicks() {
    selectedIds.value = []
    activeDetailId.value = null
    saveStored([])
    rescore()
  }

  function openDetail(id: string) {
    activeDetailId.value = id
  }

  function toggleOpen() {
    open.value = !open.value
  }

  function beginResize(
    mode: 'ne' | 'e' | 's',
    event: PointerEvent,
    panelEl: HTMLElement,
  ) {
    if (window.matchMedia('(max-width: 768px)').matches) return

    event.preventDefault()
    ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
    const startX = event.clientX
    const startY = event.clientY
    const startW = panelSize.value.width || panelEl.offsetWidth
    const startH = panelSize.value.height || panelEl.offsetHeight
    resizing.value = true
    document.body.style.userSelect = 'none'
    document.body.style.cursor =
      mode === 'e' ? 'ew-resize' : mode === 's' ? 'ns-resize' : 'nesw-resize'

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      let w = startW
      let h = startH
      // 右上角：右拖加宽，上拉加高（底边固定）
      if (mode === 'e' || mode === 'ne') w = startW + dx
      if (mode === 's' || mode === 'ne') h = startH - dy
      const maxW = Math.min(MAX_W, window.innerWidth - 24)
      const maxH = Math.min(MAX_H, window.innerHeight - 96)
      const nextW = Math.round(Math.max(MIN_W, Math.min(maxW, w)))
      const nextH = Math.round(Math.max(MIN_H, Math.min(maxH, h)))
      panelSize.value = {
        width: mode === 's' ? startW : nextW,
        height: mode === 'e' ? startH : nextH,
      }
    }

    const onUp = () => {
      resizing.value = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      saveSize(panelSize.value)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function resetPanelSize() {
    panelSize.value = { width: 0, height: 0 }
    saveSize(panelSize.value)
  }

  rescore()

  return {
    open,
    query,
    elementFilter,
    pathFilter,
    selectedIds,
    selectedChars,
    activeDetailId,
    activeDetail,
    activeGuide,
    filtered,
    elements,
    paths,
    customScore,
    panelSize,
    resizing,
    setStageContext,
    togglePick,
    removePick,
    clearPicks,
    openDetail,
    toggleOpen,
    beginResize,
    resetPanelSize,
  }
}
