-- Blog-OS 示例数据（由 seed/build-seed.mjs 生成，请勿手改）
-- 导入：wrangler d1 execute blog-os-db --file=seed.sql

INSERT OR IGNORE INTO posts (slug,title,excerpt,content_md,content_html,tags,status,created_at,updated_at) VALUES ('design-notes','这个博客的设计思路','为什么是横向画廊 + 暖纸博客。','## 首页：横向画廊

首页借鉴了 Rauno 式的横向画廊：BLOG / WORK / SITES 三个巨型主题词，一屏一个，点进去才是内容。手机端和桌面端是同一套布局等比缩放，没有单独的移动端排版。

## 博客区：暖纸风

文章列表和正文是暖纸编辑风：暖米色底、衬线标题、陶土橙点缀。长文阅读不累眼。

## 技术选择

- 前台零构建：HTML + CSS + 原生 JS，没有框架，没有打包步骤
- 后台单文件 Worker：Cloudflare Worker + D1，API 全部手写，不依赖 npm 包
- 配置与代码分离：个人信息全在 `config.js`，换个文件就是你的博客
','<h2>首页：横向画廊</h2>
<p>首页借鉴了 Rauno 式的横向画廊：BLOG / WORK / SITES 三个巨型主题词，一屏一个，点进去才是内容。手机端和桌面端是同一套布局等比缩放，没有单独的移动端排版。</p>
<h2>博客区：暖纸风</h2>
<p>文章列表和正文是暖纸编辑风：暖米色底、衬线标题、陶土橙点缀。长文阅读不累眼。</p>
<h2>技术选择</h2>
<ul>
<li>前台零构建：HTML + CSS + 原生 JS，没有框架，没有打包步骤</li>
<li>后台单文件 Worker：Cloudflare Worker + D1，API 全部手写，不依赖 npm 包</li>
<li>配置与代码分离：个人信息全在 <code>config.js</code>，换个文件就是你的博客</li>
</ul>','设计','published',1792114673,1792114673);
INSERT OR IGNORE INTO posts (slug,title,excerpt,content_md,content_html,tags,status,created_at,updated_at) VALUES ('first-post','如何写第一篇文章','三步发布你的第一篇文章。','写文章只需要三步：

## 1. 打开管理后台

访问 `你的域名/admin/`，输入管理员账号密码登录。

## 2. 写文章

点「写文章」标签页，填标题、slug（英文短横线）、标签，正文用 Markdown 写。右边有「预览」按钮可以实时看效果。

## 3. 发布

状态选「发布」，点保存。文章会立刻出现在博客列表里。

> 小技巧：先存为草稿慢慢打磨，改好了再切到发布。
','<p>写文章只需要三步：</p>
<h2>1. 打开管理后台</h2>
<p>访问 <code>你的域名/admin/</code>，输入管理员账号密码登录。</p>
<h2>2. 写文章</h2>
<p>点「写文章」标签页，填标题、slug（英文短横线）、标签，正文用 Markdown 写。右边有「预览」按钮可以实时看效果。</p>
<h2>3. 发布</h2>
<p>状态选「发布」，点保存。文章会立刻出现在博客列表里。</p>
<blockquote>小技巧：先存为草稿慢慢打磨，改好了再切到发布。</blockquote>','指南','published',1792118273,1792118273);
INSERT OR IGNORE INTO posts (slug,title,excerpt,content_md,content_html,tags,status,created_at,updated_at) VALUES ('markdown-guide','Markdown 写作速查','后台编辑器支持的 Markdown 语法一览。','后台编辑器支持这些 Markdown 语法：

## 标题

```
# 一级标题
## 二级标题
### 三级标题
```

## 文本

**粗体**、*斜体*、`行内代码`，以及[链接](https://example.com)。

## 列表

- 无序列表项一
- 无序列表项二

1. 有序列表项一
2. 有序列表项二

## 引用与代码块

> 这是一段引用。

```js
console.log("hello, blog-os");
```

## 分隔线

---

就这些，够写博客了。
','<p>后台编辑器支持这些 Markdown 语法：</p>
<h2>标题</h2>
<pre><code># 一级标题
## 二级标题
### 三级标题</code></pre>
<h2>文本</h2>
<p><strong>粗体</strong>、<em>斜体</em>、<code>行内代码</code>，以及<a href="https://example.com" target="_blank" rel="noopener">链接</a>。</p>
<h2>列表</h2>
<ul>
<li>无序列表项一</li>
<li>无序列表项二</li>
</ul>
<ol>
<li>有序列表项一</li>
<li>有序列表项二</li>
</ol>
<h2>引用与代码块</h2>
<blockquote>这是一段引用。</blockquote>
<pre><code>console.log(&quot;hello, blog-os&quot;);</code></pre>
<h2>分隔线</h2>
<hr>
<p>就这些，够写博客了。</p>','指南','published',1792121873,1792121873);
INSERT OR IGNORE INTO posts (slug,title,excerpt,content_md,content_html,tags,status,created_at,updated_at) VALUES ('welcome','欢迎使用 Blog-OS','一个零构建、可自托管的极简个人博客系统。','欢迎来到 Blog-OS——一个为"搭得快、看得顺、用得久"而设计的个人博客系统。

## 它是什么

- **前台**：纯 HTML / CSS / JS，零构建，直接丢到 Cloudflare Pages 就能跑
- **后台**：Cloudflare Worker + D1，写文章、改设置、管留言，全在浏览器里完成
- **免费**：整套架构跑在 Cloudflare 免费额度内

## 从哪里开始

1. 去 `/admin/` 登录管理后台
2. 写第一篇文章，点"发布"
3. 回到首页看看效果

这篇欢迎文章就是用后台 Markdown 编辑器写出来的，你也可以随时编辑或删除它。
','<p>欢迎来到 Blog-OS——一个为&quot;搭得快、看得顺、用得久&quot;而设计的个人博客系统。</p>
<h2>它是什么</h2>
<ul>
<li><strong>前台</strong>：纯 HTML / CSS / JS，零构建，直接丢到 Cloudflare Pages 就能跑</li>
<li><strong>后台</strong>：Cloudflare Worker + D1，写文章、改设置、管留言，全在浏览器里完成</li>
<li><strong>免费</strong>：整套架构跑在 Cloudflare 免费额度内</li>
</ul>
<h2>从哪里开始</h2>
<ol>
<li>去 <code>/admin/</code> 登录管理后台</li>
<li>写第一篇文章，点&quot;发布&quot;</li>
<li>回到首页看看效果</li>
</ol>
<p>这篇欢迎文章就是用后台 Markdown 编辑器写出来的，你也可以随时编辑或删除它。</p>','公告','published',1792125473,1792125473);
