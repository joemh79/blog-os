/* Blog-OS 博客前台：从 API 动态加载文章列表 / 文章详情
 * API 不可用时降级使用 config.js 里的 fallbackPosts。 */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var API = (CFG.apiBase || "").replace(/\/$/, "");

  function api(path) {
    return fetch(API + "/api" + path, { headers: { "Accept": "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtDate(ts) {
    var d = new Date(ts * 1000);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function shortDate(ts) {
    var d = new Date(ts * 1000);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  /* ————— 文章列表页 ————— */
  var rowsEl = document.getElementById("post-rows");
  if (rowsEl) {
    api("/posts").then(function (data) {
      renderList(data.posts || []);
    }).catch(function () {
      // 静态降级：用 config.fallbackPosts
      var fb = (CFG.fallbackPosts || []).map(function (p) {
        return { slug: p.slug, title: p.title, tag: p.tag, created_at: Date.parse(p.date + "T00:00:00") / 1000 || 0 };
      });
      renderList(fb, true);
    });

    function renderList(posts, isFallback) {
      rowsEl.innerHTML = "";
      if (!posts.length) {
        rowsEl.innerHTML = '<p class="gb-empty">' + esc(CFG.blog ? CFG.blog.empty : "暂无文章") + "</p>";
        return;
      }
      // 按年份分组
      var byYear = {};
      posts.forEach(function (p) {
        var y = new Date((p.created_at || 0) * 1000).getFullYear() || "";
        (byYear[y] = byYear[y] || []).push(p);
      });
      Object.keys(byYear).sort().reverse().forEach(function (y) {
        var h = document.createElement("h2");
        h.className = "year";
        h.textContent = y;
        rowsEl.appendChild(h);
        var div = document.createElement("div");
        div.className = "rows";
        byYear[y].forEach(function (p) {
          var a = document.createElement("a");
          a.className = "row";
          a.href = isFallback ? "#" : "/blog/post.html?slug=" + encodeURIComponent(p.slug);
          if (isFallback) a.addEventListener("click", function (e) { e.preventDefault(); });
          var tags = (p.tags || p.tag || "").toString().split(",").filter(Boolean);
          a.innerHTML =
            '<span class="arr">→</span><time>' + esc(shortDate(p.created_at)) + "</time>" +
            '<span class="t">' + esc(p.title) + "</span>" +
            (tags[0] ? '<span class="k">' + esc(tags[0]) + "</span>" : "");
          div.appendChild(a);
        });
        rowsEl.appendChild(div);
      });
    }
  }

  /* ————— 文章详情页 /blog/post.html?slug=xxx ————— */
  var postEl = document.getElementById("post-body");
  if (postEl) {
    var slug = new URLSearchParams(location.search).get("slug");
    if (!slug) {
      postEl.innerHTML = '<p class="gb-empty">缺少文章标识。</p>';
      return;
    }
    api("/posts/" + encodeURIComponent(slug)).then(function (p) {
      renderPost(p);
    }).catch(function () {
      postEl.innerHTML = '<p class="gb-empty">文章加载失败，API 不可用。</p>';
    });

    function renderPost(p) {
      document.title = p.title + " · " + (CFG.siteName || "");
      var meta = document.querySelector('meta[name="description"]');
      if (meta && p.excerpt) meta.setAttribute("content", p.excerpt);
      postEl.querySelector("[data-p=back]").textContent = "← " + (CFG.siteName || "");
      postEl.querySelector("[data-p=tag]").textContent = "Blog · " + ((p.tags || "").split(",")[0] || "");
      postEl.querySelector("[data-p=title]").textContent = p.title;
      var m = postEl.querySelector("[data-p=meta]");
      m.innerHTML = "<time>" + esc(fmtDate(p.created_at)) + "</time>" +
        ((p.tags || "").split(",").filter(Boolean).map(function (t) {
          return '<span class="k">' + esc(t.trim()) + "</span>";
        }).join("")) +
        (p.reading ? "<span>阅读约 " + esc(p.reading) + " 分钟</span>" : "");
      postEl.querySelector("[data-p=content]").innerHTML = p.content_html || "";
    }
  }
})();
