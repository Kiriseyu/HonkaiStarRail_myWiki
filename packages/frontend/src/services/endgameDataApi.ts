/**
 * 数据接入空接口（预留）
 * 当前高难配队使用本地 JSON；后续可改为 API。
 */

export interface EndgameDataApi {
  /** 当期关卡（MoC/PF/AS/AA） */
  getStages(): Promise<unknown>
  /** 角色列表 */
  getCharacters(): Promise<unknown>
  /** 配队模板 */
  getTeamTemplates(): Promise<unknown>
  /** 角色构筑/素材 */
  getCharacterBuilds(): Promise<unknown>
}

/** 默认实现：尚未接入远程 API 时抛错，由调用方回落到本地 JSON */
export function createRemoteEndgameDataApi(baseUrl: string): EndgameDataApi {
  const get = async (path: string) => {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`)
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
    return res.json()
  }

  return {
    getStages: () => get('/endgame/stages'),
    getCharacters: () => get('/characters'),
    getTeamTemplates: () => get('/endgame/team-templates'),
    getCharacterBuilds: () => get('/endgame/character-builds'),
  }
}

/** 占位：导入远程数据失败或未配置时的空结果 */
export const emptyRemoteData = {
  stages: null,
  characters: null,
  teamTemplates: null,
  characterBuilds: null,
} as const
