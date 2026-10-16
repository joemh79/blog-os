/* ============================================================
 * Blog-OS 后端 · Cloudflare Worker（单文件，零 npm 依赖）
 *
 * 环境变量（wrangler secret / vars）：
 *   ADMIN_USERNAME       管理员用户名（默认 admin）
 *   ADMIN_PASSWORD_HASH  管理员密码的 SHA-256 hex（必填，见 docs/DEPLOY.md 生成方法）
 *   TOKEN_SECRET         token 签名密钥（必填，随机字符串）
 *   OLLAMA_BASE_URL      AI 助手用的 Ollama 地址（默认 http://localhost:11434）
 *   OLLAMA_MODEL         AI 助手用的模型名（默认 gemma3:4b）
 * 绑定：
 *   DB   D1 数据库
 *   R2   （可选）图片存储桶，用于 /api/upload
 *
 * AI 写作助手：通过本地 Ollama 调用 Gemma 等开源权重模型。
 * 配置优先级：D1 settings 表（ollama_base_url / ollama_model）> 环境变量 > 默认值。
 * 注意：部署在 Cloudflare 上的 Worker 无法访问 localhost；
 * 本地 wrangler dev 或通过内网穿透暴露 Ollama 时可用。
 *
 * 本地测试：node test/run.mjs（用 node:sqlite 模拟 D1）
 * ============================================================ */

/* ————— 工具 ————— */

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function err(message, status = 400) {
  return json({ error: message }, status);
}

function corsHeaders(req) {
  // 生产环境建议收紧为你的前端域名
  const origin = req.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function sha256hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const b64e = (s) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64d = (s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

/* ————— Token（HMAC-SHA256 签名，payload: {u, exp}） ————— */

async function signToken(username, secret, ttlSec = 12 * 3600) {
  const payload = b64e(JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sigB64 = b64e(String.fromCharCode(...new Uint8Array(sig)));
  return payload + "." + sigB64;
}

async function verifyToken(token, secret) {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const expect = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const expectB64 = b64e(String.fromCharCode(...new Uint8Array(expect)));
    if (sig !== expectB64) return null;
    const data = JSON.parse(b64d(payload));
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data.u;
  } catch {
    return null;
  }
}

async function requireAuth(req, env) {
  const h = req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  if (!env.TOKEN_SECRET) return null;
  return verifyToken(m[1].trim(), env.TOKEN_SECRET);
}

/* ————— 极简 Markdown → HTML（与前端预览共用逻辑的子集） ————— */

function mdInline(s) {
  s = esc(s);
  // 图片 ![alt](src)
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  // 链接 [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // 行内代码 `x`
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  // 粗体 **x**
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // 斜体 *x*
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return s;
}

function mdToHtml(md) {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let inCode = false;
  let codeBuf = [];
  let listStack = []; // 'ul' | 'ol'
  let para = [];

  function flushPara() {
    if (para.length) {
      html += "<p>" + para.map(mdInline).join("<br>") + "</p>\n";
      para = [];
    }
  }
  function closeLists() {
    while (listStack.length) html += "</" + listStack.pop() + ">\n";
  }

  for (const raw of lines) {
    const line = raw;
    // 代码块 ```
    if (/^```/.test(line)) {
      if (inCode) {
        html += "<pre><code>" + esc(codeBuf.join("\n")) + "</code></pre>\n";
        codeBuf = [];
        inCode = false;
      } else {
        flushPara(); closeLists();
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      flushPara(); closeLists();
      const lv = m[1].length;
      html += `<h${lv}>${mdInline(m[2])}</h${lv}>\n`;
    } else if (/^---+$/.test(line.trim())) {
      flushPara(); closeLists();
      html += "<hr>\n";
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara(); closeLists();
      html += "<blockquote>" + mdInline(m[1]) + "</blockquote>\n";
    } else if ((m = line.match(/^(\s*)[-*]\s+(.*)$/))) {
      flushPara();
      if (listStack[listStack.length - 1] !== "ul") { closeLists(); html += "<ul>\n"; listStack.push("ul"); }
      html += "<li>" + mdInline(m[2]) + "</li>\n";
    } else if ((m = line.match(/^(\s*)\d+[.)]\s+(.*)$/))) {
      flushPara();
      if (listStack[listStack.length - 1] !== "ol") { closeLists(); html += "<ol>\n"; listStack.push("ol"); }
      html += "<li>" + mdInline(m[2]) + "</li>\n";
    } else if (/^\s*$/.test(line)) {
      flushPara(); closeLists();
    } else {
      para.push(line);
    }
  }
  flushPara(); closeLists();
  return html.trim();
}

function readingMinutes(md) {
  const words = String(md || "").replace(/[#>*`\[\]()!-]/g, " ").split(/\s+/).filter(Boolean).length;
  const cjk = (String(md || "").match(/[\u4e00-\u9fff]/g) || []).length;
  return Math.max(1, Math.round((words + cjk) / 300));
}

/* ————— AI 写作助手（Ollama 本地大模型，open-weight） ————— */

const AI_TIMEOUT_MS = 30000;   // 单次调用 30 秒超时
const AI_MAX_INPUT = 4000;     // 送给模型的正文上限（字符）

async function aiConfig(env) {
  let baseUrl = "";
  let model = "";
  try {
    const b = await env.DB.prepare("SELECT value FROM settings WHERE key='ollama_base_url'").first();
    const m = await env.DB.prepare("SELECT value FROM settings WHERE key='ollama_model'").first();
    baseUrl = (b && b.value) || "";
    model = (m && m.value) || "";
  } catch { /* settings 表不可用时忽略，走环境变量 */ }
  baseUrl = baseUrl || env.OLLAMA_BASE_URL || "http://localhost:11434";
  model = model || env.OLLAMA_MODEL || "gemma3:4b";
  return { baseUrl: baseUrl.replace(/\/+$/, ""), model };
}

function truncateInput(s) {
  s = String(s || "").trim();
  return s.length > AI_MAX_INPUT ? s.slice(0, AI_MAX_INPUT) + "\n…（内容过长已截断）" : s;
}

/* 纯函数：构造 prompt（导出供测试） */
function buildExcerptPrompt(content) {
  return (
    "你是一个中文博客写作助手。请为以下博客文章生成一段中文摘要。\n" +
    "要求：\n" +
    "1. 50-100 字，只输出摘要正文\n" +
    "2. 不要加引号、标题、前缀或任何解释\n" +
    "3. 语言简洁，突出文章核心观点\n\n" +
    "文章内容：\n---\n" + truncateInput(content) + "\n---"
  );
}

function buildTagsPrompt(content) {
  return (
    "你是一个中文博客写作助手。请为以下博客文章推荐 3-5 个中文标签。\n" +
    "要求：\n" +
    "1. 每行只输出一个标签，不要加 # 号、序号或任何解释\n" +
    "2. 每个标签 2-6 个字\n\n" +
    "文章内容：\n---\n" + truncateInput(content) + "\n---"
  );
}

function buildTitlePrompt(content) {
  return (
    "你是一个中文博客写作助手。请为以下博客文章生成一个中文标题。\n" +
    "要求：\n" +
    "1. 只输出标题本身，不要加引号、书名号或任何解释\n" +
    "2. 20 字以内，简洁且有吸引力\n\n" +
    "文章内容：\n---\n" + truncateInput(content) + "\n---"
  );
}

/* 纯函数：解析模型返回的标签（按行/逗号切分，清洗，最多 5 个） */
function parseTags(text) {
  return String(text || "")
    .split(/[\n,，、]/)
    .map((t) => t.trim()
      .replace(/^#+\s*/, "")
      .replace(/^[0-9]+[.)、:：]\s*/, "")
      .replace(/^["「『“]/, "")
      .replace(/["」』”]$/, ""))
    .filter((t) => t.length >= 1 && t.length <= 12)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 5);
}

const AI_UNAVAILABLE =
  "AI 服务不可用：请确认已在本地运行 Ollama（ollama serve）并已拉取模型（ollama pull gemma3:4b）；" +
  "线上部署的 Worker 无法访问 localhost，可通过环境变量 OLLAMA_BASE_URL 指向可访问的 Ollama 地址";

/* 调用 Ollama /api/generate；fetchFn 可注入，便于测试时 mock */
async function callOllama(env, prompt, fetchFn) {
  const { baseUrl, model } = await aiConfig(env);
  const fn = fetchFn || fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fn(baseUrl + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error("ollama status " + res.status);
    const data = await res.json();
    const text = data && data.response ? String(data.response).trim() : "";
    if (!text) throw new Error("empty response");
    return text;
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/* 导出给本地工具（seed 生成 / 测试）复用；Worker 运行时只用 default */
export { mdToHtml, mdInline, sha256hex, buildExcerptPrompt, buildTagsPrompt, buildTitlePrompt, parseTags, callOllama };

/* ————— 路由 ————— */

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const withCors = (res) => {
      const h = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) h.set(k, v);
      return new Response(res.body, { status: res.status, headers: h });
    };

    try {
      const res = await route(req, env, url, path);
      return withCors(res);
    } catch (e) {
      return withCors(err("internal error", 500));
    }
  },
};

async function route(req, env, url, path) {
  const method = req.method;
  if (!env.DB) return err("D1 database not bound (env.DB)", 500);

  const body = async () => {
    try { return await req.json(); } catch { return {}; }
  };

  /* 健康检查 */
  if (path === "/api/health" && method === "GET") {
    return json({ ok: true, time: Date.now() });
  }

  /* Markdown 预览（需登录，供后台编辑器用） */
  if (path === "/api/render" && method === "POST") {
    if (!(await requireAuth(req, env))) return err("unauthorized", 401);
    const { md } = await body();
    return json({ html: mdToHtml(md || "") });
  }

  /* —— AI 写作助手（需登录；依赖本地 Ollama + Gemma 等开源模型） —— */
  if (path === "/api/ai/excerpt" && method === "POST") {
    if (!(await requireAuth(req, env))) return err("unauthorized", 401);
    const { content } = await body();
    if (!content || !String(content).trim()) return err("content is required", 400);
    try {
      const text = await callOllama(env, buildExcerptPrompt(content));
      return json({ excerpt: text.replace(/\s+/g, " ").trim().slice(0, 200) });
    } catch {
      return err(AI_UNAVAILABLE, 503);
    }
  }

  if (path === "/api/ai/tags" && method === "POST") {
    if (!(await requireAuth(req, env))) return err("unauthorized", 401);
    const { content } = await body();
    if (!content || !String(content).trim()) return err("content is required", 400);
    try {
      const text = await callOllama(env, buildTagsPrompt(content));
      return json({ tags: parseTags(text) });
    } catch {
      return err(AI_UNAVAILABLE, 503);
    }
  }

  if (path === "/api/ai/title" && method === "POST") {
    if (!(await requireAuth(req, env))) return err("unauthorized", 401);
    const { content } = await body();
    if (!content || !String(content).trim()) return err("content is required", 400);
    try {
      const text = await callOllama(env, buildTitlePrompt(content));
      const title = text.split("\n")[0].trim()
        .replace(/^["「『“]/, "").replace(/["」』”]$/, "").slice(0, 60);
      return json({ title });
    } catch {
      return err(AI_UNAVAILABLE, 503);
    }
  }

  /* —— 认证 —— */
  if (path === "/api/auth/login" && method === "POST") {
    const { username, password } = await body();
    const wantUser = env.ADMIN_USERNAME || "admin";
    if (!env.ADMIN_PASSWORD_HASH) return err("server not configured", 500);
    const got = await sha256hex(String(password || ""));
    // 常量时间比较
    let ok = username === wantUser && got.length === env.ADMIN_PASSWORD_HASH.length;
    if (ok) {
      let diff = 0;
      for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ env.ADMIN_PASSWORD_HASH.charCodeAt(i);
      ok = diff === 0;
    }
    if (!ok) return err("invalid credentials", 401);
    if (!env.TOKEN_SECRET) return err("server not configured", 500);
    const token = await signToken(wantUser, env.TOKEN_SECRET);
    return json({ token, expires_in: 12 * 3600 });
  }

  if (path === "/api/auth/me" && method === "GET") {
    const u = await requireAuth(req, env);
    if (!u) return err("unauthorized", 401);
    return json({ username: u });
  }

  /* —— 文章 —— */
  if (path === "/api/posts" && method === "GET") {
    const status = url.searchParams.get("status") || "published";
    let rows;
    if (status === "all") {
      if (!(await requireAuth(req, env))) return err("unauthorized", 401);
      rows = await env.DB.prepare(
        "SELECT id,slug,title,excerpt,tags,status,created_at,updated_at FROM posts ORDER BY created_at DESC"
      ).all();
    } else {
      rows = await env.DB.prepare(
        "SELECT id,slug,title,excerpt,tags,status,created_at,updated_at FROM posts WHERE status='published' ORDER BY created_at DESC"
      ).all();
    }
    return json({ posts: rows.results || [] });
  }

  if (path === "/api/posts" && method === "POST") {
    if (!(await requireAuth(req, env))) return err("unauthorized", 401);
    const { slug, title, excerpt = "", content_md = "", tags = "", status = "draft" } = await body();
    if (!slug || !title) return err("slug and title are required", 400);
    if (!/^[a-z0-9-]+$/.test(slug)) return err("slug must match [a-z0-9-]", 400);
    if (!["draft", "published"].includes(status)) return err("bad status", 400);
    const now = Math.floor(Date.now() / 1000);
    const html = mdToHtml(content_md);
    try {
      await env.DB.prepare(
        "INSERT INTO posts (slug,title,excerpt,content_md,content_html,tags,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?, ?,?)"
      ).bind(slug, title, excerpt, content_md, html, tags, status, now, now).run();
    } catch (e) {
      return err("slug already exists", 409);
    }
    return json({ ok: true, slug }, 201);
  }

  const postMatch = path.match(/^\/api\/posts\/([^/]+)$/);
  if (postMatch) {
    const slug = decodeURIComponent(postMatch[1]);
    if (method === "GET") {
      const row = await env.DB.prepare("SELECT * FROM posts WHERE slug=?").bind(slug).first();
      if (!row) return err("not found", 404);
      if (row.status !== "published") {
        if (!(await requireAuth(req, env))) return err("not found", 404);
      }
      row.reading = readingMinutes(row.content_md);
      return json(row);
    }
    if (!(await requireAuth(req, env))) return err("unauthorized", 401);
    if (method === "PUT") {
      const { title, excerpt = "", content_md = "", tags = "", status } = await body();
      const cur = await env.DB.prepare("SELECT id FROM posts WHERE slug=?").bind(slug).first();
      if (!cur) return err("not found", 404);
      if (status && !["draft", "published"].includes(status)) return err("bad status", 400);
      const now = Math.floor(Date.now() / 1000);
      const html = mdToHtml(content_md);
      await env.DB.prepare(
        "UPDATE posts SET title=?,excerpt=?,content_md=?,content_html=?,tags=?,status=?,updated_at=? WHERE slug=?"
      ).bind(title || "", excerpt, content_md, html, tags, status || "draft", now, slug).run();
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await env.DB.prepare("DELETE FROM posts WHERE slug=?").bind(slug).run();
      return json({ ok: true });
    }
    return err("method not allowed", 405);
  }

  /* —— 设置 —— */
  if (path === "/api/settings" && method === "GET") {
    const rows = await env.DB.prepare("SELECT key,value FROM settings").all();
    const obj = {};
    for (const r of rows.results || []) obj[r.key] = r.value;
    return json({ settings: obj });
  }
  if (path === "/api/settings" && method === "PUT") {
    if (!(await requireAuth(req, env))) return err("unauthorized", 401);
    const { settings } = await body();
    if (!settings || typeof settings !== "object") return err("settings object required", 400);
    const stmts = [];
    for (const [k, v] of Object.entries(settings)) {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(k)) return err("bad key: " + k, 400);
      stmts.push(env.DB.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k, String(v)));
    }
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true });
  }

  /* —— 留言板 —— */
  if (path === "/api/guestbook" && method === "GET") {
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));
    const total = await env.DB.prepare("SELECT COUNT(*) AS c FROM messages").first();
    const rows = await env.DB.prepare(
      "SELECT id,name,text,ts FROM messages ORDER BY ts DESC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    return json({ total: total ? total.c : 0, messages: rows.results || [] });
  }

  if (path === "/api/guestbook" && method === "POST") {
    const { name, text, website } = await body();
    if (website) return json({ ok: true }); // 蜜罐：机器人直接"成功"
    const n = String(name || "").trim().slice(0, 30);
    const t = String(text || "").trim().slice(0, 500);
    if (!n || !t) return err("name and text are required", 400);
    // 简单限流：同一 IP 60 秒内最多 3 条
    const ip = req.headers.get("CF-Connecting-IP") || "unknown";
    const since = Math.floor(Date.now() / 1000) - 60;
    const cnt = await env.DB.prepare("SELECT COUNT(*) AS c FROM messages WHERE ip=? AND ts>?").bind(ip, since).first();
    if (cnt && cnt.c >= 3) return err("too many requests, slow down", 429);
    const ts = Math.floor(Date.now() / 1000);
    await env.DB.prepare("INSERT INTO messages (name,text,ts,ip) VALUES (?,?,?,?)").bind(n, t, ts, ip).run();
    return json({ ok: true }, 201);
  }

  const msgMatch = path.match(/^\/api\/guestbook\/(\d+)$/);
  if (msgMatch && method === "DELETE") {
    if (!(await requireAuth(req, env))) return err("unauthorized", 401);
    await env.DB.prepare("DELETE FROM messages WHERE id=?").bind(parseInt(msgMatch[1], 10)).run();
    return json({ ok: true });
  }

  /* —— R2 静态文件（/uploads/*，需绑定 R2） —— */
  if (path.startsWith("/uploads/") && method === "GET") {
    if (!env.R2) return err("R2 bucket not bound", 501);
    const key = path.slice(1); // 去掉开头的 /
    const obj = await env.R2.get(key);
    if (!obj) return err("not found", 404);
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=31536000");
    headers.set("ETag", obj.httpEtag);
    return new Response(obj.body, { headers });
  }

  /* —— 图片上传（需绑定 R2；未绑定时返回 501 说明） —— */
  if (path === "/api/upload" && method === "POST") {
    if (!(await requireAuth(req, env))) return err("unauthorized", 401);
    if (!env.R2) return err("R2 bucket not bound; bind R2 or host images elsewhere", 501);
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return err("file field required", 400);
    if (file.size > 5 * 1024 * 1024) return err("file too large (max 5MB)", 413);
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const key = "uploads/" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
    await env.R2.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
    return json({ ok: true, key, url: "/uploads/" + key }, 201);
  }

  return err("not found", 404);
}
