# 扫描器 / 优化器对接分析

对照仓库：

- 网站：`F:\Downloaded\AI_Project\HonkaiStarRail`（Vue3 高难配队）
- 扫描器导出：`F:\Downloaded\HonkaiStarRailScanner\御星凌月.json`（reliquary_archiver 0.18.0）
- 优化器：`F:\Downloaded\HonkaiStarRailScanner\hsr-optimizer-main`（含 `game_data.json` 面板/遗器数值）

结论：**可以对接，且有明确收益**。优先级按「数值矫正 → 个性化配队 → 功能块补全」。

## 1. 数据资产对照

| 来源 | 能提供什么 | 网站现状 | 对接价值 |
| --- | --- | --- | --- |
| 御星凌月.json `characters` | 53 名角色等级/晋阶/星魂/行迹 | 「我的角色」手选 4 人，无真实持有 | 导入后过滤推荐、按星魂修正强度 |
| 御星凌月.json `relics` | 2964 件遗器主/副词条、等级、套装 | 仅有构筑文字建议 | 可做「已装备遗器 vs 推荐」差距提示 |
| 御星凌月.json `light_cones` | 358 光锥等级/叠影/装备位置 | 光锥仅图标映射 | 标注「已有专武/可替代」 |
| 御星凌月.json `materials` | 801 项材料库存 | 养成素材只写需求量 | 缺口清单（差多少） |
| 御星凌月.json `gacha` | 星琼 56589 / 未熄星芒等 | 无 | 抽卡规划条 |
| hsr-optimizer `game_data.json` | 角色面板 HP/ATK/DEF/SPD、行迹、光锥叠影 | `strength` 为人工 65–97 | 用基础面板 + 星魂校正强度分 |
| BWIKI 历史跃迁 | 当期/近期卡池 | 无卡池模块 | 新增「当前卡池」功能块 |

## 2. 数值矫正方案

### 2.1 强度分（strength）校正

当前 `characters.json` 的 `strength` 是手写序数，与练度无关。可用优化器基础面板合成 **面板分**，再与星魂/行迹合成 **练度分**：

```
panelScore = HP/100 + ATK/10 + DEF/10 + SPD*2     // 五星约 320–340
buildScore = level/80*0.35 + eidolon/6*0.35 + tracesOpened/14*0.30
effective  = strength * (0.75 + 0.25 * buildScore)  // 有存档时生效
```

导入存档后，推荐排序从「理论强度」变为「你实际能打出的强度」。

### 2.2 属性/命途一致性

优化器 `game_data.json` 的 `path`/`element`/`rarity` 可作权威源，校验 `characters.json`。命名映射见 `src/data/scannerNameMap.ts`。

### 2.3 遗器副词条

扫描器 substats 含 `count`/`step`（强化次数与档位），可对推荐主/副词条做「已达标 / 未达标」勾选，避免只给静态文字。

## 3. 功能块补全

| 模块 | 状态 | 本次动作 |
| --- | --- | --- |
| 当期关卡 / 配队评分 | 已有 | 保持；接入住仓后重算 |
| 角色简评 | 已有，缺构筑时文案占位 | 保持；有存档时显示「持有/未持有」 |
| 我的角色 | 手选 4 人 | **新增 JSON 导入**（扫描器格式） |
| 当期卡池 | **缺失** | **新增 BannerPanel + banners_current.json** |
| 抽卡资源 | **缺失** | 卡池面板内展示星琼/专票（来自扫描器） |
| 养成缺口 | **缺失** | 后续：materials − build 需求 |
| 远程 API | `endgameDataApi.ts` 占位 | 本次不接后端，保持静态 JSON |

## 4. 当期卡池（2026-09-29 核对 BWIKI）

网站数据原停留在 4.4.1/4.5（`updatedAt: 2026-09-16`）。BWIKI 历史跃迁显示：

| 卡池 | 时间 | 5★ UP |
| --- | --- | --- |
| 4.6上半「沧海萃珠」 | 4.6 更新后 ~ 2026/10/21 11:59 | **真珠**（欢愉·冰） |
| 4.6上半「韶艾裁英」 | 4.6 更新后 ~ 2026/10/21 11:59 | **绯英**（欢愉·物理） |
| 4.6下半「我身即刃」 | 2026/10/21 12:00 ~ 2026/11/10 15:00 | **千冶•刃**（虚无·火） |

4★ UP：青雀、雪衣、米沙。角色已存在于 `characters.json`（`pearl` / `evanescia` / `mortenax-blade`），本次补齐卡池 UI 与元数据。

来源：https://wiki.biligame.com/sr/历史跃迁 、https://wiki.biligame.com/sr/跃迁

## 5. 建议落地顺序

1. **本次**：卡池面板 + 扫描器导入 + 持有过滤 + 面板分校正
2. 下一步：遗器达标勾选、材料缺口、光锥持有标注
3. 可选：把 `game_data.json` 基础面板抽成 `baseStats.json` 进前端，完全脱敏依赖优化器仓库

## 6. 风险

- 扫描器英文名与站内中文 slug 必须走映射表，不可猜。
- `strength` 是体验排序分，不可被面板分完全替代（机制标签仍主导配队）。
- 未持有角色不应从推荐池删除，只降权/标注，否则新号会看不到体系完整解。
