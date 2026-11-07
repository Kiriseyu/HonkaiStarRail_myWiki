# 项目交接手册（2026-11-07）

供新窗口 / 后续开发继续维护使用。本文件是**当前状态快照**，不是历史存档。

## 1. 仓库与路径

| 项 | 路径 |
| --- | --- |
| 本项目根目录 | `F:\Downloaded\AI_Project\HonkaiStarRail` |
| 前端 | `packages/frontend`（Vue 3 + Vite，默认端口 5174） |
| 后端（可选） | `packages/backend`（NestJS + PG/Redis） |
| 共享类型 | `packages/shared` |
| 端点页面 | `/` 与 `/endgame` 均渲染 `EndgameTeamsView.vue` |
| 端点静态数据 | `packages/frontend/src/data/endgame/` |
| 角色录入规范 | `docs/CHARACTER_ADDITIONS.md` |
| 扫描器对接分析 | `docs/SCANNER_INTEGRATION.md` |
| 本交接文档 | `docs/PROJECT_HANDOFF.md` |

### 外部依赖（只读参考，勿改）

| 资源 | 路径 | 用途 |
| --- | --- | --- |
| 扫描器导出样例 | `F:\Downloaded\HonkaiStarRailScanner\御星凌月.json` | reliquary_archiver 0.18.0；导入测试数据源 |
| HSR 优化器 | `F:\Downloaded\HonkaiStarRailScanner\hsr-optimizer-main` | `src/data/game_data.json`：角色面板/光锥叠影权威值 |
| 扫描器 exe | `F:\Downloaded\HonkaiStarRailScanner\reliquary-archiver-pktmon-x64.exe` | 可再导出账号 JSON |

## 2. 当前功能现状

主页面 `/endgame`（`EndgameTeamsView.vue`）侧栏 + 主区：

| 功能块 | 文件 | 状态 |
| --- | --- | --- |
| 当期关卡 / Buff / 评分线 | `data/endgame/stages_current.json` | 已有；数据仍为 2026-09-29 核查版（4.5/4.6 初），4.7 上线后需刷新 |
| 自动评分配队 | `utils/endgameScoring.ts` + `composables/useEndgameTeams.ts` | 已有；**新增按扫描器练度校正 strength** |
| 角色简评 · 养成 | `components/CharacterGuidePanel.vue` | 已有（93 角色构筑） |
| 我的角色（手选 4 人） | `composables/useCustomRoster.ts` + `CustomRosterDock.vue` | 已有，localStorage |
| **账号存档（扫描器导入）** | `components/ScannerRosterPanel.vue` + `utils/scannerImport.ts` | 已有 |
| **当前卡池 + 抽卡资源** | `components/BannerPanel.vue` + `data/endgame/banners_current.json` | 已有；2026-11-07 更新到 4.6 收尾 + 4.7 前瞻 |
| 远程 API | `services/endgameDataApi.ts` | 仍是占位，前端用静态 JSON |

> 更新说明：本快照只刷新版本 / 卡池与时间信息；关卡、角色、构筑、队伍数据未重新核查，见第 3、9 节。

## 3. 最新改动（2026-11-07）

### 修改

- `packages/frontend/src/data/endgame/banners_current.json`
  - 4.6 真珠池更正为**全版本**（2026/09/28 ~ 2026/11/10 15:00），原数据误记为 4.6 上半、10/21 结束
  - 新增 4.7 前瞻卡池：星神★阿哈（全版本）、上半复刻（银狼LV.999 / 火花 / 爻光）、下半复刻（黄泉 / 丹恒•饮月 / 景元）
  - 4.7 四星 UP 统一为艾丝妲 / 玲可 / 驭空；`meta.updatedAt` → `2026-11-07`，来源改为官方公告 / 4.7 前瞻直播
- `packages/frontend/src/components/BannerPanel.vue` — 标题改为「当期与前瞻卡池」，来源提示改用 `meta.sourceText`

### 未改动

- `stages_current.json` 关卡数据仍为 2026-09-29 核查版，未录入 4.6 当期 AS 021「支配遗忘」，4.7 上线后需整体刷新
- `characters.json` / `characterBuilds.json` / `teams_meta.json` 未刷新；Aha（`aha`）条目已存在

### 校验

- JSON 解析通过
- 前端类型检查通过

### 历史改动（2026-09-29，扫描器导入）

- 新增：`docs/SCANNER_INTEGRATION.md`、`data/endgame/banners_current.json`、`data/scannerNameMap.ts`（53/53 映射）、`utils/scannerImport.ts`、`components/BannerPanel.vue`、`components/ScannerRosterPanel.vue`
- 修改：`utils/endgameScoring.ts`（`applyRosterStrength()`）、`composables/useEndgameTeams.ts`、`views/EndgameTeamsView.vue`、`assets/endgame.css`
- 数据：`stages_current.json` / `characters.json` / `teams_meta.json` 的 `updatedAt` → `2026-09-29`

## 4. 当期卡池（官方公告 / 前瞻，核对于 2026-11-07）

来源：米哈游 4.6 活动跃迁公告、4.7 前瞻直播（2026-10-30）、Prydwen Banners

### 4.6（至 2026/11/10 15:00 结束）

| 卡池 | 时间 | 5★ UP | 4★ UP |
| --- | --- | --- | --- |
| 4.6全版本「沧海萃珠」 | 2026/09/28 更新后 ~ 2026/11/10 15:00 | **真珠**（欢愉·冰，`pearl`） | 青雀 / 雪衣 / 米沙 |
| 4.6上半「韶艾裁英」（已结束） | 2026/09/28 更新后 ~ 2026/10/21 11:59 | **绯英**（欢愉·物理，`evanescia`） | 同上 |
| 4.6下半「我身即刃」 | 2026/10/21 12:00 ~ 2026/11/10 15:00 | **千冶•刃**（虚无·火，`mortenax-blade`） | 同上 |

注意：真珠池实际覆盖 4.6 全版本（官方「4.6版本活动跃迁（其二）」，2026-10-20），不是只到 10/21。

### 4.7「此刻，将群星付之一笑」（2026/11/11 更新后 ~ 2026/12/22 15:00）

| 卡池 | 时间 | 5★ UP | 4★ UP |
| --- | --- | --- | --- |
| 4.7全版本「星神★阿哈」 | 2026/11/11 ~ 2026/12/22 15:00 | **阿哈**（欢愉·量子，`aha`） | 艾丝妲 / 玲可 / 驭空 |
| 4.7上半复刻 | 2026/11/11 ~ 2026/12/02 11:59 | 银狼LV.999（欢愉·虚数）/ 火花（欢愉·火）/ 爻光（欢愉·物理） | 同上 |
| 4.7下半复刻 | 2026/12/02 12:00 ~ 2026/12/22 15:00 | 黄泉（虚无·雷）/ 丹恒•饮月（毁灭·虚数）/ 景元（智识·雷） | 同上 |

4.7 其他要点：新遗器「神的瞬息欢愉」「亚空异容所」；奇缘星魂首批为黄泉 / 丹恒•饮月 / 景元（登录三选一得本体与奇缘星魂）。阿哈专属光锥中文名尚未在官方公告确认，`banners_current.json` 暂不展示光锥名。

角色本体已在 `characters.json`；卡池展示在 `banners_current.json`。BWIKI 4.5「不死途」与站内 `ashveil` 阿什薇尔 命名不一致，已写在 `banners_current.json` 的 `recent[].note`。

## 5. 扫描器数据怎么进前端

```
御星凌月.json
  → parseScannerSave()
  → localStorage: hsr-team-builder:scanner-roster:v1
  → useEndgameTeams(scannerRoster)
  → applyRosterStrength() 校正 characters[].strength
  → recommendTeams() 重算
```

`strength` 公式（`scannerImport.ts` / `endgameScoring.ts`）：

```
ready = level/80*0.35 + eidolon/6*0.35 + traceOpened/14*0.30
effective = theory * (0.75 + 0.25 * ready)
未持有：theory * 0.92（轻微降权，不删推荐）
```

## 6. 开发约定（务必遵守）

- 改角色/端点数据前先读 `docs/CHARACTER_ADDITIONS.md` 与 `AGENTS.md`
- 端点 JSON 只动 `packages/frontend/src/data/endgame/`，不改打分逻辑也能生效
- 新增角色必须补：`avatars.ts`、`lightcones.ts`、图片资源（`public/images`）
- 不要把扫描器英文名直接塞进 UI；一律经 `scannerNameMap.ts`
- 卡池数据以米哈游官方公告 / 前瞻直播为准（BWIKI 交叉核对），禁止凭记忆写 UP
- 卡池时间统一按 UTC+8；4.7 阿哈池不切池，覆盖全版本，不要拆成上下半两条
- 构建命令：根目录 `npm run dev:frontend`、`npm run build:frontend`、`npm run type-check`
- 前端静态数据模式**不需要**后端

## 7. 建议的后续开发（按优先级）

1. **遗器达标** — 读扫描器 `relics[].substats.{key,value,count,step}`，对照 `characterBuilds.json` 的主/副词条打勾
2. **养成缺口** — `materials` 库存 vs 构筑素材需求，生成「还差多少」清单
3. **光锥持有** — `light_cones[].superimposition` + `location`，简评里标「已有专武 / 可下位」
4. **baseStats.json** — 从 `hsr-optimizer-main/src/data/game_data.json` 抽出面板进前端，摆脱外部路径
5. **卡池倒计时** — `banners_current.json` 的 end 可解析成倒计时
6. **远程 API** — 若启用后端，替换 `endgameDataApi.ts` 占位实现

## 8. 快速启动

```powershell
cd F:\Downloaded\AI_Project\HonkaiStarRail
npm install          # 若依赖未装
npm run dev:frontend # → http://localhost:5174/endgame
npm run type-check
npm run build:frontend
```

导入存档：页面左侧「账号存档」→ 选择 `F:\Downloaded\HonkaiStarRailScanner\御星凌月.json`。

## 9. 已知边界 / 风险

- `endgameDataApi.ts` 未接通，改远程数据要先实现该文件
- 后端 `packages/backend` 与前端静态 JSON 是两套数据，**目前不要混用**
- `CustomRosterDock`（手选四人）与 `ScannerRosterPanel`（真实库存）并存：手选仍走原逻辑，扫描器只改强度权重与持有标注
- 主题：深浅切换在 `useThemePreference`；新面板浅色覆盖在 `endgame.css` 末尾
- playwright MCP 当前会话不可用（连接失败）；自动化测试看 `tests/automation/README.md`
- `stages_current.json` 仍是 2026-09-29 核查版（MoC 043 / PF 026 / AS 020 / AA 009），未录入 4.6 当期 AS 021「支配遗忘」（2026/10/05 ~ 2026/11/16）
- 4.7 阿哈专属光锥中文名未确认，`banners_current.json` 暂缺该字段；4.7 四星 UP 与开启时间来自前瞻直播，正式公告发布后应复核

## 10. 关键文件速查

```
packages/frontend/src/
  views/EndgameTeamsView.vue          # 主页面
  components/BannerPanel.vue          # 当期卡池
  components/ScannerRosterPanel.vue   # 扫描器导入
  components/CharacterGuidePanel.vue  # 角色简评
  composables/useEndgameTeams.ts      # 配队状态机
  composables/useCustomRoster.ts      # 手选四人
  utils/endgameScoring.ts             # 打分 + applyRosterStrength
  utils/scannerImport.ts              # 扫描器解析/持久化
  utils/endgameTypes.ts               # 类型
  data/scannerNameMap.ts              # 名字映射
  data/avatars.ts                     # slug → 图片 ID
  data/endgame/banners_current.json   # 卡池
  data/endgame/stages_current.json    # 当期关卡
  data/endgame/characters.json        # 93 角色
  data/endgame/characterBuilds.json   # 构筑/素材
  data/endgame/teams_meta.json        # 26 队伍模板
  assets/endgame.css                  # 端点样式
```
