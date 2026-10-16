/* ============================================================
 * Blog-OS · 站点配置文件（示例）
 * ------------------------------------------------------------
 * 使用方法：
 *   1. 复制本文件为 config.js：  cp config.example.js config.js
 *   2. 按注释修改下面的值，改成你自己的信息
 *   3. config.js 已在 .gitignore 中，不会被提交到仓库
 *
 * 所有前台页面（首页 / 博客 / 作品 / 站点 / 留言板 / 管理后台）
 * 的个人信息都从这里读取，HTML 里不要再硬编码。
 * ============================================================ */
window.SITE_CONFIG = {

  /* —— 基本信息 —— */
  siteName: "Your Name",          // 站点名 / 作者名（显示在顶栏、标题、页脚）
  tagline: "写代码，折腾东西",     // 首页标题后缀，如 "Your Name — 写代码，折腾东西"
  description: "一个极简的个人网站：写代码、折腾东西，偶尔写字。",
  email: "hi@example.com",        // 联系邮箱（首页"Say hi"面板 + 复制按钮）
  lang: "zh-CN",                  // 页面语言
  launchDate: "2026-01-01",       // 站点上线日期（用于"已运行 N 天"）

  /* —— 后端 API ——
   * 留空 "" 表示同源 /api（配合 _routes.json 或反代）；
   * 也可以填 Worker 完整地址，如 "https://blog-os-api.<you>.workers.dev" */
  apiBase: "",

  /* —— 首页 Hero 面板 —— */
  hero: {
    label: "个人网站",            // "01 · {siteName} · 个人网站" 中的后缀
    headline: ["写代码，", "折腾东西。"],  // 巨型标题（每行一个元素）
    bio: "域名是自己的，服务器是自己的，折腾也是自己的。",
    links: [
      { label: "写过的字", href: "/blog/" },
      { label: "我的项目", href: "/work/" }
    ]
  },

  /* —— 主题面板（BLOG / WORK / SITES 三个大词） —— */
  themes: [
    { word: "BLOG",  href: "/blog/",  label: "Blog · 博客",  aria: "博客文章" },
    { word: "WORK",  href: "/work/",  label: "Work · 项目",  aria: "做过的东西" },
    { word: "SITES", href: "/sites/", label: "Sites · 站点",  aria: "我的站点" }
  ],

  /* —— About 面板 —— */
  about: {
    label: "关于",
    lines: ["我是 Your Name，一个喜欢", "把东西亲手搭起来的人。"],
    sub: "域名、服务器上的每一个服务，都是自己配出来的。能静态就别动态。"
  },

  /* —— Contact 面板四角 —— */
  contact: {
    label: "联系",
    title: "Say hi.",
    corners: [
      { label: "Blog",   text: "文章 →",   href: "/blog/" },
      { label: "Work",   text: "项目 →",   href: "/work/" },
      { label: "Email",  text: "写邮件 →", href: "mailto:hi@example.com" },
      { label: "Local",  text: "",         clock: true }   // clock:true 显示本地时间
    ],
    guestbook: { label: "去留言板 →", href: "/guestbook/" }
  },

  /* —— Manifesto 宣言面板 —— */
  manifesto: {
    label: "宣言",
    lines: ["搭得快，", "看得顺，", "用得久。"],
    en: "Build fast, keep it smooth, make it last."
  },

  /* —— 页脚 —— */
  footer: {
    motto: "搭得快，看得顺，用得久。"
  },

  /* —— 博客区 —— */
  blog: {
    title: "BLOG",
    sub: "写过的字。",
    empty: "还没有文章，去管理后台写第一篇吧。"
  },

  /* —— 作品页（静态列表，从这里配置） —— */
  work: [
    { title: "示例项目", href: "#", tag: "Demo" }
  ],

  /* —— 站点页（卡片矩阵，从这里配置） —— */
  sites: [
    { title: "博客", sub: "文章", href: "/blog/" },
    { title: "留言板", sub: "说点什么", href: "/guestbook/" }
  ],

  /* —— 静态降级：API 不可用时显示的文章列表 —— */
  fallbackPosts: [
    { slug: "welcome", title: "欢迎使用 Blog-OS", date: "2026-01-01", tag: "公告" }
  ]
};
