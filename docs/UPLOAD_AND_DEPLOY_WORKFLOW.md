# Deploy Workflow

## Branch

- `main`：产品主分支
- 功能/修复在 feature 分支开发，PR 合入 `main`

## Frontend build

```bash
npm install
npm run build:frontend
```

产物目录：`packages/frontend/dist`

## Hosting

任意静态托管均可：

- Vercel / Cloudflare Pages / Netlify / GitHub Pages

构建命令示例：

```bash
npm install && npm run build:frontend
```

输出目录：

```text
packages/frontend/dist
```

SPA 回退：访问非静态文件路径时返回 `index.html`（保证 `/endgame` 可直开）。

## Data updates

当期关卡与角色数据更新：

```text
packages/frontend/src/data/endgame/stages_current.json
packages/frontend/src/data/endgame/characters.json
packages/frontend/src/data/endgame/teams_meta.json
packages/frontend/src/data/endgame/characterBuilds.json
```
