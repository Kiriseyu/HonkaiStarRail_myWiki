export type EndgameModeId = 'moc' | 'pf' | 'as' | 'aa'

export interface EndgameCharacter {
  id: string
  name: string
  element: string
  path: string
  rarity: number
  roles: string[]
  tags: string[]
  strength: number
  replacements?: Array<{ id: string; role: string; cost: string }>
}

export interface EndgameEnemy {
  name: string
  weaknesses: string[]
  mechanics: string[]
  hpNote: string
}

export interface EndgameNode {
  side: string
  enemies: EndgameEnemy[]
  weaknessPool: string[]
}

export interface EndgameModeStage {
  id: EndgameModeId
  label: string
  short: string
  period: string
  round: string
  buff: { title: string; desc: string; tags: string[] }
  scoreLines: {
    stars: Array<{ stars: number; condition: string }>
    target: string
  }
  requiredMechanics: string[]
  weaknessPool: string[]
  nodes: EndgameNode[]
}

export interface EndgameStagesFile {
  meta: {
    version: string
    period: string
    updatedAt: string
    disclaimer: string
    sources?: string[]
    confidence?: string
  }
  modes: Record<EndgameModeId, EndgameModeStage>
}

export interface TeamSlotCandidate {
  id: string
  name: string
  element: string
  path: string
  rarity: number
  role: string
  cost: string
}

export interface TeamSlot {
  role: string
  selectedId: string
  candidates: TeamSlotCandidate[]
  penaltyText?: string | null
}

export interface TeamScoreBreakdownItem {
  score: number
  weight: number
}

export interface TeamScore {
  total: number
  grade: string
  breakdown: {
    weakness: TeamScoreBreakdownItem
    mechanic: TeamScoreBreakdownItem
    mode: TeamScoreBreakdownItem
    buff: TeamScoreBreakdownItem
  }
}

export interface MaterializedTeam {
  templateId: string
  name: string
  system: string
  coreMechanic: string
  notes: string[]
  suitableSides: string[]
  score: TeamScore
  slots: TeamSlot[]
}

export interface TeamTemplateSlot {
  role: string
  candidates: Array<{ id: string; default?: boolean }>
}

export interface TeamTemplate {
  id: string
  name: string
  system: string
  coreMechanic: string
  modes: EndgameModeId[]
  suitableSides: string[]
  focusTags: string[]
  notes: string[]
  slots: TeamTemplateSlot[]
}

export interface TeamsMetaFile {
  meta: { note: string; updatedAt: string }
  templates: TeamTemplate[]
}

export interface CharactersFile {
  meta: { updatedAt: string; note: string }
  characters: EndgameCharacter[]
}
