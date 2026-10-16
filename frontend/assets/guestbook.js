/* 留言板前端：与 Blog-OS 后端 /api/guestbook 通信
 * 后端地址来自 config.js 的 apiBase（留空则同源 /api）。 */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var API = (CFG.apiBase || "").replace(/\/$/, "") + "/api";

  var form = document.getElementById("gb-form");
  var nameEl = document.getElementById("gb-name");
  var textEl = document.getElementById("gb-text");
  var honeyEl = document.getElementById("gb-website");
  var submitBtn = document.getElementById("gb-submit");
  var statusEl = document.getElementById("gb-status");
  var listEl = document.getElementById("gb-list");
  var moreBtn = document.getElementById("gb-more");
  var countEl = document.getElementById("gb-count");

  if (!form) return;

  var PAGE = 50;
  var offset = 0;
  var total = 0;

  function setStatus(msg, isErr) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("err", !!isErr);
  }

  function fmtDate(ts) {
    var d = new Date(ts * 1000);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function renderMsg(m) {
    var div = document.createElement("div");
    div.className = "gb-msg";
    var head = document.createElement("div");
    head.className = "gb-head";
    var who = document.createElement("b");
    who.textContent = m.name; // textContent 天然防 XSS
    var when = document.createElement("time");
    when.textContent = fmtDate(m.ts);
    head.appendChild(who);
    head.appendChild(when);
    var body = document.createElement("p");
    body.textContent = m.text;
    div.appendChild(head);
    div.appendChild(body);
    return div;
  }

  function refreshCount() {
    countEl.textContent = "留言（" + total + "）";
  }

  function loadMore() {
    fetch(API + "/guestbook?limit=" + PAGE + "&offset=" + offset)
      .then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      })
      .then(function (data) {
        total = data.total || 0;
        refreshCount();
        var items = data.messages || [];
        if (offset === 0) listEl.innerHTML = "";
        if (!items.length && offset === 0) {
          listEl.innerHTML = '<p class="gb-empty">还没有留言，来抢沙发吧。</p>';
        }
        items.forEach(function (m) { listEl.appendChild(renderMsg(m)); });
        offset += items.length;
        moreBtn.hidden = offset >= total;
      })
      .catch(function () {
        if (offset === 0) listEl.innerHTML = '<p class="gb-empty">留言服务暂不可用。</p>';
      });
  }

  moreBtn.addEventListener("click", loadMore);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = nameEl.value.trim().slice(0, 30);
    var text = textEl.value.trim().slice(0, 500);
    if (!name) { setStatus("请填写昵称", true); nameEl.focus(); return; }
    if (!text) { setStatus("请写点什么", true); textEl.focus(); return; }
    submitBtn.disabled = true;
    setStatus("发送中…", false);
    fetch(API + "/guestbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, text: text, website: honeyEl.value })
    })
      .then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      })
      .then(function () {
        nameEl.value = "";
        textEl.value = "";
        honeyEl.value = "";
        setStatus("留言成功 ✓", false);
        offset = 0;
        loadMore();
      })
      .catch(function () {
        setStatus("发送失败，请稍后再试", true);
      })
      .finally(function () {
        submitBtn.disabled = false;
        setTimeout(function () { setStatus("", false); }, 3000);
      });
  });

  loadMore();
})();
