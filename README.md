# 崩坏：星穹铁道 · 高难配队工具

面向《崩坏：星穹铁道》当期高难内容（混沌回忆 / 虚构叙事 / 末日幻影 / 异相仲裁）的配队与养成参考工具。npm workspaces monorepo，含 Vue 3 前端、NestJS 后端与共享类型包。

## 功能

- 当期关卡 Buff、敌人弱点、评分线一览
- 自动评分 Top 配队（综合弱点 / 机制 / 模式 / 环境 Buff）
- 槽位下拉切换 + 实时代价提示
- 角色简评面板：推荐队友、光锥、遗器、养成素材
- 「我的角色」自选四人并评分
- 深浅主题切换
- 后端提供角色 / 光锥 / 版本 / 配队推荐 API 与管理端认证（前端当前使用静态 JSON，API 为配套能力）

## 技术栈

| 包 | 技术 |
| --- | --- |
| `packages/frontend` | Vue 3 · TypeScript · Vite · Bootstrap 5 · Vue Router |
| `packages/backend` | NestJS 11 · TypeORM · PostgreSQL · Redis · JWT · Swagger |
| `packages/shared` | TypeScript 类型与枚举（角色 / 光锥领域模型） |
| `tests/automation` | Playwright（冒烟 / API / E2E / 视觉回归） |

## 目录结构

```
.
├── packages/
│   ├── frontend/          # Vue 3 前端（默认端口 5174）
│   ├── backend/           # NestJS API（默认端口 3001）
│   └── shared/            # 前后端共享类型
├── tests/automation/      # Playwright 自动化测试（独立安装）
├── docs/                  # 角色录入与部署流程文档
├── docker-compose.yml     # 本地 Postgres + Redis
└── package.json           # monorepo 根脚本
```

## 环境要求

- Node.js 20.19+ 或 22.12+（Vite 7 要求）
- 后端需要 Docker（或自备）PostgreSQL 与 Redis；本地可用根目录 `docker-compose.yml`

## 快速开始

```bash
# 安装全部 workspace 依赖
npm install

# 仅启动前端（静态 JSON 数据，无需后端）
npm run dev:frontend
# → http://localhost:5174/
```

同时启动前后端：

```bash
# 1. 启动本地数据库与缓存
docker compose up -d

# 2. 配置后端环境变量
cd packages/backend
copy .env.example .env   # Windows；macOS/Linux: cp .env.example .env
# 按需修改 DATABASE_URL、REDIS_URL、JWT_SECRET、ADMIN_USERNAME、ADMIN_PASSWORD 等

# 3. 并行开发
npm run dev:all
# 前端 → http://localhost:5174/
# 后端 → http://localhost:3001/  Swagger: http://localhost:3001/swagger
```

### 常用脚本（根目录）

| 命令 | 说明 |
| --- | --- |
| `npm run dev` / `dev:frontend` | 启动前端开发服务器 |
| `npm run dev:backend` | 启动后端（watch） |
| `npm run dev:all` | 并行启动前后端 |
| `npm run build` / `build:frontend` | 构建前端（含类型检查） |
| `npm run build:backend` | 构建后端 |
| `npm run build:all` | 先构建后端与 shared，再构建前端 |
| `npm run type-check` | shared + frontend + backend 类型检查 |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

### 前端构建产物

```bash
npm run build:frontend
# 输出 packages/frontend/dist
```

任意静态托管（Vercel / Cloudflare Pages / Netlify / GitHub Pages 等）均可；需 SPA 回退到 `index.html` 以保证 `/endgame` 可直接打开。详见 [docs/UPLOAD_AND_DEPLOY_WORKFLOW.md](docs/UPLOAD_AND_DEPLOY_WORKFLOW.md)。

## 前端说明

- 路由：`/` 与 `/endgame` 均渲染主页面 `EndgameTeamsView`（当期高难配队）
- 数据来源：当前直接读取本地静态 JSON（`src/data/endgame/`）；`src/services/endgameDataApi.ts` 为预留远程 API 接口，尚未接入
- 可选环境变量：`VITE_API_URL`（见 `src/config/api.ts`，预留）

```
packages/frontend/src/
  views/EndgameTeamsView.vue      # 主页面
  components/                     # 角色栏 / 简评面板等
  composables/                    # 配队、自选角色、主题
  utils/endgameScoring.ts         # 配队打分
  data/endgame/                   # 关卡 / 角色 / 构筑 / 元数据 JSON
  data/avatars.ts                 # 角色 slug → 资源 ID 映射
  data/lightcones.ts              # 光锥 slug → 资源 ID 映射
```

### 数据更新

修改 `packages/frontend/src/data/endgame/` 下的 JSON 即可，无需改动打分逻辑：

- `stages_current.json` — 当期关卡
- `characters.json` — 角色数据
- `characterBuilds.json` — 养成 / 构筑
- `teams_meta.json` — 配队元数据

新增角色时请按 [docs/CHARACTER_ADDITIONS.md](docs/CHARACTER_ADDITIONS.md) 补齐图片资源与 slug 映射。

## 后端说明

NestJS 11 API，默认端口 `3001`。主要模块：

| 模块 | 路由前缀 | 说明 |
| --- | --- | --- |
| characters | `/characters` | 角色 CRUD、批量更新、管理端 seed/clear |
| lightcones | `/lightcones` | 光锥 CRUD、批量创建 |
| versions | `/versions` | 版本说明、changelog、roadmap |
| teams | `/teams` | 热门配队、按角色推荐 |
| auth | `/auth` | 管理员登录签发 JWT |

- 认证：`POST /auth/login`（用户名/密码 → JWT）；账号来自环境变量 `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- 数据库：TypeORM + PostgreSQL；缓存：Redis（Keyv）；限流：`@nestjs/throttler`
- 实体：`CharacterEntity`、`LightconeEntity`、`CharacterLightconeEntity`、`VersionEntity`

### 后端环境变量

见 `packages/backend/.env.example`：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串（生产必填） |
| `REDIS_URL` | Redis 连接串（生产必填） |
| `JWT_SECRET` | JWT 密钥（生产必填） |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 管理端账号（生产必填） |
| `PORT` | 默认 `3001` |
| `NODE_ENV` | 运行环境 |
| `PRODUCTION_DOMAIN` | 生产域名（CORS） |
| `ALLOWED_ORIGINS` | 额外允许的跨域来源（可选） |

### 本地数据库

```bash
docker compose up -d
# Postgres: localhost:5432  用户 postgres / 密码 hsr-team-builder-local-dev / 库名 hsr_team_builder
# Redis:    localhost:6379
```

## 自动化测试

`tests/automation` 为独立 Playwright 工程（不随根 workspace 安装）：

```bash
cd tests/automation
npm install
copy .env.example .env

npm run test:smoke     # 前端冒烟
npm run test:api       # 后端 API 契约
npm run validate
npm run typecheck
npm run lint
```

默认指向生产环境；本地目标为前端 `5174`、后端 `3001`。详情见 [tests/automation/README.md](tests/automation/README.md)。

## 文档

- [docs/CHARACTER_ADDITIONS.md](docs/CHARACTER_ADDITIONS.md) — 新增角色清单与数据录入规范
- [docs/FRONTEND_THEME_UI_STYLE.md](docs/FRONTEND_THEME_UI_STYLE.md) — 前端主题与界面说明

## 合规

- 社区整理数据，以游戏内为准；本项目不代表官方，亦无官方实时接口声明。
- 游戏内容、角色与相关商标归米哈游（miHoYo / HoYoverse）所有。
- 关卡与构筑参考 BWIKI、Prydwen 等社区来源，仅作玩法参考，与上述站点无隶属关系。

## 许可证与归属

本仓库代码基于 **Gilded** 的开源项目 [hsr-team-builder](https://github.com/)，按 [MIT License](LICENSE) 授权。

```text
MIT License
Copyright (c) 2025 Gilded
```

在保留上述版权与许可文本的前提下，允许使用、修改与再分发。本 fork 的后续修改与部署不改变对原作者的署名义务。
