/* Blog-OS 前台交互：配置应用 / 横向画廊引擎 / 邮箱复制 / 运行天数
 * 零构建，纯原生 JS。个人信息全部来自 /config.js（window.SITE_CONFIG）。 */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};

  function get(path, fallback) {
    var parts = path.split(".");
    var cur = CFG;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== "object") return fallback;
      cur = cur[parts[i]];
    }
    return cur === undefined ? fallback : cur;
  }

  /* ————— 配置应用：data-cfg="a.b.c" → textContent；data-cfg-attr="href:a.b" ————— */
  function applyConfig() {
    document.querySelectorAll("[data-cfg]").forEach(function (el) {
      var v = get(el.getAttribute("data-cfg"), null);
      if (v !== null && v !== undefined) el.textContent = v;
    });
    document.querySelectorAll("[data-cfg-attr]").forEach(function (el) {
      var spec = el.getAttribute("data-cfg-attr").split(":");
      var v = get(spec[1], null);
      if (v !== null && v !== undefined) el.setAttribute(spec[0], v);
    });
    document.querySelectorAll("[data-cfg-html]").forEach(function (el) {
      var v = get(el.getAttribute("data-cfg-html"), null);
      if (v !== null && v !== undefined) el.innerHTML = v;
    });
    if (CFG.lang) document.documentElement.lang = CFG.lang;
    // <title> 模板："{siteName} — {tagline}"
    var t = document.querySelector("title[data-cfg-title]");
    if (t) t.textContent = get("siteName", "") + " — " + get("tagline", "");
  }

  /* 运行天数：上线日期来自 config.launchDate */
  function renderDays() {
    var daysEl = document.getElementById("days");
    if (daysEl) {
      var start = new Date(get("launchDate", "2026-01-01") + "T00:00:00");
      var now = new Date();
      var d = Math.max(1, Math.floor((now - start) / 86400000) + 1);
      daysEl.textContent = d;
    }
    var yearEls = document.querySelectorAll("#year,.js-year");
    yearEls.forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* Hero 巨型标题：从 config.hero.headline 逐行动画生成 */
  function renderHero() {
    var h1 = document.querySelector("h1.giant[data-cfg-hero]");
    if (!h1) return;
    var lines = get("hero.headline", []);
    h1.innerHTML = "";
    lines.forEach(function (line, i) {
      var rl = document.createElement("span");
      rl.className = "rl" + (i % 2 === 1 ? " off" : "");
      rl.style.setProperty("--d", (0.05 + i * 0.13).toFixed(2) + "s");
      var inner = document.createElement("span");
      inner.textContent = line;
      rl.appendChild(inner);
      h1.appendChild(rl);
    });
    var bio = document.querySelector("[data-cfg-hero-bio]");
    if (bio) {
      bio.innerHTML = "";
      var brl = document.createElement("span");
      brl.className = "rl";
      brl.style.setProperty("--d", ".32s");
      var binner = document.createElement("span");
      binner.textContent = get("hero.bio", "");
      brl.appendChild(binner);
      bio.appendChild(brl);
    }
    // hero 链接
    var nav = document.querySelector(".hero-links[data-cfg-hero-links]");
    if (nav) {
      nav.innerHTML = "";
      get("hero.links", []).forEach(function (l) {
        var a = document.createElement("a");
        a.href = l.href;
        var t = document.createElement("span");
        t.className = "t";
        t.textContent = l.label;
        var arr = document.createElement("span");
        arr.className = "arr";
        arr.textContent = "→";
        a.appendChild(t);
        a.appendChild(arr);
        nav.appendChild(a);
      });
      var email = get("email", "");
      if (email) {
        var btn = document.createElement("button");
        btn.className = "copybtn";
        btn.setAttribute("data-copy", email);
        var swap = document.createElement("span");
        swap.className = "swap";
        var t1 = document.createElement("span");
        t1.className = "t1";
        t1.textContent = email;
        var t2 = document.createElement("span");
        t2.className = "t2";
        t2.textContent = "Copied ✓";
        swap.appendChild(t1);
        swap.appendChild(t2);
        btn.appendChild(swap);
        nav.appendChild(btn);
      }
    }
  }

  /* 主题面板（BLOG/WORK/SITES）：从 config.themes 生成 */
  function renderThemes() {
    var host = document.getElementById("theme-panels");
    if (!host) return;
    var themes = get("themes", []);
    host.innerHTML = "";
    themes.forEach(function (th) {
      var sec = document.createElement("section");
      sec.className = "panel";
      var label = document.createElement("p");
      label.className = "label theme-label";
      label.textContent = th.label;
      var clip = document.createElement("div");
      clip.className = "theme-clip";
      var a = document.createElement("a");
      a.className = "theme-link";
      a.href = th.href;
      a.setAttribute("aria-label", th.aria || th.word);
      var word = document.createElement("span");
      word.className = "theme-word w-" + th.word.toLowerCase();
      word.textContent = th.word;
      a.appendChild(word);
      clip.appendChild(a);
      sec.appendChild(label);
      sec.appendChild(clip);
      host.appendChild(sec);
    });
  }

  /* About 面板 */
  function renderAbout() {
    var box = document.querySelector(".about-lines[data-cfg-about]");
    if (box) {
      box.innerHTML = "";
      get("about.lines", []).forEach(function (line, i) {
        var rl = document.createElement("span");
        rl.className = "rl";
        rl.style.setProperty("--d", (0.05 + i * 0.1).toFixed(2) + "s");
        var inner = document.createElement("span");
        inner.textContent = line;
        rl.appendChild(inner);
        box.appendChild(rl);
      });
    }
  }

  /* Contact 面板四角 */
  function renderContact() {
    var box = document.querySelector(".contact-center[data-cfg-contact]");
    if (!box) return;
    var corners = get("contact.corners", []);
    var pos = ["tl", "tr", "bl", "br"];
    // 清掉旧的 corner（保留 contact-center 主体）
    box.querySelectorAll(".corner").forEach(function (c) { c.remove(); });
    corners.forEach(function (c, i) {
      var div = document.createElement("div");
      div.className = "corner " + (pos[i] || "tl");
      var lab = document.createElement("span");
      lab.textContent = c.label;
      div.appendChild(lab);
      if (c.clock) {
        var t = document.createElement("span");
        t.className = "t";
        t.id = "localtime";
        t.textContent = "--:--";
        div.appendChild(t);
      } else if (c.href) {
        var a = document.createElement("a");
        a.href = c.href;
        a.textContent = c.text;
        div.appendChild(a);
      } else {
        var s = document.createElement("span");
        s.textContent = c.text;
        div.appendChild(s);
      }
      box.appendChild(div);
    });
    var gb = box.querySelector("[data-cfg-gb]");
    if (gb) {
      gb.textContent = get("contact.guestbook.label", "");
      gb.setAttribute("href", get("contact.guestbook.href", "/guestbook/"));
    }
    var mail = box.querySelector("[data-cfg-contact-email]");
    if (mail) {
      var email = get("email", "");
      mail.querySelector(".t1").textContent = email + "（点击复制）";
      mail.setAttribute("data-copy", email);
    }
  }

  /* Manifesto 面板 */
  function renderManifesto() {
    var box = document.querySelector(".mani-lines[data-cfg-manifesto]");
    if (box) {
      box.innerHTML = "";
      get("manifesto.lines", []).forEach(function (line, i) {
        var rl = document.createElement("span");
        rl.className = "rl";
        rl.style.setProperty("--d", (0.05 + i * 0.15).toFixed(2) + "s");
        var inner = document.createElement("span");
        inner.textContent = line;
        rl.appendChild(inner);
        box.appendChild(rl);
      });
    }
    var en = document.querySelector("[data-cfg-manifesto-en]");
    if (en) en.querySelector("span").textContent = get("manifesto.en", "");
  }

  applyConfig();
  renderDays();
  renderHero();
  renderThemes();
  renderAbout();
  renderContact();
  renderManifesto();

  /* Say hi 右下角：本地时间，每 15 秒刷新 */
  var ltEl = document.getElementById("localtime");
  if (ltEl) {
    function tickClock() {
      var d = new Date();
      function p2(n) { return ("0" + n).slice(-2); }
      ltEl.textContent = p2(d.getHours()) + ":" + p2(d.getMinutes());
    }
    tickClock();
    setInterval(tickClock, 15000);
  }

  /* 中央十字：点击切换草图模式 */
  var cross = document.getElementById("cross");
  if (cross) cross.addEventListener("click", function () {
    var on = document.body.getAttribute("data-debug") === "true";
    document.body.setAttribute("data-debug", on ? "false" : "true");
  });

  /* Email 点击复制：文字上滑切换 Copied（事件委托，支持动态生成的按钮） */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copybtn");
    if (!btn) return;
    var text = btn.getAttribute("data-copy") || "";
    function done() {
      btn.classList.add("ok");
      setTimeout(function () { btn.classList.remove("ok"); }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(done);
    } else {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      document.body.removeChild(ta);
      done();
    }
  });

  /* ————— 横向画廊引擎（与原站一致） ————— */
  var stage = document.getElementById("stage");
  var ghost = document.getElementById("ghost");
  var minimap = document.getElementById("minimap");
  if (!stage || !ghost) return; // 纵向页面直接退出

  var DESIGN_W = 1300, DESIGN_H = 1020;
  var PANEL_W = 1160, PANEL_H = 700, GAP = 56;
  var panels = Array.prototype.slice.call(stage.querySelectorAll(".panel"));
  var N = panels.length;
  var totalW = N * PANEL_W + (N - 1) * GAP;
  var labels = Array.prototype.slice.call(stage.querySelectorAll(".label"));

  var ticks = [];
  if (minimap) {
    panels.forEach(function () {
      var i = document.createElement("i");
      minimap.appendChild(i);
      ticks.push(i);
    });
    var tracker = document.createElement("div");
    tracker.className = "tracker";
    minimap.appendChild(tracker);
    var scrubbing = false;
    function seek(clientX) {
      var r = minimap.getBoundingClientRect();
      var t = clamp((clientX - r.left) / r.width, 0, 1);
      var maxY = ghost.offsetHeight - window.innerHeight;
      window.scrollTo(0, t * maxY);
    }
    minimap.addEventListener("pointerdown", function (e) {
      scrubbing = true;
      minimap.classList.add("dragging");
      try { minimap.setPointerCapture(e.pointerId); } catch (err) {}
      seek(e.clientX);
      e.preventDefault();
    });
    minimap.addEventListener("pointermove", function (e) {
      if (scrubbing) seek(e.clientX);
    });
    ["pointerup", "pointercancel"].forEach(function (ev) {
      minimap.addEventListener(ev, function () {
        scrubbing = false;
        minimap.classList.remove("dragging");
      });
    });
  }

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  (function enableTouchSwipe() {
    var startX = 0, startY = 0, startScroll = 0;
    var tracking = false, moved = false;
    var THRESHOLD = 12, FACTOR = 2.2;
    stage.addEventListener("touchstart", function (e) {
      var t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
      startScroll = window.scrollY;
      tracking = true; moved = false;
    }, { passive: true });
    stage.addEventListener("touchmove", function (e) {
      if (!tracking) return;
      var t = e.touches[0];
      var dx = t.clientX - startX, dy = t.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < THRESHOLD) return;
      moved = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        e.preventDefault();
        window.scrollTo(0, startScroll - dx * FACTOR);
      }
    }, { passive: false });
    ["touchend", "touchcancel"].forEach(function (ev) {
      stage.addEventListener(ev, function () { tracking = false; });
    });
  })();

  var fit = 1;
  var S = 1, Sx = 0, St = 1, Sxt = 0;

  function layout() {
    var vw = window.innerWidth, vh = window.innerHeight;
    fit = clamp(Math.min(vw / DESIGN_W, vh / DESIGN_H), 0.2, 1);
    stage.style.width = totalW + "px";
    stage.style.height = PANEL_H + "px";
    panels.forEach(function (el, i) {
      el.style.left = (i * (PANEL_W + GAP)) + "px";
    });
    var travel = Math.max(0, totalW * fit - vw);
    ghost.style.height = (travel + vh) + "px";
    computeTargets();
    S = St; Sx = Sxt;
    apply();
  }

  function computeTargets() {
    var vw = window.innerWidth;
    var maxY = ghost.offsetHeight - window.innerHeight;
    var progress = maxY > 0 ? clamp(window.scrollY / maxY, 0, 1) : 0;
    St = clamp(fit - window.scrollY * 0.00013, 0.6, fit);
    Sxt = (1 - 2 * progress) * (totalW / 2 - PANEL_W / 2) * St;
    // minimap
    if (ticks.length > 1) {
      var idx = Math.round(progress * (ticks.length - 1));
      ticks.forEach(function (t, i) {
        t.classList.toggle("active", i === idx);
        t.classList.toggle("dim", i < idx);
      });
      minimap.style.setProperty("--p", progress.toFixed(4));
    }
    // 面板入场 + 主题词视差
    var cx = vw / 2;
    panels.forEach(function (el) {
      var left = parseFloat(el.style.left) || 0;
      var pcx = vw / 2 + Sx + (left + PANEL_W / 2 - totalW / 2) * S;
      el.classList.toggle("in", Math.abs(pcx - cx) < vw * 0.62);
      if (el._tlink === undefined) el._tlink = el.querySelector(".theme-link");
      if (el._tlink) {
        el._tlink.style.transform =
          "translateX(" + (((cx - pcx) * 0.35) / S).toFixed(1) + "px)";
      }
    });
  }

  function apply() {
    var vw = window.innerWidth;
    document.body.style.setProperty('--wsw', (1 / S).toFixed(3) + 'px');
    stage.style.transform =
      "translate(-50%,-50%) translate3d(" + Sx + "px,0,0) scale(" + S + ")";
    var inv = 1 / S;
    labels.forEach(function (el) {
      el.style.transform = "scale(" + inv + ")";
    });
  }

  var rafOn = false;
  function loop() {
    S += (St - S) * 0.14;
    Sx += (Sxt - Sx) * 0.14;
    if (Math.abs(St - S) < 0.0005) S = St;
    if (Math.abs(Sxt - Sx) < 0.05) Sx = Sxt;
    computeTargets();
    apply();
    if (S !== St || Sx !== Sxt) {
      requestAnimationFrame(loop);
    } else {
      rafOn = false;
    }
  }
  function kick() {
    if (!rafOn) { rafOn = true; requestAnimationFrame(loop); }
  }
  function onScroll() {
    computeTargets();
    kick();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", layout);
  layout();
  setTimeout(function () { computeTargets(); kick(); }, 60);
})();
