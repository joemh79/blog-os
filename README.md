<div align="center">

# Blog-OS

**一个零构建、可自托管的极简个人博客系统**

A zero-build, self-hostable minimalist personal blog system.

[快速开始](#快速开始--quick-start) · [部署指南](docs/DEPLOY.md) · [API 文档](docs/API.md)

</div>

---

## 功能 Features

| 功能 | 说明 |
|---|---|
| 🎨 横向画廊首页 | BLOG / WORK / SITES 巨型主题词面板，桌面手机同一套布局 |
| 📝 暖纸博客区 | 暖米底 + 衬线标题的阅读风格 |
| ⚙️ 完整管理后台 | `/admin/`：登录、文章 CRUD（Markdown + 预览）、站点设置、留言管理 |
| 🔧 全站可配置 | 个人信息全部在 `config.js`，换个文件就是你的博客 |
| 💬 留言板 | 带蜜罐 + 限流防机器人 |
| 🖼️ 图片上传 | 可选绑定 R2（`/api/upload`） |
| 💰 全免费 | Cloudflare Pages + Worker + D1 免费额度跑全套 |
| 🧱 零构建 | 前台纯 HTML/CSS/JS，无框架、无打包；后台单文件 Worker，无 npm 依赖 |

> 📷 截图占位：`docs/screenshot-home.png` / `docs/screenshot-blog.png` / `docs/screenshot-admin.png`

## 目录结构 Project Structure

```
blog-os/
├── frontend/               # 前台（部署到 Cloudflare Pages，零构建）
│   ├── index.html          # 首页（横向画廊，config 驱动）
│   ├── config.js           # ★ 站点配置：改这里换成你的信息（gitignored）
│   ├── config.example.js   # 配置模板
│   ├── blog/               # 博客列表 + 文章页（从 API 动态加载）
│   ├── work/ sites/        # 作品 / 站点（config 驱动）
│   ├── guestbook/          # 留言板
│   ├── admin/              # 管理后台（登录 + 仪表盘 SPA）
│   └── assets/             # style.css / main.js / blog.js / admin.js / fonts
├── backend/                # 后台（Cloudflare Worker + D1，单文件）
│   ├── src/index.js        # 全部 API（零 npm 依赖）
│   ├── wrangler.toml
│   ├── migrations/0001_init.sql
│   └── seed.sql            # 示例文章（4 篇，可删）
├── docs/
│   ├── DEPLOY.md           # 从零部署指南
│   └── API.md              # API 文档
└── README.md / LICENSE
```

## 快速开始 · Quick Start

### 1. 配置你的信息

```bash
cd frontend
cp config.example.js config.js
# 用编辑器打开 config.js，改成你的名字、邮箱、简介……
```

### 2. 本地预览前台

```bash
cd frontend
python3 -m http.server 8080
# 打开 http://localhost:8080
```

### 3. 部署（全免费，约 15 分钟）

完整步骤见 [docs/DEPLOY.md](docs/DEPLOY.md)，概要：

```bash
# 后台
cd backend
wrangler d1 create blog-os-db        # 建库，填 database_id
wrangler d1 migrations apply blog-os-db
wrangler d1 execute blog-os-db --file=seed.sql   # 示例文章（可选）
wrangler secret put ADMIN_PASSWORD_HASH          # sha256(你的密码)
wrangler secret put TOKEN_SECRET                 # 随机字符串
wrangler deploy

# 前台：Cloudflare Pages → 上传 frontend/ 目录（或连 GitHub 自动部署）
# 把 config.js 的 apiBase 填成 Worker 地址
```

### 4. 写文章

访问 `你的域名/admin/` 登录，写文章 → 发布。

---

## English

Blog-OS is a minimalist personal blog system:

- **Frontend**: pure HTML/CSS/JS, zero build. Deploy the `frontend/` folder to Cloudflare Pages.
- **Backend**: single-file Cloudflare Worker + D1 (`backend/src/index.js`, zero npm dependencies).
- **Admin**: `/admin/` — login, post CRUD with Markdown preview, site settings, guestbook moderation.
- **Config-driven**: all personal info lives in `frontend/config.js` (copy from `config.example.js`).

See [docs/DEPLOY.md](docs/DEPLOY.md) for the full deployment guide and [docs/API.md](docs/API.md) for the API reference.

## License

MIT — see [LICENSE](LICENSE).
