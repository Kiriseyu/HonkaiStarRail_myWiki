# 从零部署：文件资源管理器 → GitHub → 免费上线

面向本仓库（`hsr-team-builder`）的 Windows 新手指南。按顺序做完，你会得到一个可公开访问的静态网站。

当前产品前端是 **Vue 3 静态页**，数据写在 JSON 里，**不需要**先部署后端也能上线。

---

## 0. 你需要准备什么

| 项目 | 说明 |
| --- | --- |
| Windows 10/11 | 本机操作环境 |
| [Node.js](https://nodejs.org/) 20.19+ 或 22.12+ | 安装 LTS 即可；装完在终端验证 `node -v` |
| [Git for Windows](https://git-scm.com/download/win) | 安装时一路默认即可 |
| [GitHub](https://github.com/) 账号 | 免费 |
| [Cloudflare](https://dash.cloudflare.com/) 账号 | 免费（推荐；也可用 Vercel） |

本指南默认：

- 项目已放在：`F:\Downloaded\AI_Project\hsr-team-builder`
- 托管平台：**Cloudflare Pages**（免费、额度够用）
- 分支：`main`

若你的路径不同，把下面命令里的路径改成你的实际目录。

---

## 1. 在文件资源管理器里确认项目

1. 打开「此电脑」或任意文件夹。
2. 地址栏粘贴并回车：

   ```text
   F:\Downloaded\AI_Project\hsr-team-builder
   ```

3. 确认能看到这些文件/文件夹：

   ```text
   package.json
   packages/
   docs/
   README.md
   .gitignore
   ```

4. 不要把 `node_modules`、`packages/frontend/dist` 当成源码提交（仓库的 `.gitignore` 已忽略它们）。

---

## 2. 打开终端并进入项目

两种常用方式任选其一：

**方式 A（推荐）**

1. 在项目文件夹空白处按住 **Shift + 右键**
2. 选择 **「在此处打开 PowerShell 窗口」** 或 **「在终端中打开」**

**方式 B**

1. 按 `Win + R`，输入 `powershell`，回车
2. 手动切换目录：

   ```powershell
   cd F:\Downloaded\AI_Project\hsr-team-builder
   ```

验证环境：

```powershell
node -v
npm -v
git --version
```

三条命令都能打印版本号即可。

---

## 3. 本地构建一次（可选但强烈建议）

推 GitHub 之前先确认能构建成功：

```powershell
npm install
npm run build:frontend
```

成功后应存在：

```text
packages\frontend\dist\index.html
```

本地预览（可选）：

```powershell
npm run preview
```

浏览器打开终端里显示的地址（一般是 `http://localhost:4173/`）。确认页面正常后，回到终端按 `Ctrl + C` 停止。

---

## 4. 在 GitHub 创建空仓库

1. 登录 [github.com](https://github.com/)。
2. 右上角 **+** → **New repository**。
3. 建议填写：
   - **Repository name**：例如 `hsr-team-builder`
   - **Visibility**：`Public`（免费 Pages 更省事；Private 也可，需注意 Cloudflare 导入权限）
   - **不要**勾选 “Add a README file” / `.gitignore`（本地已有完整项目，避免冲突）
4. 点 **Create repository**。
5. 页面会显示「…or push an existing repository from the command line」，记下你的仓库地址，例如：

   ```text
   https://github.com/你的用户名/hsr-team-builder.git
   ```

---

## 5. 用 Git 推送到 GitHub

仍在项目根目录的 PowerShell 里执行（把 URL 换成你的）：

```powershell
# 5.1 若还不是 Git 仓库则初始化（已初始化会提示 reinit，可忽略）
git init

# 5.2 确认当前分支名（新 Git 一般是 main）
git branch -M main

# 5.3 添加远程地址（只做一次）
git remote add origin https://github.com/你的用户名/hsr-team-builder.git

# 5.4 查看将要提交的文件
git status
```

`git status` 里**不应**出现大量 `node_modules/`。若出现，说明 `.gitignore` 未生效或你在错误目录，先排查再继续。

```powershell
# 5.5 暂存并提交
git add .
git commit -m "chore: initial push for static deploy"

# 5.6 首次推送
git push -u origin main
```

### 5.7 登录 GitHub（第一次推送可能弹出）

若命令行要求认证：

1. 推荐安装 [Git Credential Manager](https://github.com/git-ecosystem/git-credential-manager)（安装 Git for Windows 时通常已带）。
2. 弹出浏览器窗口 → 用 GitHub 账号授权。
3. 也可改用 SSH：先在 GitHub 添加 SSH Key，再 `git remote set-url origin git@github.com:用户名/仓库.git`。

推送成功的标志：终端无 fatal/error，GitHub 仓库主页能看到 `packages/`、`package.json` 等文件。

---

## 6. 部署到 Cloudflare Pages（免费）

### 6.1 打开 Pages

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 左侧 **Workers & Pages**（或 **Workers 和 Pages**）→ **Create** → **Pages** → **Connect to Git**。
3. 首次使用需授权 Cloudflare 访问你的 GitHub → 选择 **Only select repositories** → 勾选你的仓库。

### 6.2 填写构建配置

| 字段 | 填写 |
| --- | --- |
| Project name | 任意，如 `hsr-team-builder` |
| Production branch | `main` |
| Framework preset | **Vite**（若无则留空） |
| Build command | `npm install && npm run build:frontend` |
| Build output directory | `packages/frontend/dist` |
| Root directory | 留空（monorepo 根目录构建） |

环境变量：当前前端读本地 JSON，**一般不用**再加 `VITE_API_URL`。

### 6.3 部署

1. 点 **Save and Deploy**。
2. 等待 2～5 分钟，构建日志全绿。
3. 完成后得到公开地址，例如：

   ```text
   https://hsr-team-builder.pages.dev
   ```

打开该地址，以及：

```text
https://hsr-team-builder.pages.dev/endgame
```

两者都应正常显示「当期高难配队」页面（Pages 默认把未知路径回退到 `index.html`，保证 SPA 直开）。

---

## 7. 部署成功后的日常更新

以后只改数据或代码时，不必重新点 Cloudflare 的手工部署：

```powershell
# 在项目根目录
git add packages/frontend/src/data
git commit -m "data: update endgame builds"
git push origin main
```

Cloudflare Pages 监听 `main` 推送后会**自动重新构建部署**。约 1～3 分钟后刷新网站即可。

常用数据文件：

```text
packages/frontend/src/data/endgame/stages_current.json
packages/frontend/src/data/endgame/characters.json
packages/frontend/src/data/endgame/characterBuilds.json
packages/frontend/src/data/endgame/teams_meta.json
```

---

## 8. 可选：改用 Vercel

若你更习惯 Vercel，流程几乎一样：

1. 打开 [vercel.com](https://vercel.com/) → **Add New… → Project** → Import 你的 GitHub 仓库。
2. 构建设置：

   | 字段 | 值 |
   | --- | --- |
   | Framework Preset | Vite |
   | Build Command | `npm install && npm run build:frontend` |
   | Output Directory | `packages/frontend/dist` |

3. **Deploy** → 得到 `https://xxx.vercel.app`。

Vercel 对 `/endgame` 同样会做 SPA 回退。

---

## 9. 常见问题

### 9.1 `git push` 提示 403 / 认证失败

- 用浏览器重新登录 GitHub。
- 检查是否用了过期的 Personal Access Token。
- 或改用 SSH / Git Credential Manager。

### 9.2 Cloudflare 构建失败：找不到命令

- 确认 **Build command** 含 `npm run build:frontend`。
- 确认仓库根目录是本 monorepo 根（有根 `package.json`），不是只传了 `packages/frontend`。

### 9.3 打开后白屏 / 资源 404

- 检查 **Build output directory** 是否为 `packages/frontend/dist`（不是 `dist` 或 `packages/frontend`）。
- 本地 `npm run build:frontend` 再看 `dist` 是否生成完整文件。

### 9.4 直接打开 `/endgame` 404

- Cloudflare Pages / Vercel 默认可回退 SPA。
- 若改过平台路由设置，请恢复「所有未匹配路径返回 index.html」。

### 9.5 想绑自己的域名

Cloudflare Pages → 项目 → **Custom domains** → 按提示加 CNAME。域名可买可转移；免费托管本身不强制买域名。

### 9.6 隐私说明

- 推到 **Public** 仓库 = 源码公开。
- 网站内容为社区整理的游戏数据；勿提交密钥、`.env`（已在 `.gitignore` 忽略）。

---

## 10. 检查清单（部署完成打勾）

- [ ] 本机能 `npm run build:frontend` 成功
- [ ] GitHub 仓库能看到完整源码（无 `node_modules`）
- [ ] Cloudflare Pages 构建日志成功
- [ ] `https://你的站点.pages.dev/` 首页正常
- [ ] `https://你的站点.pages.dev/endgame` 可直接打开
- [ ] 改一次 JSON 后 `git push`，线上几分钟内自动更新

---

## 相关文档

- [UPLOAD_AND_DEPLOY_WORKFLOW.md](./UPLOAD_AND_DEPLOY_WORKFLOW.md) — 分支与托管简表
- [CHARACTER_ADDITIONS.md](./CHARACTER_ADDITIONS.md) — 新增角色素材规范
- 仓库根目录 [README.md](../README.md) — 项目结构与本地开发
