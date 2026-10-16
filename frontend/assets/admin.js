/* Blog-OS 管理后台：登录 / 文章 CRUD / 设置 / 留言管理（原生 JS SPA） */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var API = (CFG.apiBase || "").replace(/\/$/, "") + "/api";
  var TOKEN_KEY = "blogos_admin_token";

  function token() { return localStorage.getItem(TOKEN_KEY) || ""; }
  function authHeaders(extra) {
    var h = extra || {};
    h["Authorization"] = "Bearer " + token();
    return h;
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

  /* ————— 登录页 ————— */
  var loginForm = document.getElementById("login-form");
  if (loginForm) {
    if (token()) { location.href = "/admin/dashboard.html"; return; }
    var errEl = document.getElementById("login-err");
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      errEl.textContent = "";
      var u = document.getElementById("username").value.trim() || "admin";
      var p = document.getElementById("password").value;
      fetch(API + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p })
      }).then(function (r) {
        if (!r.ok) throw new Error("unauthorized");
        return r.json();
      }).then(function (data) {
        localStorage.setItem(TOKEN_KEY, data.token);
        location.href = "/admin/dashboard.html";
      }).catch(function () {
        errEl.textContent = "用户名或密码错误";
      });
    });
    return;
  }

  /* ————— 仪表盘 ————— */
  if (!token()) { location.href = "/admin/"; return; }

  document.getElementById("logout-btn").addEventListener("click", function () {
    localStorage.removeItem(TOKEN_KEY);
    location.href = "/admin/";
  });

  // Tab 切换
  var tabs = document.querySelectorAll(".admin-tabs button");
  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabs.forEach(function (b) { b.classList.remove("on"); });
      btn.classList.add("on");
      ["posts", "editor", "settings", "messages"].forEach(function (t) {
        document.getElementById("tab-" + t).hidden = (t !== btn.dataset.tab);
      });
      if (btn.dataset.tab === "messages") loadMessages();
      if (btn.dataset.tab === "settings") loadSettings();
    });
  });
  function goTab(name) {
    document.querySelector('.admin-tabs button[data-tab="' + name + '"]').click();
  }

  function authedFetch(path, opts) {
    opts = opts || {};
    opts.headers = authHeaders(opts.headers || { "Content-Type": "application/json" });
    return fetch(API + path, opts).then(function (r) {
      if (r.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        location.href = "/admin/";
        throw new Error("unauthorized");
      }
      return r;
    });
  }

  /* —— 文章列表 —— */
  var editingSlug = null;

  function loadPosts() {
    var box = document.getElementById("post-list");
    box.innerHTML = '<p class="gb-empty">加载中…</p>';
    authedFetch("/posts?status=all").then(function (r) { return r.json(); })
      .then(function (data) {
        var posts = data.posts || [];
        if (!posts.length) {
          box.innerHTML = '<p class="gb-empty">还没有文章，去「写文章」创建第一篇吧。</p>';
          return;
        }
        box.innerHTML = "";
        posts.forEach(function (p) {
          var row = document.createElement("div");
          row.className = "post-row";
          row.innerHTML =
            '<span class="t">' + esc(p.title) + "</span>" +
            '<span class="s' + (p.status === "published" ? " pub" : "") + '">' +
            (p.status === "published" ? "已发布" : "草稿") + "</span>" +
            "<time>" + esc(fmtDate(p.created_at)) + "</time>";
          var edit = document.createElement("button");
          edit.className = "btn ghost small";
          edit.textContent = "编辑";
          edit.addEventListener("click", function () { startEdit(p.slug); });
          var del = document.createElement("button");
          del.className = "btn danger small";
          del.textContent = "删除";
          del.addEventListener("click", function () {
            if (!confirm("确定删除「" + p.title + "」？此操作不可恢复。")) return;
            authedFetch("/posts/" + encodeURIComponent(p.slug), { method: "DELETE" })
              .then(function () { loadPosts(); })
              .catch(function () { alert("删除失败"); });
          });
          var view = document.createElement("a");
          view.className = "btn ghost small";
          view.textContent = "查看";
          view.href = "/blog/post.html?slug=" + encodeURIComponent(p.slug);
          view.target = "_blank";
          view.rel = "noopener";
          row.appendChild(view);
          row.appendChild(edit);
          row.appendChild(del);
          box.appendChild(row);
        });
      })
      .catch(function () {
        box.innerHTML = '<p class="gb-empty">加载失败。</p>';
      });
  }

  function startEdit(slug) {
    authedFetch("/posts/" + encodeURIComponent(slug)).then(function (r) { return r.json(); })
      .then(function (p) {
        editingSlug = slug;
        document.getElementById("editor-title").textContent = "编辑文章";
        document.getElementById("f-title").value = p.title || "";
        document.getElementById("f-slug").value = p.slug || "";
        document.getElementById("f-slug").disabled = true;
        document.getElementById("f-excerpt").value = p.excerpt || "";
        document.getElementById("f-tags").value = p.tags || "";
        document.getElementById("f-status").value = p.status || "draft";
        document.getElementById("f-md").value = p.content_md || "";
        document.getElementById("cancel-btn").hidden = false;
        document.getElementById("preview-box").hidden = true;
        goTab("editor");
        window.scrollTo(0, 0);
      });
  }

  document.getElementById("cancel-btn").addEventListener("click", resetEditor);
  function resetEditor() {
    editingSlug = null;
    document.getElementById("editor-title").textContent = "写文章";
    document.getElementById("editor-form").reset();
    document.getElementById("f-slug").disabled = false;
    document.getElementById("cancel-btn").hidden = true;
    document.getElementById("preview-box").hidden = true;
    document.getElementById("editor-err").textContent = "";
    var aiSt = document.getElementById("ai-status");
    if (aiSt) aiSt.textContent = "";
  }

  // slug 自动生成
  document.getElementById("f-title").addEventListener("input", function (e) {
    var slugEl = document.getElementById("f-slug");
    if (editingSlug || slugEl.value) return;
    var s = e.target.value.toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-");
    // 中文标题没有英文字符时，用时间戳
    slugEl.value = s || ("post-" + Date.now().toString(36));
  });

  document.getElementById("preview-btn").addEventListener("click", function () {
    var box = document.getElementById("preview-box");
    var md = document.getElementById("f-md").value;
    authedFetch("/render", {
      method: "POST",
      body: JSON.stringify({ md: md })
    }).then(function (r) { return r.json(); })
      .then(function (data) {
        box.innerHTML = data.html || "";
        box.hidden = false;
      })
      .catch(function () { box.innerHTML = "<p>预览失败</p>"; box.hidden = false; });
  });

  /* —— AI 写作助手（本地 Ollama + Gemma，不上传云端） —— */
  var aiBtnIds = ["ai-excerpt-btn", "ai-tags-btn", "ai-title-btn"];
  var aiStatus = document.getElementById("ai-status");
  function setAiBusy(busy, msg) {
    aiBtnIds.forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.disabled = busy;
    });
    if (aiStatus) aiStatus.textContent = msg || "";
  }
  function clearAiStatusSoon() {
    setTimeout(function () {
      if (aiStatus && /✓$/.test(aiStatus.textContent)) aiStatus.textContent = "";
    }, 3000);
  }
  function aiAssist(kind) {
    var md = document.getElementById("f-md").value.trim();
    if (!md) { setAiBusy(false, "请先在正文写点内容"); return; }
    setAiBusy(true, "AI 生成中…（最长 30 秒）");
    authedFetch("/ai/" + kind, {
      method: "POST",
      body: JSON.stringify({ content: md })
    }).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, data: d }; });
    }).then(function (res) {
      if (!res.ok) throw new Error((res.data && res.data.error) || "生成失败");
      if (kind === "excerpt") {
        document.getElementById("f-excerpt").value = res.data.excerpt || "";
        setAiBusy(false, "摘要已填入 ✓");
      } else if (kind === "tags") {
        document.getElementById("f-tags").value = (res.data.tags || []).join(",");
        setAiBusy(false, "标签已填入 ✓");
      } else if (kind === "title") {
        document.getElementById("f-title").value = res.data.title || "";
        setAiBusy(false, "标题已填入 ✓");
      }
      clearAiStatusSoon();
    }).catch(function (e) {
      setAiBusy(false, e.message || "生成失败");
    });
  }
  if (document.getElementById("ai-excerpt-btn")) {
    document.getElementById("ai-excerpt-btn").addEventListener("click", function () { aiAssist("excerpt"); });
    document.getElementById("ai-tags-btn").addEventListener("click", function () { aiAssist("tags"); });
    document.getElementById("ai-title-btn").addEventListener("click", function () { aiAssist("title"); });
  }

  document.getElementById("editor-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var errEl = document.getElementById("editor-err");
    errEl.textContent = "";
    var payload = {
      title: document.getElementById("f-title").value.trim(),
      slug: document.getElementById("f-slug").value.trim(),
      excerpt: document.getElementById("f-excerpt").value.trim(),
      tags: document.getElementById("f-tags").value.trim(),
      status: document.getElementById("f-status").value,
      content_md: document.getElementById("f-md").value
    };
    if (!payload.title || !payload.slug) {
      errEl.textContent = "标题和 slug 必填";
      return;
    }
    var method = editingSlug ? "PUT" : "POST";
    var path = editingSlug ? "/posts/" + encodeURIComponent(editingSlug) : "/posts";
    authedFetch(path, { method: method, body: JSON.stringify(payload) })
      .then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      })
      .then(function () {
        resetEditor();
        loadPosts();
        goTab("posts");
      })
      .catch(function () {
        errEl.textContent = "保存失败（可能是 slug 已存在）";
      });
  });

  /* —— 设置 —— */
  function loadSettings() {
    var box = document.getElementById("settings-list");
    authedFetch("/settings").then(function (r) { return r.json(); })
      .then(function (data) {
        box.innerHTML = "";
        Object.keys(data.settings || {}).forEach(function (k) {
          addSettingRow(k, data.settings[k]);
        });
      });
  }
  function addSettingRow(k, v) {
    var box = document.getElementById("settings-list");
    var div = document.createElement("div");
    div.className = "kv";
    var ki = document.createElement("input");
    ki.value = k;
    var vi = document.createElement("input");
    vi.value = v;
    var del = document.createElement("button");
    del.className = "btn danger small";
    del.textContent = "删除";
    del.addEventListener("click", function () { div.remove(); });
    div.appendChild(ki);
    div.appendChild(vi);
    div.appendChild(del);
    box.appendChild(div);
  }
  document.getElementById("s-add").addEventListener("click", function () {
    var k = document.getElementById("s-key").value.trim();
    var v = document.getElementById("s-value").value;
    if (!k) return;
    addSettingRow(k, v);
    document.getElementById("s-key").value = "";
    document.getElementById("s-value").value = "";
  });
  document.getElementById("s-save").addEventListener("click", function () {
    var errEl = document.getElementById("settings-err");
    errEl.textContent = "";
    var obj = {};
    document.querySelectorAll("#settings-list .kv").forEach(function (div) {
      var ins = div.querySelectorAll("input");
      if (ins[0].value.trim()) obj[ins[0].value.trim()] = ins[1].value;
    });
    authedFetch("/settings", { method: "PUT", body: JSON.stringify({ settings: obj }) })
      .then(function (r) {
        if (!r.ok) throw new Error("save failed");
        errEl.textContent = "已保存 ✓";
        setTimeout(function () { errEl.textContent = ""; }, 2000);
      })
      .catch(function () { errEl.textContent = "保存失败"; });
  });

  /* —— 留言管理 —— */
  function loadMessages() {
    var box = document.getElementById("msg-list");
    box.innerHTML = '<p class="gb-empty">加载中…</p>';
    authedFetch("/guestbook?limit=100&offset=0").then(function (r) { return r.json(); })
      .then(function (data) {
        var items = data.messages || [];
        if (!items.length) {
          box.innerHTML = '<p class="gb-empty">还没有留言。</p>';
          return;
        }
        box.innerHTML = "";
        items.forEach(function (m) {
          var row = document.createElement("div");
          row.className = "post-row";
          var info = document.createElement("span");
          info.className = "t";
          info.textContent = m.name + "：" + m.text.slice(0, 60);
          info.title = m.text;
          var time = document.createElement("time");
          time.textContent = fmtDate(m.ts);
          var del = document.createElement("button");
          del.className = "btn danger small";
          del.textContent = "删除";
          del.addEventListener("click", function () {
            if (!confirm("删除这条留言？")) return;
            authedFetch("/guestbook/" + m.id, { method: "DELETE" })
              .then(function () { loadMessages(); });
          });
          row.appendChild(info);
          row.appendChild(time);
          row.appendChild(del);
          box.appendChild(row);
        });
      });
  }

  loadPosts();
})();
