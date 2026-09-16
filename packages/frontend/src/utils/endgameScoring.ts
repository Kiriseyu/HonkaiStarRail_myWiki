import type {
  EndgameCharacter,
  EndgameModeId,
  EndgameModeStage,
  MaterializedTeam,
  TeamScore,
  TeamTemplate,
  TeamSlot,
} from './endgameTypes'

const WEIGHTS = {
  weakness: 0.4,
  mechanic: 0.3,
  mode: 0.2,
  buff: 0.1,
} as const

const MODE_TAG_WEIGHT: Record<EndgameModeId, Record<string, number>> = {
  moc: { burst: 1, aoe: 0.55, break: 0.7, fua: 0.75, dot: 0.6, summon: 0.7, sustain: 0.95 },
  pf: { burst: 0.55, aoe: 1, break: 0.45, fua: 0.95, dot: 0.8, summon: 0.7, sustain: 0.6 },
  as: { burst: 0.85, aoe: 0.45, break: 1, fua: 0.55, dot: 0.4, summon: 0.6, sustain: 0.7 },
  aa: { burst: 0.9, aoe: 0.7, break: 0.65, fua: 0.7, dot: 0.65, summon: 0.65, sustain: 0.9 },
}

const MODE_KEY_TAGS: Record<string, string[]> = {
  burst: ['爆发', '终结技', '再动', '变身'],
  aoe: ['对群', '清杂'],
  break: ['击破', '超击破', '削韧'],
  fua: ['追加攻击', '协奏'],
  dot: ['DoT'],
  summon: ['召唤', '记忆', '神君'],
  sustain: ['生存'],
}

const TAG_ALIASES: Record<string, string[]> = {
  击破: ['击破', '超击破', '削韧'],
  超击破: ['超击破', '击破'],
  削韧: ['削韧', '击破', '超击破'],
  对单: ['对单'],
  对群: ['对群', '清杂'],
  清杂: ['清杂', '对群'],
  爆发: ['爆发', '终结技', '再动', '变身'],
  终结技: ['终结技', '爆发'],
  追加攻击: ['追加攻击', '协奏'],
  DoT: ['DoT', '引爆', '奥迹'],
  召唤: ['召唤', '记忆', '神君'],
  治疗: ['治疗', '生存'],
  护盾: ['护盾', '分摊', '生存'],
  分摊: ['分摊', '生存'],
  生存: ['生存', '治疗', '护盾', '分摊', '复活', '解控', '净化'],
  植入弱点: ['植入弱点', '减防', '易伤'],
  减防: ['减防', '易伤', '植入弱点'],
  易伤: ['易伤', '减防'],
  拉条: ['拉条', '全队拉条', '再动'],
  充能: ['充能', '回能'],
  产点: ['产点'],
  再动: ['再动', '收割', '爆发'],
  反击: ['反击', '受击'],
  生命转伤: ['生命转伤'],
  真实伤害: ['真实伤害'],
  记忆: ['记忆', '召唤'],
  协奏: ['协奏', '追加攻击'],
  暴击拐: ['暴击拐'],
  净化: ['净化', '解控', '生存'],
  解控: ['解控', '净化', '生存'],
  回能: ['回能', '充能', '终结技'],
}

const ROLE_TAGS: Record<string, string[]> = {
  主C: ['对单', '对群', '爆发', '击破', '追加攻击', 'DoT', '反击', '再动', '召唤', '生命转伤', '终结技', '超击破', '生存'],
  副C: ['对群', '追加攻击', 'DoT', '击破', '对单'],
  核心: ['DoT', '对群', '引爆'],
  辅助: [
    '拉条',
    '充能',
    '爆伤',
    '易伤',
    '减防',
    '击破',
    '超击破',
    '加速',
    '产点',
    '植入弱点',
    '抗性穿透',
    '效率',
    '全队拉条',
    '协奏',
    '终结技',
  ],
  削韧: ['削韧', '击破', '植入弱点'],
  生存: ['生存', '治疗', '护盾', '分摊', '净化', '解控', '复活', '暴击拐', '终结技'],
  击破: ['击破', '超击破', '削韧'],
}

export function characterMap(characters: EndgameCharacter[]): Record<string, EndgameCharacter> {
  const map: Record<string, EndgameCharacter> = {}
  characters.forEach((c) => {
    map[c.id] = c
  })
  return map
}

function expandTags(tags: string[] | undefined): Set<string> {
  const out = new Set<string>()
  ;(tags || []).forEach((tag) => {
    out.add(tag)
    ;(TAG_ALIASES[tag] || []).forEach((a) => out.add(a))
  })
  return out
}

function teamTagSet(characters: EndgameCharacter[]): Set<string> {
  const set = new Set<string>()
  characters.forEach((c) => {
    expandTags(c.tags).forEach((t) => set.add(t))
    ;(c.roles || []).forEach((role) => {
      ;(ROLE_TAGS[role] || []).forEach((t) => set.add(t))
    })
    if (['同谐', '虚无', '丰饶', '存护', '记忆', '欢愉'].includes(c.path)) set.add('终结技')
    if (['丰饶', '存护'].includes(c.path)) set.add('生存')
    if (c.path === '欢愉') {
      set.add('追加攻击')
      set.add('协奏')
    }
    if ((c.roles || []).includes('生存')) set.add('生存')
  })
  return set
}

function hasAnyTag(teamTags: Set<string>, key: string): boolean {
  const aliases = expandTags([key])
  let hit = false
  aliases.forEach((a) => {
    if (teamTags.has(a)) hit = true
  })
  return hit
}

function scoreAgainstPool(characters: EndgameCharacter[], pool: Set<string>) {
  const covered = new Set<string>()
  characters.forEach((c) => {
    if (pool.has(c.element)) covered.add(c.element)
  })
  const hasWolf = characters.some((c) => c.id === 'silver-wolf')
  const n = covered.size
  let score = 0
  score += Math.min(n, 3) * 24
  score += Math.min(Math.max(n - 3, 0), 2) * 6
  if (hasWolf) score += 12
  const elements = new Set(characters.map((c) => c.element))
  score += Math.min(elements.size, 4) * 2
  return {
    score: Math.min(100, score),
    covered: Array.from(covered),
    pool: Array.from(pool),
    hasWeaknessPlant: hasWolf,
  }
}

function scoreWeakness(
  characters: EndgameCharacter[],
  stage: EndgameModeStage,
  template?: TeamTemplate,
  side?: string,
) {
  const entries = (stage.nodes || []).map((node) => {
    const p = new Set<string>(node.weaknessPool || [])
    ;(node.enemies || []).forEach((e) => {
      ;(e.weaknesses || []).forEach((w) => p.add(w))
    })
    return { side: node.side, pool: p }
  })
  if (!entries.length && stage.weaknessPool) {
    entries.push({ side: '', pool: new Set(stage.weaknessPool) })
  }

  let best = { score: 0, covered: [] as string[], pool: [] as string[], hasWeaknessPlant: false }
  let bestApplicable = 0
  let sum = 0
  entries.forEach((entry) => {
    const r = scoreAgainstPool(characters, entry.pool)
    sum += r.score
    const suitable =
      !template?.suitableSides?.length || template.suitableSides.includes(entry.side)
    if (r.score > best.score) best = r
    if (suitable && r.score > bestApplicable) bestApplicable = r.score
  })
  const avg = sum / Math.max(entries.length, 1)
  if (side) {
    const target = entries.find((e) => e.side === side)
    if (target) best = scoreAgainstPool(characters, target.pool)
  } else {
    best.score = bestApplicable * 0.7 + avg * 0.3
  }
  best.score = Math.round(best.score * 10) / 10
  return best
}

function scoreMechanic(characters: EndgameCharacter[], stage: EndgameModeStage) {
  const teamTags = teamTagSet(characters)
  const rawNeeded = stage.requiredMechanics || []
  if (!rawNeeded.length) return { score: 70, hit: [] as string[], miss: [] as string[] }

  let hit = 0
  const hits: string[] = []
  const miss: string[] = []
  rawNeeded.forEach((tag) => {
    if (hasAnyTag(teamTags, tag)) {
      hit += 1
      hits.push(tag)
    } else {
      miss.push(tag)
    }
  })
  let ratio = hit / rawNeeded.length
  if (hit >= rawNeeded.length - 1) ratio = Math.max(ratio, 0.82)
  if (hit >= 2 && rawNeeded.length >= 3) ratio = Math.max(ratio, 0.7)
  return {
    score: Math.round(Math.min(100, ratio * 100) * 10) / 10,
    hit: hits,
    miss,
  }
}

function scoreMode(characters: EndgameCharacter[], modeId: EndgameModeId, template?: TeamTemplate) {
  const weights = MODE_TAG_WEIGHT[modeId] || MODE_TAG_WEIGHT.moc
  const teamTags = teamTagSet(characters)

  let weighted = 0
  let maxWeight = 0
  Object.keys(weights).forEach((key) => {
    const w = weights[key]
    maxWeight += w
    const keys = MODE_KEY_TAGS[key] || [key]
    if (keys.some((k) => hasAnyTag(teamTags, k))) weighted += w
  })
  const ratio = weighted / maxWeight

  const avgStrength =
    characters.reduce((s, c) => s + (c.strength || 80), 0) / Math.max(characters.length, 1)
  const strengthPart = Math.min(1, avgStrength / 95)

  let systemPart = 0.75
  if (template?.focusTags?.length) {
    const hit = template.focusTags.filter((tag) => hasAnyTag(teamTags, tag)).length
    systemPart = hit / template.focusTags.length
  }

  const fullPart = Math.min(1, characters.length / 4)
  const raw = ratio * 0.42 + strengthPart * 0.22 + systemPart * 0.22 + fullPart * 0.14
  return Math.round(Math.min(1, raw) * 1000) / 10
}

function scoreBuff(characters: EndgameCharacter[], stage: EndgameModeStage) {
  const buffTags = stage.buff?.tags || []
  if (!buffTags.length) return { score: 55, benefit: [] as string[] }

  let matchedSlots = 0
  const benefit = new Set<string>()
  characters.forEach((c) => {
    const tags = expandTags(c.tags)
    let local = false
    buffTags.forEach((t) => {
      if (hasAnyTag(tags, t)) {
        local = true
        benefit.add(t)
      }
    })
    if (!local) {
      if (
        buffTags.includes('终结技') &&
        ['毁灭', '巡猎', '智识', '同谐', '虚无', '记忆'].includes(c.path)
      ) {
        local = true
        benefit.add('终结技')
      }
      if (buffTags.includes('击破') && (c.roles || []).includes('击破')) {
        local = true
        benefit.add('击破')
      }
      if (buffTags.includes('对群') && hasAnyTag(expandTags(c.tags), '对群')) {
        local = true
        benefit.add('对群')
      }
      if (buffTags.includes('追加攻击') && hasAnyTag(expandTags(c.tags), '追加攻击')) {
        local = true
        benefit.add('追加攻击')
      }
      if (buffTags.includes('智识') && c.path === '智识') {
        local = true
        benefit.add('智识')
      }
      if (buffTags.includes('削韧') && hasAnyTag(expandTags(c.tags), '削韧')) {
        local = true
        benefit.add('削韧')
      }
      if (buffTags.includes('速攻') && hasAnyTag(expandTags(c.tags), '击破')) {
        local = true
        benefit.add('速攻')
      }
      if (buffTags.includes('三队') || buffTags.includes('不重叠')) {
        local = true
        benefit.add('泛用')
      }
    }
    if (local) matchedSlots += 1
  })

  const coverage = matchedSlots / Math.max(characters.length, 1)
  const score = Math.min(100, 35 + coverage * 55 + Math.min(benefit.size, 3) * 3)
  return { score: Math.round(score * 10) / 10, benefit: Array.from(benefit) }
}

export function gradeFromScore(total: number): string {
  if (total >= 88) return 'S'
  if (total >= 80) return 'A'
  if (total >= 70) return 'B'
  if (total >= 58) return 'C'
  return 'D'
}

export function scoreTeam(
  characters: EndgameCharacter[],
  stage: EndgameModeStage,
  modeId: EndgameModeId,
  template?: TeamTemplate,
  side?: string,
): TeamScore {
  const weak = scoreWeakness(characters, stage, template, side)
  const mech = scoreMechanic(characters, stage)
  const mode = scoreMode(characters, modeId, template)
  const buff = scoreBuff(characters, stage)

  const total =
    weak.score * WEIGHTS.weakness +
    mech.score * WEIGHTS.mechanic +
    mode * WEIGHTS.mode +
    buff.score * WEIGHTS.buff
  const rounded = Math.round(total * 10) / 10

  return {
    total: rounded,
    grade: gradeFromScore(rounded),
    breakdown: {
      weakness: { score: weak.score, weight: WEIGHTS.weakness },
      mechanic: { score: mech.score, weight: WEIGHTS.mechanic },
      mode: { score: mode, weight: WEIGHTS.mode },
      buff: { score: buff.score, weight: WEIGHTS.buff },
    },
  }
}

export function materializeTeam(
  template: TeamTemplate,
  charMap: Record<string, EndgameCharacter>,
  stage: EndgameModeStage,
  modeId: EndgameModeId,
): MaterializedTeam | null {
  const ids = template.slots.map((slot) => {
    const def = slot.candidates.find((c) => c.default) || slot.candidates[0]
    return def.id
  })
  const chars = ids.map((id) => charMap[id]).filter(Boolean)
  if (chars.length < 4) return null

  const scored = scoreTeam(chars, stage, modeId, template)

  const slots: TeamSlot[] = template.slots.map((slot, idx) => {
    const selectedId = ids[idx]
    const ch = charMap[selectedId]
    const nextAlts: TeamSlot['candidates'] = []

    if (ch) {
      nextAlts.push({
        id: ch.id,
        name: ch.name,
        element: ch.element,
        path: ch.path,
        rarity: ch.rarity,
        role: '主选',
        cost: '当前为综合最优主选',
      })
      ;(ch.replacements || []).forEach((r) => {
        const target = charMap[r.id]
        if (!target || nextAlts.some((x) => x.id === target.id)) return
        nextAlts.push({
          id: target.id,
          name: target.name,
          element: target.element,
          path: target.path,
          rarity: target.rarity,
          role: r.role,
          cost: r.cost,
        })
      })
    }

    const rank: Record<string, number> = {
      同体系下位: 0,
      同属性不同角色: 1,
      跨体系替代: 2,
      主选回退: 3,
    }
    const extra = slot.candidates
      .map((c) => {
        const target = charMap[c.id]
        if (!target || nextAlts.some((x) => x.id === target.id)) return null
        return {
          id: target.id,
          name: target.name,
          element: target.element,
          path: target.path,
          rarity: target.rarity,
          role: c.default ? '主选回退' : '跨体系替代',
          cost: '切换后需重新评估机制契合',
        }
      })
      .filter(Boolean) as TeamSlot['candidates']

    extra.sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9))
    nextAlts.push(...extra)

    return {
      role: slot.role,
      selectedId,
      candidates: nextAlts,
      penaltyText: null,
    }
  })

  return {
    templateId: template.id,
    name: template.name,
    system: template.system,
    coreMechanic: template.coreMechanic,
    notes: template.notes || [],
    suitableSides: template.suitableSides || [],
    score: scored,
    slots,
  }
}

export function recommendTeams(
  stage: EndgameModeStage,
  modeId: EndgameModeId,
  templates: TeamTemplate[],
  characters: EndgameCharacter[],
  options?: { side?: string; limit?: number },
): MaterializedTeam[] {
  const charMap = characterMap(characters)
  const opts = options || {}

  let list = templates
    .filter((t) => (t.modes || []).includes(modeId))
    .map((t) => {
      const team = materializeTeam(t, charMap, stage, modeId)
      if (!team) return null
      if (opts.side) {
        const chars = team.slots.map((s) => charMap[s.selectedId]).filter(Boolean)
        team.score = scoreTeam(chars, stage, modeId, t, opts.side)
      }
      return team
    })
    .filter(Boolean) as MaterializedTeam[]

  if (opts.side) {
    list.sort((a, b) => {
      const ap = a.suitableSides.includes(opts.side!) ? 0 : 1
      const bp = b.suitableSides.includes(opts.side!) ? 0 : 1
      if (ap !== bp) return ap - bp
      return b.score.total - a.score.total
    })
  } else {
    list.sort((a, b) => b.score.total - a.score.total)
  }

  if (modeId === 'aa') {
    const picked: MaterializedTeam[] = []
    const used = new Set<string>()
    list.forEach((team) => {
      if (picked.length >= 3) return
      const ids = team.slots.map((s) => s.selectedId)
      if (!ids.some((id) => used.has(id))) {
        picked.push(team)
        ids.forEach((id) => used.add(id))
      }
    })
    list.forEach((team) => {
      if (picked.length >= 3 && !picked.includes(team)) picked.push(team)
    })
    return picked.slice(0, 3)
  }

  return list.slice(0, opts.limit || 5)
}
