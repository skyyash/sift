/* Sift popup logic. Ported from the Sift Popup.html mockup and wired to
   the live extension: scratchpad reads/writes storage.local under the
   same key as the reader overlay, settings persist for the reader to
   pick up, and the book button toggles the reading view in the tab. */
(function () {
  const ext = typeof browser !== "undefined" ? browser : chrome;
  const storage = ext && ext.storage && ext.storage.local ? ext.storage.local : null;
  const SCRATCH_KEY = "sift.scratch";
  const SETTINGS_KEY = "sift.settings";

  const $ = (id) => document.getElementById(id);
  const dlist = $("dlist"), toastEl = $("toast"), panel = $("panel");
  let toastTimer = null;
  let scratch = [];
  let settings = { size: "m", speed: "normal" };

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
    if (!scratch.length) {
      const e = document.createElement("p");
      e.className = "empty";
      e.textContent = "Nothing saved yet. Double-tap a sentence in the reading view and it lands here.";
      dlist.appendChild(e);
      return;
    }
    scratch.forEach((c) => {
      const d = document.createElement("div");
      d.className = "chip";
      const b = document.createElement("div");
      b.className = "body";
      if (c.type === "ai") {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = "AI NOTE";
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
    document.querySelectorAll(".seg").forEach((seg) => {
      const key = seg.dataset.key;
      seg.querySelectorAll("button").forEach((b) => {
        b.setAttribute("aria-pressed", String(settings[key] === b.dataset.v));
      });
    });
    $("sample").className = "sample " + (settings.size || "m");
  }

  $("copyBtn").addEventListener("click", () => {
    if (!scratch.length) { toast("Nothing to copy yet"); return; }
    const text = scratch.slice().reverse()
      .map((c) => "“" + c.text + "”" + (c.src ? " — " + c.src : "")).join("\n\n");
    const n = scratch.length;
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
        if (tab && tab.title) $("docTitle").textContent = tab.title.slice(0, 60);
      }).catch(() => {});
    }
  } catch (e) {}
  storeGet([SCRATCH_KEY, SETTINGS_KEY]).then((res) => {
    if (Array.isArray(res[SCRATCH_KEY])) scratch = res[SCRATCH_KEY].filter((c) => c && typeof c.text === "string");
    if (res[SETTINGS_KEY] && typeof res[SETTINGS_KEY] === "object") settings = Object.assign(settings, res[SETTINGS_KEY]);
    applySettingsUI();
    render();
  });
})();
