# 前端风格体系与界面实现说明（AI 可复用）

> 本文件供下次 AI / 开发者直接读取，用于理解、维护或扩展本项目前端的**深浅主题切换**与**界面结构**。  
> 对应代码：`packages/frontend`（Vue 3 + TS + Vite + Bootstrap 5）。  
> 真实项目路径可能为 `HonkaiStarRail`（monorepo 名 `hsr-team-builder-monorepo`）。

---

## 1. 一句话架构

前端是**单页 Vue 3 应用**（路由 `/`、`/endgame` 均渲染 `EndgameTeamsView`）。  
风格体系 = **全局 Bootstrap 覆盖（`main.css`）** + **业务页 CSS 变量主题（`endgame.css`）** + **JS 组合式状态（`useThemePreference`）** + **`index.html` 防闪烁预写主题**。

```
index.html 预写 data-theme
        │
        ▼
useThemePreference()  ──►  <html data-theme="dark|light" style="color-scheme:…">
        │                              │
        │                              ▼
        │                    CSS 变量切换（.endgame-page / html[data-theme='light']）
        │
        └──►  UI 开关 .eg-theme-switch-btn（点击坐标 → 圆形 wipe 遮罩）
```

---

## 2. 关键文件地图

| 路径 | 职责 |
| --- | --- |
| `packages/frontend/index.html` | **首屏同步写入主题**，避免 Vue 挂载前深浅色闪屏；内联深色兜底样式 |
| `packages/frontend/src/main.ts` | 引入 Bootstrap → `main.css` → 挂载 App；字体 ready、Service Worker |
| `packages/frontend/src/App.vue` | 仅 `<RouterView />`，无壳层导航 |
| `packages/frontend/src/router/index.ts` | `/` 与 `/endgame` → `EndgameTeamsView`；`afterEach` 改 `document.title` |
| `packages/frontend/src/composables/useThemePreference.ts` | **主题状态机**：探测、持久化、DOM 提交、圆形 wipe 过渡 |
| `packages/frontend/src/composables/useAvatarPreference.ts` | 偏好模式参考（localStorage + 兼容迁移） |
| `packages/frontend/src/composables/useCustomRoster.ts` | 「我的角色」浮窗：选人、评分、拖拽缩放、localStorage |
| `packages/frontend/src/assets/main.css` | 全局重置、Bootstrap 主色覆盖、`.theme-wipe-overlay`、tooltip |
| `packages/frontend/src/assets/endgame.css` | **主业务样式**（约 2k 行）：暗色默认 + 浅色覆写 + 主题开关组件 + 布局 |
| `packages/frontend/src/constants/design.ts` | 设计令牌常量（颜色/间距/字体/阴影/过渡）；**当前页面 CSS 几乎不直接 import 它**，以 CSS 变量为准 |
| `packages/frontend/src/views/EndgameTeamsView.vue` | 主页面结构：Hero、模式 Tab、侧栏、配队卡、Toast、主题开关 |
| `packages/frontend/src/components/CustomRosterDock.vue` | 左下角角色栏 FAB + 可缩放面板 |
| `packages/frontend/src/components/CharacterGuidePanel.vue` | 角色简评面板（光锥/遗器/队友） |
| `packages/frontend/src/data/*` + `public/images/*` | 静态 JSON 与头像/光锥图 |

---

## 3. 主题切换实现（核心）

### 3.1 状态与存储

- 类型：`type UiTheme = 'dark' | 'light'`
- localStorage key：`hsr-team-builder:ui-theme:v1`
- 合法值：仅 `'dark' | 'light'`；非法值视为未设置
- 模块级单例 `ref`（`useThemePreference` 多处调用共享同一状态）

### 3.2 初始探测顺序

1. 读 localStorage → 合法则用  
2. 否则 `matchMedia('(prefers-color-scheme: light)')` → 系统偏好  
3. 否则默认 `'dark'`

### 3.3 DOM 提交（`commitDom`）

```ts
document.documentElement.setAttribute('data-theme', t)  // 'dark' | 'light'
document.documentElement.style.colorScheme = t           // 原生滚动条/表单控件配色
```

**约定：主题作用在 `<html data-theme>` 上，不作用在 `#app` 或 body class。**

### 3.4 首屏防闪屏（index.html）

Vue 挂载前执行 IIFE：

1. 读同一 key `hsr-team-builder:ui-theme:v1`  
2. 合法则用，否则 media 查询，否则 `dark`  
3. 立刻 `setAttribute('data-theme', …)` + `colorScheme`  
4. 内联 `<style>` 写死深色 body 背景与主色按钮，保证闪屏窗口可读  

**扩展主题时必须同步改 index.html 的兜底色**（当前仅覆盖深色 body / primary 按钮）。

### 3.5 切换动画：圆形遮罩 wipe（签名动效）

关键点（`useThemePreference.ts` + `main.css`）：

| 参数 | 值 / 行为 |
| --- | --- |
| 时长 | `WIPE_MS = 480`；遮罩 CSS `0.48s cubic-bezier(0.4,0,0.2,1)` |
| 遮罩颜色 | 目标主题底色：light → `#eef3f9`；dark → `#0f0f23` |
| 原点 | 点击/触摸坐标 `clientX/Y`；无事件则视口中心偏上 |
| 半径 | 到四角的最大距离 `*2 + 40`，经 CSS 变量 `--theme-wipe-size` |
| 提交时机 | **先全屏盖住 → 再 `commitDom` → 再 0.16s 淡出移除** |
| 叠影规避 | 过渡期间**不**切换 CSS 主题，避免双主题布局位移 |
| 减少动效 | `prefers-reduced-motion: reduce` 时直接 `commitDom`，不播 wipe |
| 重入锁 | 模块级 `wiping`，动画中忽略新点击 |

类名：`.theme-wipe-overlay` / `.is-active`（`z-index: 2147483647`，`pointer-events: none`）。

### 3.6 对外 API

```ts
const { theme, setTheme, toggleTheme, isDark } = useThemePreference()

toggleTheme($event)           // UI 开关：翻转 + 以事件坐标为 wipe 原点
setTheme('light', { x, y })   // 指定主题（可选原点）
```

`ensureBooted()` 在首次 `useThemePreference()` 时：探测初始主题 → 立即 `applyDom`（无动画）→ 注册 `watch(theme)` 处理后续切换。

---

## 4. 色彩与设计令牌

### 4.1 两层颜色体系

**A. 全局 / Bootstrap（偏「全站皮肤」，`main.css`）**  
深色霓虹风，几乎不随 light 切换：

| Token | 值 |
| --- | --- |
| primary | `#00d4ff` |
| secondary 渐变 | `#9b59b6` |
| 页面底 | `#0f0f23` / `#1a1a2e` / `#16213e` 渐变 |
| 字体 | `'Poppins', system-ui, sans-serif`（index.html 预加载 Google Fonts） |

**B. 业务页 CSS 变量（真正的双主题，挂在 `.endgame-page`）**

| 变量 | 暗色默认 | 浅色覆写（`html[data-theme='light'] .endgame-page`） |
| --- | --- | --- |
| `--eg-bg` | `#0b1020` | `#f3f6fa` |
| `--eg-panel` | `rgba(255,255,255,0.04)` | `#ffffff`（修复段用不透明白） |
| `--eg-border` | `rgba(255,255,255,0.1)` | `rgba(51,65,85,0.28)` |
| `--eg-ink` | `#e8eefc` | `#0f172a` |
| `--eg-ink-2` | `#a8b3cc` | `#334155` |
| `--eg-ink-3` | `#6d7a96` | `#475569` |
| `--eg-accent` | `#00d4ff` | `#0369a1` |
| `--eg-gold` | `#ffd700` | `#a16207` |
| `--eg-green` | `#2ecc71` | `#15803d` |
| `--eg-orange` | `#f0a35e` | `#c2410c` |
| `--eg-red` | `#ff6b7a` | `#b91c1c` |
| `--eg-select` | `#18233d` | `#ffffff` |
| `--eg-metric` | `rgba(0,0,0,0.18)` | `rgba(255,255,255,0.72)` |
| `--eg-radius` | `14px` | 同（不切换） |

语义色（评分等级等）：

| 等级 | 暗色 | 浅色 |
| --- | --- | --- |
| S | 金 `#ffd700` 系 | 琥珀 `#f59e0b` / 文字 `#854d0e` |
| A | 青 `#00d4ff` | 天蓝 `#0ea5e9` / `#0c4a6e` |
| B | 绿 `#2ecc71` | 绿 `#22c55e` / `#14532d` |
| C | 橙 | 橙 `#f97316` / `#9a3412` |
| D | 红 | 红 `#ef4444` / `#7f1d1d` |

浅色 body 背景：`#eef3f9` 基底 + 淡蓝/淡紫径向光斑 + `linear-gradient`，`background-attachment: fixed`。

### 4.2 `constants/design.ts`

导出 `COLORS` / `SPACING` / `TYPOGRAPHY` / `SHADOWS` / `TRANSITIONS`。  
**现状：视图与组件未 import 使用**；真实主题以 `endgame.css` 的 `--eg-*` 与浅色覆写为准。若引入设计令牌驱动样式，应与 CSS 变量表对齐，避免双源。

---

## 5. 界面结构（`EndgameTeamsView`）

类名前缀统一 **`eg-`**；页面根节点 **`.endgame-page`**（主题变量容器）。

```
.endgame-page
├── header.eg-hero          # 标题 + 副文案 + 主题开关 + 版本期 pill
├── nav.eg-mode-tabs        # 4 格模式 Tab（混沌/虚构/末日/异相…）
├── div.eg-layout           # grid: 360px | 1fr
│   ├── aside
│   │   ├── section.eg-card # 当期关卡 / Buff / 敌人 / 评分线
│   │   ├── section.eg-card # 说明
│   │   └── CharacterGuidePanel
│   └── main
│       └── section.eg-card # 推荐配队：toolbar + 空态 + 多张 eg-team-card
│           └── article.eg-team-card.grade-{S|A|B|…}
│               ├── 头部：badge + 名称 + 适用侧 + eg-score-box
│               ├── eg-breakdown → 4× eg-metric + eg-bar
│               ├── eg-slots → 4× eg-slot（select + 头像 + penalty）
│               └── eg-team-notes（可选）
├── footer.eg-footer
├── div.eg-toast            # 右下角反馈
└── CustomRosterDock        # fixed 左下 FAB + 面板
```

### 5.1 布局要点

- 容器：`max-width: 1280px`，水平居中  
- 主栅格：`.eg-layout` → `360px + 1fr`，`gap: 16px`  
- 断点 `≤960px`：单列；模式 Tab 2 列；slots/breakdown 2 列  
- 卡片：半透明面板 + `1px` 边框 + `border-radius: 14px`  
- 强调：`h2` 小号大写 + letter-spacing + `--eg-accent`  
- 标签：`.eg-tag` 胶囊；变体 `.element` / `.weak` / `.mech` 用色边+浅字  

### 5.2 主题开关组件（移植 WPF 精致开关）

- 容器 `.eg-theme-switch`：按钮 + 文案「深色/浅色」  
- 按钮 `.eg-theme-switch-btn` + **`is-dark` class 表示当前为深色**（`aria-checked` 同步）  
- 结构：`.eg-ts-stars`（夜空星点）+ `.eg-ts-clouds`（白天云）+ `.eg-ts-thumb` 内含 `.eg-ts-sun` / `.eg-ts-moon`  
- 轨道：浅态蓝渐变 `#5a94cf→#3f7db8`；`is-dark` 时深蓝 `#1c2740→#12192c`  
- 拇指：默认左（太阳）；`is-dark` 时 `translateX(56px)`（月亮）  
- 点击必须传事件：`@click="toggleTheme($event)"`，否则 wipe 原点回退到视口中上部  

### 5.3 「我的角色」Dock

- fixed `left/bottom: 16px`，z-index `90`  
- FAB `.eg-roster-fab` + 已选数 badge  
- 面板 `.eg-roster-panel`：默认 `max-height: min(68vh, 720px)`；可拖拽改尺寸  
  - 尺寸 key：`hsr-team-builder:custom-roster-size:v1`  
  - 选人 key：`hsr-team-builder:custom-roster:v1`  
  - 边界：宽 420–1400，高 360–900  
  - 拖拽：`ne` / `e` / `s` 三向 handle；移动端 `≤768px` 隐藏 handle，全宽底部抽屉  
- 浅色：面板白底 + 更强投影；详见 `endgame.css` 后半段 `html[data-theme='light'] .eg-roster-*`

### 5.4 交互反馈

- Toast：`.eg-toast` + `.show`，约 2.8s 自动关  
- 替换槽位角色：立即重算总分并 toast（含 penalty 文案）  
- 分享：`buildShareText()` → 文本域 + 剪贴板  

---

## 6. CSS 组织约定（维护规则）

1. **暗色为基底**写在无前缀选择器；**浅色用 `html[data-theme='light'] …` 覆写**。  
2. 业务组件颜色优先用 **`var(--eg-*)`**，少写死 hex；浅色可读性问题用后置 `!important` 修复段（文件末尾 `LIGHT THEME READABILITY FIXES`）。  
3. 浅色覆写分布：文件前部（变量+部分控件）与后部（可读性加固）。**改浅色时两段都要扫**。  
4. `body` 级深浅背景在 `main.css`（暗）与 `endgame.css` 浅色规则（`!important`）双重定义，浅色以 `endgame.css` 为准。  
5. 勿在 wipe 动画中间接切换主题类；所有主题变更走 `useThemePreference`。  
6. 新增随主题变化的 UI：  
   - 组件消费 `var(--eg-*)`  
   - 若浅色对比不足，在 LIGHT 段追加 `html[data-theme='light'] .your-class`  
   - 若全局 body 相关，检查 `index.html` 兜底  

---

## 7. 可复用检查清单（下次改风格时）

- [ ] 是否改了 `useThemePreference` 的 key / 类型？（三处同步：composable、index.html、文档）  
- [ ] 是否新增第三主题？当前仅 dark/light，wipe 颜色与 `is-dark` 开关样式需扩展  
- [ ] 是否新增依赖主题的组件？补 `--eg-*` + 浅色覆写  
- [ ] 是否动了 `main.css` 的 `#00d4ff`？会连带影响 Bootstrap 全站按钮/边框  
- [ ] 是否动了 wipe 时长？同步 `WIPE_MS` 与 `.theme-wipe-overlay` transition  
- [ ] 减少动效偏好下是否仍能正确提交主题？  
- [ ] 移动端 Dock（`≤768px`）与桌面拖拽是否仍可用？  
- [ ] 构建后静态托管 SPA 回退是否仍指向 `index.html`？（防闪屏脚本在其中）  

---

## 8. 风格气质（给视觉/文案扩展用）

| 维度 | 描述 |
| --- | --- |
| 暗色 | 星空/赛博：深蓝紫底、青色主强调、金 S 级、玻璃拟态卡片 |
| 浅色 | 纸白/晴空：slate 文字层级、深蓝 accent、淡蓝紫光斑、白卡片轻阴影 |
| 字体 | Poppins + system-ui；数字/评分偏重字重 |
| 圆角 | 卡片 14px，胶囊标签 999px，输入 ~10px |
| 动效 | 微交互 0.2s；主题 wipe 0.48s；开关拇指弹性 `cubic-bezier(0.34,1.2,0.64,1)` |
| 信息密度 | 中高：侧栏常驻关卡信息，右侧列表式配队卡，底部浮窗自定义队 |

---

## 9. 快速验证命令

```bash
# 在 monorepo 根目录
npm run dev:frontend   # → http://localhost:5174/
npm run type-check
npm run lint
```

手动验证主题：

1. 打开首页 → 应无长时间错误色闪屏  
2. 点击右上角开关 → 圆形遮罩从按钮扩散，盖住后整页变色  
3. 刷新页面 → 保持上次主题  
4. 系统浅色且无缓存 → 首次进入为浅色  
5. 窄屏 → Dock 变底部全宽、主布局单列  

---

## 10. 已知边界 / 坑

- `main.css` 里 `.bg-dark` / `.btn-primary` 等带 `!important`，会压过部分 Bootstrap 与浅色意图；业务页尽量用 `eg-*` 类而非裸 Bootstrap。  
- 浅色 body 依赖 `endgame.css` 的 `!important`；若只引入 `main.css` 会仍是深色页。  
- `design.ts` 与 CSS 变量不同步时，**以 CSS 为准**。  
- 主题是全局的（`document.documentElement`），非 per-route。  
- localStorage 异常（隐私模式）时静默回退默认，不抛错。  

---

*文档版本：基于当前仓库实现整理。若代码变更，优先核对 `useThemePreference.ts`、`endgame.css` 浅色段、`index.html` 预写脚本三处是否仍一致。*
