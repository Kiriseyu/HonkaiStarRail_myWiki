import { slugFromScannerName } from '@/data/scannerNameMap'

/** reliquary_archiver / hsr-optimizer 兼容的扫描器导出结构（子集） */
export interface ScannerCharacter {
  id: string
  name: string
  path: string
  level: number
  ascension: number
  eidolon: number
  skills?: { basic?: number; skill?: number; ult?: number; talent?: number }
  traces?: Record<string, boolean>
}

export interface ScannerLightCone {
  id: string
  name: string
  level: number
  ascension: number
  superimposition: number
  location?: string
}

export interface ScannerRelicSubstat {
  key: string
  value: number
  count: number
  step: number
}

export interface ScannerRelic {
  set_id: string
  name: string
  slot: string
  rarity: number
  level: number
  mainstat: string
  substats: ScannerRelicSubstat[]
  location?: string
  lock?: boolean
}

export interface ScannerMaterial {
  id: string
  name: string
  count: number
}

export interface ScannerSave {
  source?: string
  build?: string
  version?: number
  metadata?: { uid?: number; trailblazer?: string }
  characters?: ScannerCharacter[]
  light_cones?: ScannerLightCone[]
  relics?: ScannerRelic[]
  materials?: ScannerMaterial[]
  gacha?: { stellar_jade?: number; oneric_shards?: number }
}

export interface OwnedCharacter {
  slug: string
  scannerName: string
  level: number
  ascension: number
  eidolon: number
  traceOpened: number
  skillLevels: number
}

export interface ImportedRoster {
  uid?: number
  owned: OwnedCharacter[]
  ownedSlugs: Set<string>
  lightConeCount: number
  relicCount: number
  stellarJade: number
  specialPass: number
  standardPass: number
  unknownNames: string[]
  importedAt: string
}

const STORAGE_KEY = 'hsr-team-builder:scanner-roster:v1'

function countTraces(traces?: Record<string, boolean>): number {
  if (!traces) return 0
  return Object.values(traces).filter(Boolean).length
}

function sumSkills(skills?: ScannerCharacter['skills']): number {
  if (!skills) return 0
  return (skills.basic || 0) + (skills.skill || 0) + (skills.ult || 0) + (skills.talent || 0)
}

export function parseScannerSave(raw: string | ScannerSave): ImportedRoster {
  const data: ScannerSave = typeof raw === 'string' ? JSON.parse(raw) : raw
  const owned: OwnedCharacter[] = []
  const unknownNames: string[] = []
  const ownedSlugs = new Set<string>()

  for (const c of data.characters || []) {
    const slug = slugFromScannerName(c.name)
    if (!slug) {
      unknownNames.push(c.name)
      continue
    }
    if (ownedSlugs.has(slug)) continue
    ownedSlugs.add(slug)
    owned.push({
      slug,
      scannerName: c.name,
      level: c.level || 0,
      ascension: c.ascension || 0,
      eidolon: c.eidolon || 0,
      traceOpened: countTraces(c.traces),
      skillLevels: sumSkills(c.skills),
    })
  }

  const materials = data.materials || []
  const pass = (name: string) => materials.find((m) => m.name === name)?.count || 0

  return {
    uid: data.metadata?.uid,
    owned,
    ownedSlugs,
    lightConeCount: (data.light_cones || []).length,
    relicCount: (data.relics || []).length,
    stellarJade: data.gacha?.stellar_jade || 0,
    specialPass: pass('Star Rail Special Pass'),
    standardPass: pass('Star Rail Pass'),
    unknownNames,
    importedAt: new Date().toISOString(),
  }
}

/** 0–1：练度折扣，用于校正理论 strength */
export function buildReadiness(owned: OwnedCharacter | undefined): number {
  if (!owned) return 0.55
  const levelPart = Math.min(1, owned.level / 80)
  const eidolonPart = Math.min(1, owned.eidolon / 6)
  const tracePart = Math.min(1, owned.traceOpened / 14)
  return levelPart * 0.35 + eidolonPart * 0.35 + tracePart * 0.3
}

export function effectiveStrength(theory: number, owned?: OwnedCharacter): number {
  const ready = buildReadiness(owned)
  return Math.round(theory * (0.75 + 0.25 * ready) * 10) / 10
}

export function saveRoster(roster: ImportedRoster | null) {
  try {
    if (!roster) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    const serializable = {
      ...roster,
      ownedSlugs: Array.from(roster.ownedSlugs),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
  } catch {
    /* ignore */
  }
}

export function loadRoster(): ImportedRoster | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Omit<ImportedRoster, 'ownedSlugs'> & { ownedSlugs: string[] }
    return {
      ...parsed,
      ownedSlugs: new Set(parsed.ownedSlugs || []),
    }
  } catch {
    return null
  }
}

export function clearRoster() {
  saveRoster(null)
}
