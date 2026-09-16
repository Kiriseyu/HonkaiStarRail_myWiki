import { computed, ref, watch } from 'vue'
import charactersJson from '@/data/endgame/characters.json'
import stagesJson from '@/data/endgame/stages_current.json'
import teamsMetaJson from '@/data/endgame/teams_meta.json'
import {
  characterMap,
  recommendTeams,
  scoreTeam,
} from '@/utils/endgameScoring'
import type {
  CharactersFile,
  EndgameCharacter,
  EndgameModeId,
  EndgameModeStage,
  MaterializedTeam,
  TeamsMetaFile,
  EndgameStagesFile,
} from '@/utils/endgameTypes'

const charactersFile = charactersJson as CharactersFile
const stagesFile = stagesJson as EndgameStagesFile
const teamsMetaFile = teamsMetaJson as TeamsMetaFile

export function useEndgameTeams() {
  const characters = charactersFile.characters
  const charMap = characterMap(characters)
  const templates = teamsMetaFile.templates

  const modeId = ref<EndgameModeId>('moc')
  const side = ref('')
  const teams = ref<MaterializedTeam[]>([])

  const meta = computed(() => stagesFile.meta)
  const currentStage = computed<EndgameModeStage>(() => stagesFile.modes[modeId.value])

  const modeOptions = computed(() =>
    (['moc', 'pf', 'as', 'aa'] as EndgameModeId[]).map((id) => {
      const m = stagesFile.modes[id]
      return { id, label: m.label, short: m.short, round: m.round }
    }),
  )

  const sideOptions = computed(() => currentStage.value.nodes.map((n) => n.side))

  function recompute() {
    teams.value = recommendTeams(currentStage.value, modeId.value, templates, characters, {
      side: side.value || undefined,
      limit: 8,
    })
  }

  function setMode(id: EndgameModeId) {
    modeId.value = id
    side.value = ''
  }

  function onSwap(teamIndex: number, slotIndex: number, newId: string) {
    const team = teams.value[teamIndex]
    if (!team) return
    const oldId = team.slots[slotIndex].selectedId
    if (oldId === newId) return

    const oldChar = charMap[oldId]
    const newChar = charMap[newId]
    let costText = '切换后需重新评估机制契合'
    if (oldChar?.replacements) {
      const r = oldChar.replacements.find((x) => x.id === newId)
      if (r) costText = r.cost
      else if (oldChar.strength && newChar) {
        const delta = oldChar.strength - newChar.strength
        if (delta > 0) costText = `综合强度约降低 ${Math.min(45, Math.round(delta * 1.1))}%`
        else if (delta < 0) costText = `综合强度约提升 ${Math.min(20, Math.round(-delta * 0.8))}%`
        else costText = '强度接近，注意机制契合差异'
      }
    }

    team.slots[slotIndex].selectedId = newId
    team.slots[slotIndex].penaltyText = costText

    const template = templates.find((t) => t.id === team.templateId)
    const chars = team.slots.map((s) => charMap[s.selectedId]).filter(Boolean) as EndgameCharacter[]
    team.score = scoreTeam(chars, currentStage.value, modeId.value, template, side.value || undefined)

    const nextAlts: MaterializedTeam['slots'][0]['candidates'] = []
    if (newChar) {
      nextAlts.push({
        id: newChar.id,
        name: newChar.name,
        element: newChar.element,
        path: newChar.path,
        rarity: newChar.rarity,
        role: '主选',
        cost: '当前为综合最优主选',
      })
      ;(newChar.replacements || []).forEach((r) => {
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
    template?.slots[slotIndex]?.candidates?.forEach((c) => {
      const target = charMap[c.id]
      if (!target || nextAlts.some((x) => x.id === target.id)) return
      nextAlts.push({
        id: target.id,
        name: target.name,
        element: target.element,
        path: target.path,
        rarity: target.rarity,
        role: '跨体系替代',
        cost: '切换后需重新评估机制契合',
      })
    })
    team.slots[slotIndex].candidates = nextAlts
    teams.value = [...teams.value]
  }

  function resetTeams() {
    side.value = ''
    recompute()
  }

  function buildShareText(): string {
    const stage = currentStage.value
    const lines = [
      '【崩坏：星穹铁道】当期高难配队分享',
      `${meta.value.version} · ${stage.label} ${stage.round}`,
      `关卡Buff：${stage.buff.title} — ${stage.buff.desc}`,
      meta.value.disclaimer,
      '',
    ]
    teams.value.forEach((team, i) => {
      lines.push(`${i + 1}. ${team.name} [${team.score.grade} / ${team.score.total.toFixed(1)}]`)
      lines.push(
        `   ${team.slots
          .map((s) => {
            const ch = charMap[s.selectedId]
            return `${ch ? ch.name : s.selectedId}·${s.role}`
          })
          .join(' | ')}`,
      )
      lines.push(`   ${team.coreMechanic}`)
      lines.push('')
    })
    return lines.join('\n')
  }

  watch([modeId, side], recompute)
  recompute()

  return {
    meta,
    modeId,
    side,
    teams,
    currentStage,
    modeOptions,
    sideOptions,
    setMode,
    onSwap,
    resetTeams,
    buildShareText,
  }
}
