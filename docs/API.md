# Blog-OS API 文档

> Base URL：`https://<你的worker>.workers.dev/api`
> 需要登录的接口在 Header 带：`Authorization: Bearer <token>`
> token 有效期 12 小时，通过 `POST /auth/login` 获取。

## 认证

### POST /api/auth/login

```json
// 请求
{ "username": "admin", "password": "你的密码" }
// 成功 200
{ "token": "eyJ1...", "expires_in": 43200 }
// 失败 401
{ "error": "invalid credentials" }
```

### GET /api/auth/me 🔒

```json
{ "username": "admin" }
```

## 文章

### GET /api/posts

公开：只返回 `published`。登录后加 `?status=all` 返回全部（含草稿）。

```json
{
  "posts": [
    {
      "id": 1, "slug": "welcome", "title": "欢迎",
      "excerpt": "摘要", "tags": "公告",
      "status": "published",
      "created_at": 1760000000, "updated_at": 1760000000
    }
  ]
}
```

> 列表不含正文（省流量），详情接口才返回 `content_md` / `content_html`。

### POST /api/posts 🔒

```json
// 请求
{
  "slug": "my-post",          // 必填，[a-z0-9-]
  "title": "标题",             // 必填
  "excerpt": "摘要",
  "content_md": "# 正文",      // Markdown，后端自动渲染成 content_html
  "tags": "标签1,标签2",
  "status": "draft"            // draft | published
}
// 成功 201
{ "ok": true, "slug": "my-post" }
// slug 重复 409
{ "error": "slug already exists" }
```

### GET /api/posts/:slug

公开（已发布）/ 登录可看草稿。返回完整字段，另带 `reading`（预计阅读分钟数）。

### PUT /api/posts/:slug 🔒

字段同 POST（slug 本身不可改），返回 `{ "ok": true }`。

### DELETE /api/posts/:slug 🔒

返回 `{ "ok": true }`。

### POST /api/render 🔒

Markdown 预览（管理后台编辑器用）。

```json
// 请求 { "md": "# hi" } → 返回
{ "html": "<h1>hi</h1>" }
```

## 设置

### GET /api/settings（公开）

```json
{ "settings": { "announcement": "", "posts_per_page": "50" } }
```

### PUT /api/settings 🔒

```json
// 请求
{ "settings": { "announcement": "新公告" } }
// key 规则：[a-zA-Z0-9_-]{1,64}
```

## 留言板

### GET /api/guestbook?limit=50&offset=0（公开）

```json
{
  "total": 3,
  "messages": [{ "id": 1, "name": "访客", "text": "你好", "ts": 1760000000 }]
}
```

### POST /api/guestbook（公开）

```json
// 请求
{ "name": "昵称", "text": "留言内容", "website": "" }
// website 是蜜罐字段：正常留空；机器人填了会收到假成功
// 成功 201 { "ok": true }
// 限流：同一 IP 60 秒内超过 3 条 → 429
```

### DELETE /api/guestbook/:id 🔒

## 图片上传

### POST /api/upload 🔒

`multipart/form-data`，字段名 `file`，最大 5MB。

```json
// 成功 201（需绑定 R2）
{ "ok": true, "key": "uploads/abc123.webp", "url": "/uploads/abc123.webp" }
// 未绑定 R2 → 501
{ "error": "R2 bucket not bound; bind R2 or host images elsewhere" }
```

上传后的文件通过 `GET /uploads/<key>` 访问（Worker 从 R2 读取并返回，带一年缓存）。

## 其他

### GET /api/health

```json
{ "ok": true, "time": 1760000000000 }
```

## 错误格式

所有错误统一为 `{ "error": "message" }`，HTTP 状态码：

| 码 | 含义 |
|---|---|
| 400 | 参数错误 |
| 401 | 未登录 / token 无效或过期 |
| 404 | 不存在 |
| 409 | slug 冲突 |
| 413 | 文件过大 |
| 429 | 限流 |
| 501 | 功能未配置（如未绑 R2） |
