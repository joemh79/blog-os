/* Blog-OS 后端本地测试：用 node:sqlite 模拟 D1，跑完整 API 流程
 * 用法：node test/run.mjs
 * 要求 Node >= 22.5（node:sqlite 内置） */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import worker, { sha256hex, buildExcerptPrompt, buildTagsPrompt, buildTitlePrompt, parseTags, callOllama } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(readFileSync(join(root, "migrations", "0001_init.sql"), "utf8"));

/* D1 兼容垫片：prepare().bind().first()/all()/run()/batch() */
function makeDB() {
  return {
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...params) { this._params = params; return this; },
        first() {
          const stmt = sqlite.prepare(this._sql);
          const row = stmt.get(...this._params);
          return row === undefined ? null : row;
        },
        all() {
          const stmt = sqlite.prepare(this._sql);
          return { results: stmt.all(...this._params) };
        },
        run() {
          const stmt = sqlite.prepare(this._sql);
          const info = stmt.run(...this._params);
          return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
        },
      };
    },
    async batch(stmts) {
      // D1 batch 按顺序执行
      const out = [];
      for (const s of stmts) out.push(s.run());
      return out;
    },
  };
}

const PASSWORD = "test-password-123";
const env = {
  DB: makeDB(),
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD_HASH: await sha256hex(PASSWORD),
  TOKEN_SECRET: "test-secret-xyz",
};

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ FAIL: " + name); }
}

async function call(method, path, { body = null, token = null, raw = false } = {}) {
  const headers = {};
  if (body !== null) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = "Bearer " + token;
  const req = new Request("https://test.local" + path, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });
  const res = await worker.fetch(req, env);
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, data, text };
}

console.log("— 认证 —");
{
  const bad = await call("POST", "/api/auth/login", { body: { username: "admin", password: "wrong" } });
  check("错误密码 → 401", bad.status === 401);
  const ok = await call("POST", "/api/auth/login", { body: { username: "admin", password: PASSWORD } });
  check("正确密码 → 200 + token", ok.status === 200 && typeof ok.data.token === "string");
  var TOKEN = ok.data.token;
  const me = await call("GET", "/api/auth/me", { token: TOKEN });
  check("token 有效 → /auth/me 200", me.status === 200 && me.data.username === "admin");
  const noAuth = await call("GET", "/api/auth/me");
  check("无 token → 401", noAuth.status === 401);
  const badToken = await call("GET", "/api/auth/me", { token: "bad.token" });
  check("伪造 token → 401", badToken.status === 401);
}

console.log("— 文章 —");
{
  const empty = await call("GET", "/api/posts");
  check("空列表 → posts: []", empty.status === 200 && Array.isArray(empty.data.posts) && empty.data.posts.length === 0);

  const unauth = await call("POST", "/api/posts", { body: { slug: "x", title: "x" } });
  check("未登录新建 → 401", unauth.status === 401);

  const badSlug = await call("POST", "/api/posts", { token: TOKEN, body: { slug: "Bad Slug!", title: "t" } });
  check("非法 slug → 400", badSlug.status === 400);

  const create = await call("POST", "/api/posts", {
    token: TOKEN,
    body: { slug: "hello-world", title: "Hello World", excerpt: "摘要", content_md: "# Hi\n\n**bold** and `code`", tags: "测试", status: "published" },
  });
  check("新建发布文章 → 201", create.status === 201);

  const dup = await call("POST", "/api/posts", {
    token: TOKEN,
    body: { slug: "hello-world", title: "dup" },
  });
  check("重复 slug → 409", dup.status === 409);

  const draft = await call("POST", "/api/posts", {
    token: TOKEN,
    body: { slug: "draft-one", title: "草稿", content_md: "draft body", status: "draft" },
  });
  check("新建草稿 → 201", draft.status === 201);

  const list = await call("GET", "/api/posts");
  check("公开列表只含已发布 → 1 篇", list.data.posts.length === 1 && list.data.posts[0].slug === "hello-world");
  check("列表不含正文", !("content_md" in list.data.posts[0]));

  const listAll = await call("GET", "/api/posts?status=all", { token: TOKEN });
  check("登录后 all → 2 篇", listAll.data.posts.length === 2);

  const get = await call("GET", "/api/posts/hello-world");
  check("文章详情 → 200 + HTML 渲染", get.status === 200 && get.data.content_html.includes("<h1>Hi</h1>") && get.data.content_html.includes("<strong>bold</strong>"));
  check("阅读时长字段", typeof get.data.reading === "number");

  const getDraftAnon = await call("GET", "/api/posts/draft-one");
  check("匿名看草稿 → 404", getDraftAnon.status === 404);
  const getDraftAuth = await call("GET", "/api/posts/draft-one", { token: TOKEN });
  check("登录看草稿 → 200", getDraftAuth.status === 200);

  const upd = await call("PUT", "/api/posts/hello-world", {
    token: TOKEN,
    body: { title: "Hello World v2", content_md: "updated", status: "published" },
  });
  check("更新 → 200", upd.status === 200);
  const get2 = await call("GET", "/api/posts/hello-world");
  check("更新生效", get2.data.title === "Hello World v2");

  const del = await call("DELETE", "/api/posts/draft-one", { token: TOKEN });
  check("删除 → 200", del.status === 200);
  const get3 = await call("GET", "/api/posts/draft-one", { token: TOKEN });
  check("删除后 → 404", get3.status === 404);
}

console.log("— 设置 —");
{
  const pub = await call("GET", "/api/settings");
  check("公开读取设置 → 200", pub.status === 200 && typeof pub.data.settings === "object");
  const put = await call("PUT", "/api/settings", { token: TOKEN, body: { settings: { announcement: "hello", n: "1" } } });
  check("登录写入设置 → 200", put.status === 200);
  const pub2 = await call("GET", "/api/settings");
  check("写入生效", pub2.data.settings.announcement === "hello");
  const unauth = await call("PUT", "/api/settings", { body: { settings: { x: "y" } } });
  check("未登录写设置 → 401", unauth.status === 401);
  const badKey = await call("PUT", "/api/settings", { token: TOKEN, body: { settings: { "bad key!": "v" } } });
  check("非法 key → 400", badKey.status === 400);
}

console.log("— 留言板 —");
{
  const post = await call("POST", "/api/guestbook", { body: { name: "测试员", text: "你好！" } });
  check("留言 → 201", post.status === 201);
  const honey = await call("POST", "/api/guestbook", { body: { name: "bot", text: "spam", website: "http://x" } });
  check("蜜罐 → 假成功 200", honey.status === 200);
  const list = await call("GET", "/api/guestbook");
  check("留言列表 → 1 条（蜜罐不计入）", list.data.total === 1 && list.data.messages.length === 1);
  check("留言不含 IP", !("ip" in list.data.messages[0]));
  // 限流：60 秒内第 4 条应 429（已发 1 条有效）
  await call("POST", "/api/guestbook", { body: { name: "a", text: "t2" } });
  await call("POST", "/api/guestbook", { body: { name: "a", text: "t3" } });
  const rl = await call("POST", "/api/guestbook", { body: { name: "a", text: "t4" } });
  check("高频留言 → 429", rl.status === 429);
  const del = await call("DELETE", "/api/guestbook/1", { token: TOKEN });
  check("登录删除留言 → 200", del.status === 200);
  const delAnon = await call("DELETE", "/api/guestbook/2");
  check("匿名删除留言 → 401", delAnon.status === 401);
}

console.log("— Markdown 渲染 —");
{
  const r = await call("POST", "/api/render", { token: TOKEN, body: { md: "## T\n\n- a\n- b\n\n> q\n\n```js\ncode()\n```\n\n![alt](/x.png)\n\n[link](https://e.com)" } });
  const h = r.data.html;
  check("标题/列表/引用/代码块/图片/链接",
    h.includes("<h2>T</h2>") && h.includes("<ul>") && h.includes("<blockquote>q</blockquote>") &&
    h.includes("<pre><code>") && h.includes('<img src="/x.png"') && h.includes('<a href="https://e.com"'));
  const xss = await call("POST", "/api/render", { token: TOKEN, body: { md: "<script>alert(1)</script>" } });
  check("HTML 转义防 XSS", !xss.data.html.includes("<script>") && xss.data.html.includes("&lt;script&gt;"));
}

console.log("— AI 写作助手 —");
{
  // prompt 构造（纯函数）
  const p1 = buildExcerptPrompt("测试内容 hello");
  check("摘要 prompt 包含正文", p1.includes("测试内容 hello") && p1.includes("摘要"));
  const p2 = buildTagsPrompt("测试内容");
  check("标签 prompt 包含正文", p2.includes("测试内容") && p2.includes("标签"));
  const p3 = buildTitlePrompt("测试内容");
  check("标题 prompt 包含正文", p3.includes("测试内容") && p3.includes("标题"));
  const long = "a".repeat(5000);
  check("超长正文被截断", buildExcerptPrompt(long).length < long.length + 200);

  // 标签解析（纯函数）
  check("parseTags 按行切分",
    JSON.stringify(parseTags("开源\n博客\n云")) === '["开源","博客","云"]');
  check("parseTags 去 # 号/序号/引号",
    JSON.stringify(parseTags("#开源\n1. 博客\n2. 云\n“测试”")) === '["开源","博客","云","测试"]');
  check("parseTags 去重并上限 5 个",
    JSON.stringify(parseTags("a\na\nb\nc\nd\ne\nf")) === '["a","b","c","d","e"]');
  check("parseTags 逗号切分",
    JSON.stringify(parseTags("开源,博客，云")) === '["开源","博客","云"]');
  check("parseTags 空输入 → []",
    JSON.stringify(parseTags("")) === "[]");

  // callOllama：mock fetch
  const mockFetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (!(url.endsWith("/api/generate") && body.model === "gemma3:4b" && body.stream === false && body.prompt === "hi"))
      throw new Error("unexpected request: " + url + " " + opts.body);
    return { ok: true, json: async () => ({ response: "  mock 摘要  " }) };
  };
  const t = await callOllama(env, "hi", mockFetch);
  check("callOllama 走 /api/generate 并 trim 返回", t === "mock 摘要");

  const httpErrFetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  let httpErr = false;
  try { await callOllama(env, "hi", httpErrFetch); } catch { httpErr = true; }
  check("Ollama 非 200 → 抛错", httpErr);

  const abortFetch = async () => { const e = new Error("x"); e.name = "AbortError"; throw e; };
  let timedOut = false;
  try { await callOllama(env, "hi", abortFetch); } catch (e) { timedOut = e.message === "timeout"; }
  check("AbortError → timeout", timedOut);

  // 路由：鉴权与参数
  const noAuth = await call("POST", "/api/ai/excerpt", { body: { content: "x" } });
  check("AI 未登录 → 401", noAuth.status === 401);
  const noContent = await call("POST", "/api/ai/tags", { token: TOKEN, body: {} });
  check("AI 无正文 → 400", noContent.status === 400);
  const noContent2 = await call("POST", "/api/ai/title", { token: TOKEN, body: { content: "   " } });
  check("AI 空白正文 → 400", noContent2.status === 400);

  // 路由：Ollama 不可达 → 503 中文友好错误（127.0.0.1:1 拒绝连接，立即失败）
  const envNoOllama = { ...env, OLLAMA_BASE_URL: "http://127.0.0.1:1" };
  async function callNoOllama(path) {
    const req = new Request("https://test.local" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + TOKEN },
      body: JSON.stringify({ content: "测试正文" }),
    });
    const res = await worker.fetch(req, envNoOllama);
    return { status: res.status, data: await res.json() };
  }
  for (const p of ["/api/ai/excerpt", "/api/ai/tags", "/api/ai/title"]) {
    const r = await callNoOllama(p);
    check(p + " 不可达 → 503", r.status === 503);
    check(p + " 503 带中文说明", typeof r.data.error === "string" && r.data.error.includes("Ollama"));
  }

  // 路由：mock Ollama HTTP 服务器 → 全链路成功
  const { createServer } = await import("node:http");
  const srv = createServer((req, res) => {
    let buf = "";
    req.on("data", (c) => { buf += c; });
    req.on("end", () => {
      const b = JSON.parse(buf);
      // 注意：摘要 prompt 里也有"标题"二字（作为否定要求），用完整短语区分
      const kind = b.prompt.includes("推荐 3-5 个中文标签") ? "tags"
        : b.prompt.includes("生成一个中文标题") ? "title" : "excerpt";
      const resp = kind === "tags" ? "开源\n博客\n云" : kind === "title" ? "  测试标题  " : "  这是一段测试摘要。  ";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ response: resp }));
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const envMock = { ...env, OLLAMA_BASE_URL: "http://127.0.0.1:" + srv.address().port };
  async function callMock(path) {
    const req = new Request("https://test.local" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + TOKEN },
      body: JSON.stringify({ content: "正文内容" }),
    });
    const res = await worker.fetch(req, envMock);
    return { status: res.status, data: await res.json() };
  }
  const e1 = await callMock("/api/ai/excerpt");
  check("mock 摘要 → 200 + trim", e1.status === 200 && e1.data.excerpt === "这是一段测试摘要。");
  const e2 = await callMock("/api/ai/tags");
  check("mock 标签 → 200 + 解析", e2.status === 200 && JSON.stringify(e2.data.tags) === '["开源","博客","云"]');
  const e3 = await callMock("/api/ai/title");
  check("mock 标题 → 200 + trim", e3.status === 200 && e3.data.title === "测试标题");
  srv.close();
}

console.log("— 其他 —");
{
  const h = await call("GET", "/api/health");
  check("健康检查", h.status === 200 && h.data.ok === true);
  const nf = await call("GET", "/api/nope");
  check("未知路由 → 404", nf.status === 404);
  const up = await call("POST", "/api/upload", { token: TOKEN, body: {} });
  check("未绑定 R2 上传 → 501", up.status === 501);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
