/* Sift reader overlay content script.
   Ported from the Sift.html mockup into a real content script.
   Borrows structural patterns from the Obsidian Clipper reference
   (generation guard against double injection, runtime message router,
   overlay root isolated from host styles via #sift-root).
   Frontend only: scratchpad persists to storage.local, Ask stays simulated. */
(() => {
  // Generation guard: a re-injected copy yields to the newest instance.
  window.__siftGeneration = (window.__siftGeneration || 0) + 1;
  const myGeneration = window.__siftGeneration;
  const alive = () => window.__siftGeneration === myGeneration;
  if (myGeneration > 1 && document.getElementById("sift-root")) return;

  const ext = typeof browser !== "undefined" ? browser : chrome;
  const storage = ext && ext.storage && ext.storage.local ? ext.storage.local : null;
  const SCRATCH_KEY = "sift.scratch";
  const SETTINGS_KEY = "sift.settings";
  const WORD_STEPS = { slow: 22, normal: 14, fast: 8 };

  const SAMPLE = [
    [
      ["The 6:42 bus is never late, but it is never quick either.", "The bus keeps to its schedule, yet the trip always takes a long time.", "Punctual, but slow."],
      ["I used to spend the ride with my head down, reading one article start to finish and arriving with nothing to show for it.", "He read a whole article with his head down, then stepped off the bus remembering almost none of it.", "Heads-down reading left nothing behind."],
      ["The problem was never the article.", "He is saying the writing was not what made reading hard.", "Not the article's fault."],
      ["The problem was the screen, which handed me forty lines of text at once and punished me for looking up.", "The screen showed far too much text at once, and every glance away felt like a mistake.", "The screen was the real problem."]
    ],
    [
      ["Every glance out the window cost me my place.", "Each time he looked outside, he lost track of where he had been reading.", "Looking away loses your place."],
      ["A stop announcement, a sudden brake, or a stranger's elbow, and the paragraph I had been halfway through turned back into a grey wall.", "Small interruptions on a bus were enough to turn a half-read paragraph back into an unreadable block.", "Interruptions erase your place."],
      ["I would scan for a familiar word, pick the wrong one, and start the whole block over.", "Having lost his spot, he hunted for a word he recognised, often picked the wrong one, and began the paragraph again.", "Finding your place again wastes time."]
    ],
    [
      ["Reading in short steps changed that.", "Reading a small piece at a time fixed the problem.", "Small steps worked."],
      ["One sentence at a time, large enough to read at arm's length, with everything I had already read resting quietly above it.", "Each sentence appears big enough to read at arm's length, and the earlier text stays visible above it.", "One big sentence, history above."],
      ["When I looked away, nothing moved.", "Looking away no longer changed what was on the screen.", "Nothing moves while you look away."],
      ["When I looked back, the sentence was still waiting.", "When his eyes returned, the same sentence was there to continue from.", "Your place is waiting."]
    ]
  ];

  let S = [], title = "", idx = 0, hl = new Set(), scratch = [], uid = 0;
  let advances = 0, lastTap = null, askIdx = 0, askMode = "ex", answerText = "", typer = null;
  let g = null, toastTimer = null, wordSeek = null, open = false, live = false;
  let WORD_STEP = WORD_STEPS.normal;
  const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (id) => document.getElementById(id);
  const root = buildOverlay();
  const stream = $("sift-stream"), priorEl = $("sift-prior"), activeEl = $("sift-active");
  const activeText = $("sift-active-text"), hintMsg = $("sift-hint-msg"), countEl = $("sift-count");
  const bar = $("sift-bar"), phone = $("sift-phone"), seekEl = $("sift-seek");
  const drawer = $("sift-drawer"), dlist = $("sift-dlist"), scrim = $("sift-scrim");
  const toastEl = $("sift-toast"), fab = $("sift-fab");

  function buildOverlay() {
    const host = document.createElement("div");
    host.id = "sift-root";
    host.hidden = true;
    host.innerHTML =
      '<div class="sift-phone" id="sift-phone">' +
      '<header class="sift-top"><div class="sift-brandgroup"><span class="sift-brand">SIFT</span>' +
      '<button class="sift-ib" id="sift-info" aria-label="How gestures work">' +
      '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.944" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 13.333v-3.333" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 6.667h0.008" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</button>" +
      '<button class="sift-ib" id="sift-close" aria-label="Close Sift">×</button></div>' +
      '<div class="sift-doc" aria-label="Current article"><span class="sift-t" id="sift-title"></span></div></header>' +
      '<div class="sift-seek" id="sift-seek" role="slider" tabindex="0" aria-label="Seek through article" aria-valuemin="1" aria-valuemax="1" aria-valuenow="1">' +
      '<div class="sift-progress"><i id="sift-bar"></i></div></div>' +
      '<main class="sift-stream" id="sift-stream" aria-label="Reading stream">' +
      '<div class="sift-priorwrap"><div class="sift-prior" id="sift-prior" aria-label="Already read"></div></div>' +
      '<div class="sift-fixed"><div class="sift-active" id="sift-active"><p id="sift-active-text"></p></div>' +
      '<p class="sift-hint" id="sift-hint" aria-live="polite"><span id="sift-hint-msg"></span><span class="sift-count" id="sift-count"></span></p>' +
      "</div></main>" +
      '<section class="sift-drawer" id="sift-drawer" aria-label="Scratchpad">' +
      '<div class="sift-dhead"><button class="sift-ib" id="sift-copy" aria-label="Copy all excerpts">' +
      '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect width="11.667" height="11.667" x="6.667" y="6.667" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.333 13.333c-0.917 0-1.667-0.75-1.666-1.666V3.333c0-0.917 0.75-1.667 1.666-1.667h8.334c0.917 0 1.667 0.75 1.666 1.667" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</button></div>" +
      '<div class="sift-dlist" id="sift-dlist"></div></section>' +
      '<div class="sift-scrim" id="sift-scrim" hidden>' +
      '<section class="sift-sheet" id="sift-sh-ask" hidden aria-label="Ask">' +
      "<h2>Ask · local model (simulated)</h2>" +
      '<p class="sift-quote" id="sift-ask-quote"></p>' +
      '<div class="sift-modes"><button class="sift-pill" data-mode="ex" aria-pressed="true">Explain simply</button>' +
      '<button class="sift-pill" data-mode="sh" aria-pressed="false">Shorter</button></div>' +
      '<p class="sift-answer" id="sift-answer" aria-live="polite"></p>' +
      '<div class="sift-row"><button class="sift-pill sift-primary" id="sift-save-ans">Save to scratchpad</button>' +
      '<button class="sift-pill" data-close>Back to reading</button></div>' +
      '<p class="sift-note">Prototype only. Replies are written in advance for the sample article. A real build would call a model running on the phone.</p></section>' +
      '<section class="sift-sheet" id="sift-sh-guide" hidden aria-label="Info">' +
      '<button class="sift-sheet-close" data-close aria-label="Close info">×</button>' +
      "<h2>Info</h2>" +
      '<dl class="sift-guide">' +
      "<div><dt>Slide</dt><dd>Drag left or right to move through the article one word at a time.</dd></div>" +
      "<div><dt>Scroll up</dt><dd>Scroll the text you have already read.</dd></div>" +
      "<div><dt>Double-tap</dt><dd>Highlight the sentence and save it to the scratchpad.</dd></div>" +
      "</dl></section></div>" +
      '<div class="sift-toast" id="sift-toast" role="status"></div></div>';
    document.documentElement.appendChild(host);
    const launcher = document.createElement("button");
    launcher.id = "sift-fab";
    launcher.textContent = "SIFT";
    launcher.setAttribute("aria-label", "Open Sift reading view");
    document.documentElement.appendChild(launcher);
    return host;
  }

  function splitSentences(text) {
    return (text.match(/[^.!?]+(?:[.!?]+["”’)]*|$)\s*/g) || [text])
      .map((x) => x.trim()).filter(Boolean);
  }

  // Live article parse. Our own overlay nodes are excluded via #sift-root.
  function parseLive() {
    const scope = document.querySelector("article") || document.querySelector("main") || document.body;
    const h1 = document.querySelector("article h1, main h1, h1");
    const pageTitle = (h1 && !h1.closest("#sift-root") ? h1.textContent : document.title || "").trim();
    const paras = Array.from(scope.querySelectorAll("p"))
      .filter((p) => !p.closest("#sift-root"))
      .map((p) => (p.textContent || "").replace(/\s+/g, " ").trim())
      .filter((t) => t.length > 0);
    if (paras.length === 0) return null;
    const out = [];
    paras.forEach((ptxt, p) => {
      splitSentences(ptxt).forEach((t) => out.push({ t, p, ex: null, sh: null }));
    });
    if (out.length < 3) return null;
    return { sentences: out, title: pageTitle || "Article" };
  }

  function loadSample() {
    S = [];
    SAMPLE.forEach((para, p) => para.forEach((s) => S.push({ t: s[0], p, ex: s[1], sh: s[2] })));
    title = "The Long Way Home";
    idx = 3; advances = 0; lastTap = null; live = false;
    hl = new Set([1, 2]);
    scratch = [
      { id: ++uid, type: "q", idx: 2, text: S[2].t, src: title },
      { id: ++uid, type: "q", idx: 1, text: S[1].t, src: title }
    ];
  }

  function loadDocument() {
    const parsed = parseLive();
    if (!parsed) { loadSample(); return; }
    S = parsed.sentences; title = parsed.title;
    idx = 0; advances = 0; lastTap = null; live = true;
    hl = new Set();
    scratch = [];
  }

  function vibrate(n) { try { if (navigator.vibrate) navigator.vibrate(n); } catch (e) {} }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("sift-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("sift-on"), 1800);
  }

  function persist() {
    if (!storage) return;
    try {
      const p = storage.set({ [SCRATCH_KEY]: scratch });
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  function restore(done) {
    if (!storage) { done(); return; }
    try {
      const p = storage.get([SCRATCH_KEY, SETTINGS_KEY]);
      Promise.resolve(p).then((res) => {
        if (res && Array.isArray(res[SCRATCH_KEY])) {
          scratch = res[SCRATCH_KEY].filter((c) => c && typeof c.text === "string");
          uid = scratch.reduce((m, c) => Math.max(m, c.id || 0), 0);
        }
        const speed = res && res[SETTINGS_KEY] && res[SETTINGS_KEY].speed;
        if (speed && WORD_STEPS[speed]) WORD_STEP = WORD_STEPS[speed];
        done();
      }).catch(done);
    } catch (e) { done(); }
  }

  function render() {
    priorEl.replaceChildren();
    let para = null, lastP = -1;
    for (let i = 0; i < idx; i++) {
      if (S[i].p !== lastP) { para = document.createElement("p"); priorEl.appendChild(para); lastP = S[i].p; }
      const sp = document.createElement("span");
      sp.className = "sift-s" + (hl.has(i) ? " hl" : "");
      sp.textContent = S[i].t + " ";
      para.appendChild(sp);
    }
    renderActive();
    activeEl.scrollTop = 0;
    bar.style.width = (S.length > 1 ? (idx / (S.length - 1)) * 100 : 100) + "%";
    seekEl.setAttribute("aria-valuemax", String(S.length));
    seekEl.setAttribute("aria-valuenow", String(idx + 1));
    $("sift-title").textContent = title;
    hintMsg.textContent = idx === S.length - 1 ? "End of article · " + scratch.length + " saved" : "";
    renderDrawer();
  }

  function renderActive() {
    const cur = S[idx];
    activeText.replaceChildren();
    let inner = activeText;
    if (hl.has(idx)) {
      inner = document.createElement("span");
      inner.className = "sift-mark";
      activeText.appendChild(inner);
    }
    const words = cur.t.match(/\S+\s*/g) || [cur.t];
    const visible = wordSeek && wordSeek.idx === idx ? wordSeek.word + 1 : words.length;
    words.slice(0, visible).forEach((text, i) => {
      const w = document.createElement("span");
      w.className = wordSeek && wordSeek.idx === idx && wordSeek.word === i ? "sift-seek-word" : "";
      w.textContent = text;
      inner.appendChild(w);
    });
    if (visible < words.length) inner.appendChild(document.createTextNode("…"));
    activeText.className = cur.t.length > 170 ? "sift-xl" : cur.t.length > 110 ? "sift-l" : cur.t.length > 60 ? "sift-m" : "";
    activeEl.scrollTop = 0;
  }

  function renderDrawer() {
    dlist.replaceChildren();
    if (!scratch.length) {
      const e = document.createElement("p");
      e.className = "sift-empty";
      e.textContent = "Nothing here yet. Double-tap a sentence and it lands here.";
      dlist.appendChild(e);
      return;
    }
    scratch.forEach((c) => {
      const d = document.createElement("div");
      d.className = "sift-chip";
      const b = document.createElement("div");
      b.className = "sift-body";
      if (c.type === "ai") {
        const tag = document.createElement("span");
        tag.className = "sift-tag";
        tag.textContent = "AI NOTE";
        b.appendChild(tag);
      }
      const p = document.createElement("p");
      p.textContent = c.text;
      b.appendChild(p);
      const x = document.createElement("button");
      x.className = "sift-rm";
      x.setAttribute("aria-label", "Remove from scratchpad");
      x.textContent = "×";
      x.addEventListener("click", () => {
        scratch = scratch.filter((y) => y.id !== c.id);
        if (c.type === "q" && typeof c.idx === "number") hl.delete(c.idx);
        persist();
        render();
      });
      d.appendChild(b);
      d.appendChild(x);
      dlist.appendChild(d);
    });
  }

  function scrollEnd(instant) {
    requestAnimationFrame(() => {
      priorEl.scrollTo({ top: priorEl.scrollHeight, behavior: instant || rm ? "auto" : "smooth" });
    });
  }

  function setIdx(n, instant) {
    n = Math.max(0, Math.min(S.length - 1, n));
    if (n === idx) return false;
    idx = n;
    render();
    scrollEnd(instant);
    return true;
  }

  const wordsFor = (i) => S[i].t.match(/\S+\s*/g) || [S[i].t];

  function moveWord(startIdx, startWord, steps) {
    let ni = startIdx, nw = startWord;
    while (steps > 0 && ni < S.length - 1) {
      if (nw < wordsFor(ni).length - 1) nw++;
      else { ni++; nw = 0; }
      steps--;
    }
    while (steps < 0 && ni > 0) {
      if (nw > 0) nw--;
      else { ni--; nw = wordsFor(ni).length - 1; }
      steps++;
    }
    return { idx: ni, word: nw };
  }

  function go(d) {
    wordSeek = null;
    if (!setIdx(idx + d)) { if (d > 0) toast("End of article"); return; }
    if (d > 0) advances++;
    if (!rm && activeEl.animate) activeEl.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 140, easing: "ease-out" });
    vibrate(8);
  }

  function flashDrawer() {
    drawer.classList.add("sift-flash");
    setTimeout(() => drawer.classList.remove("sift-flash"), 700);
  }

  function drop(i) {
    wordSeek = null;
    hl.add(i);
    if (!scratch.some((c) => c.type === "q" && c.idx === i && c.src === title)) {
      scratch.unshift({ id: ++uid, type: "q", idx: i, text: S[i].t, src: title });
    }
    persist();
    flashDrawer();
    render();
    vibrate([10, 30, 10]);
  }

  function onDoubleTap() {
    const now = performance.now();
    if (lastTap && now - lastTap.t < 320) {
      lastTap = null;
      drop(idx);
      return;
    }
    lastTap = { t: now, idx };
  }

  function showSheet(name) {
    scrim.hidden = false;
    ["ask", "guide"].forEach((n) => { $("sift-sh-" + n).hidden = n !== name; });
  }
  function hideSheets() { scrim.hidden = true; clearInterval(typer); }

  function say(text) {
    clearInterval(typer);
    const out = $("sift-answer"), save = $("sift-save-ans");
    answerText = text;
    out.textContent = "";
    save.disabled = true;
    if (rm) { out.textContent = text; save.disabled = false; return; }
    const words = text.split(" ");
    let n = 0;
    typer = setInterval(() => {
      n++;
      out.textContent = words.slice(0, n).join(" ");
      if (n >= words.length) { clearInterval(typer); save.disabled = false; }
    }, 35);
  }
  function runAsk() {
    const s = S[askIdx];
    say((s && (askMode === "ex" ? s.ex : s.sh)) ||
      "Simulated reply. With a model running on your phone, an answer about this sentence would appear here.");
  }

  function setOpen(next) {
    if (next && !S.length) { loadDocument(); render(); scrollEnd(true); }
    open = next;
    root.hidden = !open;
    fab.hidden = open;
    if (open) {
      restore(() => { if (alive()) { applySettingsToReader(); render(); scrollEnd(true); } });
    }
  }

  function applySettingsToReader() {
    if (!storage) return;
    try {
      const p = storage.get([SETTINGS_KEY]);
      Promise.resolve(p).then((res) => {
        const speed = res && res[SETTINGS_KEY] && res[SETTINGS_KEY].speed;
        if (speed && WORD_STEPS[speed]) WORD_STEP = WORD_STEPS[speed];
      }).catch(() => {});
    } catch (e) {}
  }

  // Gestures on the reading area: double-tap saves, slide seeks by word.
  stream.addEventListener("contextmenu", (e) => e.preventDefault());
  stream.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || !scrim.hidden) return;
    try { stream.setPointerCapture(e.pointerId); } catch (err) {}
    g = {
      x: e.clientX, y: e.clientY, start: idx,
      startWord: wordSeek && wordSeek.idx === idx ? wordSeek.word : 0,
      target: { idx, word: 0 }, moved: false, scrub: null
    };
    g.target.word = g.startWord;
  });
  stream.addEventListener("pointermove", (e) => {
    if (!g) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) > 10) {
      g.moved = true;
      g.scrub = Math.abs(dx) > Math.abs(dy) * 1.2;
      if (g.scrub) root.classList.add("sift-scrubbing");
    }
    if (g.scrub) {
      const target = moveWord(g.start, g.startWord, Math.round(-dx / WORD_STEP));
      g.target = target;
      if (target.idx !== idx) { wordSeek = target; idx = target.idx; render(); scrollEnd(true); }
      else { wordSeek = target; renderActive(); }
    }
  });
  function endScrub() { root.classList.remove("sift-scrubbing"); }
  stream.addEventListener("pointerup", () => {
    if (!g) return;
    const s = g;
    g = null;
    if (s.scrub) { wordSeek = s.target; renderActive(); endScrub(); return; }
    if (s.moved) return;
    onDoubleTap();
  });
  stream.addEventListener("pointercancel", () => {
    if (g) {
      idx = g.start;
      wordSeek = { idx: g.start, word: g.startWord };
      render();
      scrollEnd(true);
      endScrub();
      g = null;
    }
  });

  function seekFromX(e) {
    const r = seekEl.querySelector(".sift-progress").getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    setIdx(Math.round(f * (S.length - 1)), true);
  }
  let seeking = false;
  seekEl.addEventListener("pointerdown", (e) => {
    seeking = true;
    root.classList.add("sift-scrubbing");
    try { seekEl.setPointerCapture(e.pointerId); } catch (err) {}
    seekFromX(e);
  });
  seekEl.addEventListener("pointermove", (e) => { if (seeking) seekFromX(e); });
  function endSeek() { seeking = false; root.classList.remove("sift-scrubbing"); }
  seekEl.addEventListener("pointerup", endSeek);
  seekEl.addEventListener("pointercancel", endSeek);

  $("sift-info").addEventListener("click", () => showSheet("guide"));
  $("sift-close").addEventListener("click", () => setOpen(false));
  fab.addEventListener("click", () => setOpen(true));
  $("sift-copy").addEventListener("click", () => {
    if (!scratch.length) { toast("Nothing to copy yet"); return; }
    const text = scratch.slice().reverse()
      .map((c) => (c.type === "ai" ? "AI note: " + c.text : "“" + c.text + "”")).join("\n\n");
    try {
      navigator.clipboard.writeText(text).then(
        () => toast("Copied " + scratch.length + (scratch.length === 1 ? " item" : " items")),
        () => toast("Copy blocked here. Select the text instead."));
    } catch (err) { toast("Copy blocked here. Select the text instead."); }
  });

  scrim.addEventListener("click", (e) => { if (e.target === scrim) hideSheets(); });
  scrim.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", hideSheets));
  scrim.querySelectorAll("[data-mode]").forEach((b) => {
    b.addEventListener("click", () => {
      askMode = b.dataset.mode;
      scrim.querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      runAsk();
    });
  });
  $("sift-save-ans").addEventListener("click", () => {
    scratch.unshift({ id: ++uid, type: "ai", idx: askIdx, text: answerText, src: title });
    persist();
    hideSheets();
    render();
    flashDrawer();
  });

  document.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") {
      if (!scrim.hidden) hideSheets();
      else setOpen(false);
      return;
    }
    if (!scrim.hidden) return;
    const t = e.target;
    if (t && t.closest && t.closest("textarea,input,button")) return;
    const k = e.key;
    if (k === "ArrowRight" || k === " " || k === "Enter") { e.preventDefault(); go(1); }
    else if (k === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (k === "d" || k === "D") drop(idx);
  });

  // Message router (clipper-style): popup and commands talk through here.
  try {
    ext.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (!alive()) return;
      if (!request || typeof request.action !== "string") return;
      if (request.action === "sift-ping") {
        Promise.resolve().then(() => sendResponse({ open, sentences: S.length, live }));
        return true;
      }
      if (request.action === "sift-toggle") {
        setOpen(!open);
        Promise.resolve().then(() => sendResponse({ open }));
        return true;
      }
      if (request.action === "sift-open") {
        setOpen(true);
        Promise.resolve().then(() => sendResponse({ open }));
        return true;
      }
    });
  } catch (e) {}

  loadDocument();
  render();
  console.log("[Sift] reader ready:", S.length, "sentences,", live ? "live article" : "sample fallback");
})();
