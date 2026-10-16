# 部署指南 · 从零上线 Blog-OS（全免费）

> 预计 15 分钟。需要：一个 Cloudflare 账号（免费）、Node.js（本地装 wrangler 用）。

## 架构

```
用户 → Cloudflare Pages（前台 frontend/） → Cloudflare Worker（API）
                                              → D1（文章/设置/留言）
                                              → R2（可选，图片）
```

## 一、部署后台（Worker + D1）

### 1. 安装 wrangler 并登录

```bash
npm install -g wrangler
wrangler login
```

### 2. 创建 D1 数据库

```bash
cd backend
wrangler d1 create blog-os-db
```

把输出里的 `database_id` 填进 `wrangler.toml` 的 `database_id`。

### 3. 建表 + 导入示例文章（可选）

```bash
wrangler d1 migrations apply blog-os-db
# 示例文章（4 篇通用演示，可跳过）：
wrangler d1 execute blog-os-db --file=seed.sql
```

### 4. 设置密钥（重要）

管理员密码用 SHA-256 存，不存明文：

```bash
# 生成密码哈希（把 your-password 换成你的密码）
echo -n "your-password" | sha256sum | cut -d' ' -f1
wrangler secret put ADMIN_PASSWORD_HASH
# 粘贴上面生成的哈希

# token 签名密钥，随便找个随机字符串
openssl rand -hex 32
wrangler secret put TOKEN_SECRET
# 粘贴生成的随机串
```

`wrangler.toml` 里可以改 `ADMIN_USERNAME`（默认 `admin`）。

### 5. 部署

```bash
wrangler deploy
```

记下输出的 Worker 地址，如 `https://blog-os-api.<你的子域>.workers.dev`。

### 6.（可选）绑定 R2 做图床

```bash
wrangler r2 bucket create blog-os-uploads
```

然后取消 `wrangler.toml` 里 `[r2_buckets]` 的注释，重新 `wrangler deploy`。
不绑定也能用，只是 `/api/upload` 会返回 501，图片可以放 `frontend/assets/` 里引用。

## 二、部署前台（Pages）

### 方式 A：Dashboard 上传（最快）

1. 打开 Cloudflare Dashboard → Workers & Pages → Create → Pages → Upload assets
2. 把 `frontend/` 目录的内容打包成 zip 上传（注意：`config.js` 要先配好，见下）
3. 绑定自定义域名（可选）

### 方式 B：连 GitHub 自动部署

1. 把本仓库推到 GitHub
2. Pages → Create → Connect to Git → 选仓库
3. Build settings：Framework preset 选 None，Build output directory 填 `frontend`
4. ⚠️ `frontend/config.js` 在 `.gitignore` 里不会被提交——部署前在仓库里放一份 `frontend/config.js`
  （复制 `config.example.js` 改好），或部署后用 Pages 的文件管理补上。

### 配置 API 地址

打开 `frontend/config.js`，把 `apiBase` 填成 Worker 地址：

```js
apiBase: "https://blog-os-api.<你的子域>.workers.dev",
```

留空 `""` 也可以，但需要自己配反代把 `/api/*` 指到 Worker。

## 三、验证

1. 打开网站首页，确认显示你的名字/信息（不是示例的 Alex）
2. 打开 `/blog/`，确认示例文章列表出现
3. 打开 `/admin/`，用管理员账号登录
4. 写一篇测试文章 → 发布 → 去前台确认能看到
5. 在留言板留一条言 → 去后台「留言」确认能看到/删除

## 四、日常运维

| 事情 | 怎么做 |
|---|---|
| 写文章 | `/admin/` → 写文章 → 发布 |
| 改个人信息 | 改 `frontend/config.js` 后重新部署 Pages |
| 改站点设置 | `/admin/` → 设置（存 D1，实时生效） |
| 删示例文章 | `/admin/` → 文章 → 删除 |
| 换密码 | 重新生成哈希 → `wrangler secret put ADMIN_PASSWORD_HASH` → `wrangler deploy` |
| 备份 | `wrangler d1 export blog-os-db --output=backup.sql` |

## 五、常见问题

**Q: 前台显示了但文章列表是空的？**
A: 检查 `config.js` 的 `apiBase` 是否正确，浏览器 F12 看 `/api/posts` 请求是否 200。

**Q: /admin/ 登录 401？**
A: `ADMIN_PASSWORD_HASH` 生成时注意 `echo -n`（不要换行），以及 secret 是否 `wrangler deploy` 之后才生效——secret 是即时生效的，不用重新 deploy。

**Q: 跨域 CORS 报错？**
A: Worker 默认允许所有 Origin（`Access-Control-Allow-Origin: *` 逻辑见源码 `corsHeaders`）。生产环境建议改成你的前端域名。

**Q: 图片上传 501？**
A: 没绑 R2。按"一、6"绑定，或把图片放 `frontend/assets/`。
