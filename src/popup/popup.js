/* Sift popup logic. Opens on the scratchpad view: the list shares
   storage.local with the reader overlay, copy works, and the book button
   toggles the reading view in the active tab. The gear button opens the
   settings slide-over on demand. */
(function () {
  const ext = typeof browser !== "undefined" ? browser : chrome;
  const storage = ext && ext.storage && ext.storage.local ? ext.storage.local : null;
  const SCRATCH_KEY = "sift.scratch";
  const SETTINGS_KEY = "sift.settings";
  const GEMINI_KEY = "geminiApiKey";
  const AI_TAG = { 1: "AI · GIST", 2: "AI · DETAIL", 3: "AI · BREAKDOWN" };
  const AI_NAME = { 1: "Gist", 2: "Detail", 3: "Breakdown" };

  const $ = (id) => document.getElementById(id);
  const dlist = $("dlist"), toastEl = $("toast"), panel = $("panel");
  let toastTimer = null;
  let scratch = [];
  let settings = { size: "m", speed: "normal" };
  let activeTabUrl = "", activeTabTitle = "";

  function isCurrentTabItem(c) {
    if (!c) return false;
    if (c.url && activeTabUrl) {
      const cleanA = c.url.split("#")[0].replace(/\/$/, "");
      const cleanB = activeTabUrl.split("#")[0].replace(/\/$/, "");
      if (cleanA === cleanB) return true;
    }
    if (c.src && activeTabTitle && c.src === activeTabTitle) return true;
    return false;
  }

  function currentItems() {
    if (!activeTabUrl && !activeTabTitle) return scratch;
    return scratch.filter(isCurrentTabItem);
  }

  function storeGet(keys) {
    if (!storage) return Promise.resolve({});
    try {
      return Promise.resolve(storage.get(keys)).catch(() => ({}));
    } catch (e) {
      return Promise.resolve({});
    }
  }
  function storeSet(obj) {
    if (!storage) return;
    try {
      const p = storage.set(obj);
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("on"), 1800);
  }

  function render() {
    dlist.replaceChildren();
    const items = currentItems();
    if (!items.length) {
      const e = document.createElement("p");
      e.className = "empty";
      e.textContent = "No highlights on this page";
      dlist.appendChild(e);
      return;
    }
    items.forEach((c) => {
      const d = document.createElement("div");
      d.className = "chip";
      const b = document.createElement("div");
      b.className = "body";
      if (c.type === "ai") {
        const tag = document.createElement("span");
        tag.className = "tag";
        if (c.status === "loading") tag.textContent = "AI · THINKING...";
        else if (c.status === "setup") tag.textContent = "AI · SETUP";
        else if (c.status === "error") tag.textContent = "AI · ERROR";
        else tag.textContent = AI_TAG[c.level] || "AI NOTE";
        b.appendChild(tag);
      }
      const p = document.createElement("p");
      p.textContent = c.text;
      b.appendChild(p);
      if (c.src) {
        const src = document.createElement("span");
        src.className = "src";
        src.textContent = c.src;
        b.appendChild(src);
      }
      const x = document.createElement("button");
      x.className = "rm";
      x.setAttribute("aria-label", "Remove from scratchpad");
      x.textContent = "×";
      x.addEventListener("click", () => {
        scratch = scratch.filter((y) => y.id !== c.id);
        storeSet({ [SCRATCH_KEY]: scratch });
        render();
      });
      d.appendChild(b);
      d.appendChild(x);
      dlist.appendChild(d);
    });
  }

  function applySettingsUI() {
  $("saveKeyBtn").addEventListener("click", () => {
    const v = ($("geminiKeyInput").value || "").trim();
    storeSet({ [GEMINI_KEY]: v });
    toast(v ? "Gemini key saved" : "Gemini key cleared");
  });

  document.querySelectorAll(".seg").forEach((seg) => {
      const key = seg.dataset.key;
      seg.querySelectorAll("button").forEach((b) => {
        b.setAttribute("aria-pressed", String(settings[key] === b.dataset.v));
      });
    });
    $("sample").className = "sample " + (settings.size || "m");
  }

  function formatCopyItem(c) {
    if (c.type === "ai" && c.level && c.quote) {
      return "> " + c.quote + "\n\n*AI Note (Level " + c.level + ": " + (AI_NAME[c.level] || "") + "): " + c.text + "*";
    }
    return "- " + c.text;
  }

  $("copyBtn").addEventListener("click", () => {
    const items = currentItems();
    if (!items.length) { toast("Nothing to copy on this page"); return; }
    const title = activeTabTitle || (items[0] && items[0].src) || "Sift";
    const url = activeTabUrl || (items[0] && items[0].url) || "";
    const lines = [title];
    if (url) lines.push(url);
    lines.push("");
    items.slice().reverse().forEach((c) => {
      lines.push(formatCopyItem(c));
    });
    const text = lines.join("\n");
    const n = items.length;
    try {
      navigator.clipboard.writeText(text).then(
        () => toast("Copied " + n + (n === 1 ? " excerpt" : " excerpts")),
        () => toast("Copy blocked here. Select the text instead."));
    } catch (err) { toast("Copy blocked here. Select the text instead."); }
  });

  $("readBtn").addEventListener("click", () => {
    const tabs = ext && ext.tabs;
    if (!tabs || !tabs.query) { toast("Open an article tab first"); return; }
    try {
      Promise.resolve(tabs.query({ active: true, currentWindow: true })).then((found) => {
        const tab = found && found[0];
        if (!tab || tab.id === undefined) { toast("Open an article tab first"); return; }
        Promise.resolve(tabs.sendMessage(tab.id, { action: "sift-toggle" })).then(
          (res) => {
            $("readBtn").setAttribute("aria-pressed", String(!!(res && res.open)));
            if (window.close) window.close();
          },
          () => toast("Open an article page first"));
      }).catch(() => toast("Open an article page first"));
    } catch (e) { toast("Open an article page first"); }
  });

  $("settingBtn").addEventListener("click", () => { panel.hidden = false; $("backBtn").focus(); });
  $("backBtn").addEventListener("click", () => { panel.hidden = true; $("settingBtn").focus(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) panel.hidden = true;
  });

  document.querySelectorAll(".seg").forEach((seg) => {
    seg.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        settings[seg.dataset.key] = b.dataset.v;
        storeSet({ [SETTINGS_KEY]: settings });
        applySettingsUI();
      });
    });
  });

  // Tab title in the header, scratchpad and settings from storage.
  try {
    if (ext.tabs && ext.tabs.query) {
      Promise.resolve(ext.tabs.query({ active: true, currentWindow: true })).then((found) => {
        const tab = found && found[0];
        if (tab) {
          if (tab.title) {
            activeTabTitle = tab.title;
            $("docTitle").textContent = tab.title.slice(0, 60);
          }
          if (tab.url) {
            activeTabUrl = tab.url;
          }
          render();
        }
      }).catch(() => {});
    }
  } catch (e) {}
  storeGet([SCRATCH_KEY, SETTINGS_KEY, GEMINI_KEY]).then((res) => {
    if (Array.isArray(res[SCRATCH_KEY])) scratch = res[SCRATCH_KEY].filter((c) => c && typeof c.text === "string");
    if (res[SETTINGS_KEY] && typeof res[SETTINGS_KEY] === "object") settings = Object.assign(settings, res[SETTINGS_KEY]);
    if (typeof res[GEMINI_KEY] === "string") $("geminiKeyInput").value = res[GEMINI_KEY];
    applySettingsUI();
    render();
  });
})();
