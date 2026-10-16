/* 由 seed-posts/*.md 生成 seed.sql
 * 用法：node seed/build-seed.mjs > seed.sql
 * Markdown 渲染复用 src/index.js 的 mdToHtml，保证与线上一致。 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mdToHtml } from "../src/index.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "seed-posts");
const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error("missing frontmatter");
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2].trim() + "\n" };
}

const sqlEscape = (s) => String(s ?? "").replace(/'/g, "''");

let out = "-- Blog-OS 示例数据（由 seed/build-seed.mjs 生成，请勿手改）\n";
out += "-- 导入：wrangler d1 execute blog-os-db --file=seed.sql\n\n";

const now = Math.floor(Date.now() / 1000);
files.forEach((f, i) => {
  const { meta, body } = parseFrontmatter(readFileSync(join(dir, f), "utf8"));
  const html = mdToHtml(body);
  const ts = now - (files.length - i) * 3600;
  out += `INSERT OR IGNORE INTO posts (slug,title,excerpt,content_md,content_html,tags,status,created_at,updated_at) VALUES (` +
    `'${sqlEscape(meta.slug)}','${sqlEscape(meta.title)}','${sqlEscape(meta.excerpt || "")}',` +
    `'${sqlEscape(body)}','${sqlEscape(html)}','${sqlEscape(meta.tags || "")}',` +
    `'${sqlEscape(meta.status || "published")}',${ts},${ts});\n`;
});

writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "seed.sql"), out);
console.log(`wrote seed.sql with ${files.length} posts`);
