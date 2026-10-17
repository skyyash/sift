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
  const WORD_STEPS = { slow: 36, normal: 28, fast: 20 };

  let S = [], title = "", idx = 0, hl = new Set(), scratch = [], uid = 0;
  let advances = 0, lastTap = null, askIdx = 0, askMode = "ex", answerText = "", typer = null;
  let g = null, toastTimer = null, wordSeek = null, open = false, live = false;
  let WORD_STEP = WORD_STEPS.normal;
  const SIZE_CLASS = { s: "sift-xl", m: "sift-m", l: "" };
  let textSizeClass = SIZE_CLASS.m;
  const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (id) => document.getElementById(id);
  const root = buildOverlay();
  const stream = $("sift-stream"), priorEl = $("sift-prior"), activeEl = $("sift-active");
  const activeText = $("sift-active-text"), hintMsg = $("sift-hint-msg"), countEl = $("sift-count");
  const bar = $("sift-bar"), phone = $("sift-phone"), seekEl = $("sift-seek");
  const drawer = $("sift-drawer"), dlist = $("sift-dlist"), scrim = $("sift-scrim");
  const toastEl = $("sift-toast");

  function buildOverlay() {
    const host = document.createElement("div");
    host.id = "sift-root";
    host.hidden = true;
    host.innerHTML =
      '<div class="sift-phone" id="sift-phone">' +
      '<header class="sift-top"><div class="sift-brandgroup"><span class="sift-brand">SIFT</span>' +
      '<button class="sift-ib" id="sift-info" aria-label="How gestures work">' +
      '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.944" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 13.333v-3.333" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 6.667h0.008" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</button></div>" +
      '<div class="sift-doc" aria-label="Current article"><span class="sift-t" id="sift-title"></span></div>' +
      '<button class="sift-ib" id="sift-close" aria-label="Close Sift">×</button></header>' +
      '<div class="sift-seek" id="sift-seek" hidden role="slider" tabindex="0" aria-label="Seek through article" aria-valuemin="1" aria-valuemax="1" aria-valuenow="1">' +
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
      '<p class="sift-note">Prototype only. A real build would call a model running on the phone.</p></section>' +
      '<section class="sift-sheet" id="sift-sh-guide" hidden aria-label="Info">' +
      '<button class="sift-sheet-close" data-close aria-label="Close info">×</button>' +
      "<h2>Info</h2>" +
      '<dl class="sift-guide">' +
      "<div><dt>Slide</dt><dd>Drag left or right to move through the article one word at a time.</dd></div>" +
      "<div><dt>Scroll up</dt><dd>Scroll the text you have already read.</dd></div>" +
       "<div><dt>Double-tap</dt><dd>Highlight the sentence and save it to the scratchpad.</dd></div>" +
       "<div><dt>Double-tap drawer</dt><dd>Explain the active sentence with AI, deeper each time.</dd></div>" +
      "</dl></section></div>" +
      '<div class="sift-toast" id="sift-toast" role="status"></div></div>';
    document.documentElement.appendChild(host);
    return host;
  }

  let parseFailureReason = "";

  function findBestContentRoot() {
    const isExcluded = (el) => {
      if (!el || el.id === "sift-root" || el.closest("#sift-root")) return true;
      return !!el.closest("header,footer,nav,aside,form,[role=navigation],[role=banner],[role=contentinfo]");
    };

    const candidates = [
      ...Array.from(document.querySelectorAll("article")),
      ...Array.from(document.querySelectorAll("main, [role='main']")),
      ...Array.from(document.querySelectorAll(".post-content, .entry-content, .article-content, .article-body, .markdown-body, #content, .content"))
    ].filter((el) => !isExcluded(el));

    let bestEl = null, bestScore = 0;
    for (const el of candidates) {
      const pCount = el.querySelectorAll("p, li, blockquote").length;
      const textLen = (el.textContent || "").trim().length;
      const score = pCount * 120 + textLen;
      if (score > bestScore) {
        bestScore = score;
        bestEl = el;
      }
    }
    if (bestEl && bestScore > 150) return bestEl;
    return document.body;
  }

  function splitSentences(text, isBlock) {
    if (isBlock && (/^•\s/.test(text) || text.length < 80)) return [text.trim()];
    return (text.match(/[^.!?]+(?:[.!?]+["”’)]*|$)\s*/g) || [text])
      .map((x) => x.trim()).filter((x) => x.length >= 3);
  }

  // Clipper-style live article parse: candidate container scoring,
  // ordered extraction of paragraphs, lists (ul/ol/li), blockquotes,
  // and section headings, avoiding site chrome and nested duplicates.
  function parseLive() {
    const scope = findBestContentRoot();
    const h1 = document.querySelector("article h1, main h1, h1");
    const pageTitle = (h1 && !h1.closest("#sift-root") ? h1.textContent : document.title || "").trim();

    const isExcluded = (el) => {
      if (!el || el.id === "sift-root" || el.closest("#sift-root")) return true;
      return !!el.closest("header,footer,nav,aside,form,[role=navigation],[role=banner],[role=contentinfo],script,style,noscript,svg");
    };

    let rawBlocks = Array.from(scope.querySelectorAll("p, li, blockquote, h2, h3, h4"))
      .filter((el) => !isExcluded(el));

    rawBlocks = rawBlocks.filter((el) => {
      if (el.tagName === "LI" && el.querySelector("p")) return false;
      return true;
    });

    if (rawBlocks.length === 0) {
      rawBlocks = Array.from(scope.querySelectorAll("div"))
        .filter((el) => !isExcluded(el) && el.children.length === 0 && (el.textContent || "").trim().length >= 30);
    }

    if (rawBlocks.length === 0) {
      return { error: "No readable paragraphs, lists, or headings found in main article area." };
    }

    const out = [];
    rawBlocks.forEach((el, p) => {
      let t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!t || t.length < 5) return;
      const isLi = el.tagName === "LI";
      if (isLi) {
        const isOrdered = el.parentElement && el.parentElement.tagName === "OL";
        const idxInParent = el.parentElement ? Array.from(el.parentElement.children).indexOf(el) + 1 : 1;
        const prefix = isOrdered ? (idxInParent + ". ") : "• ";
        if (!/^(\d+\.|•|-|\*)\s/.test(t)) t = prefix + t;
      }
      const isHeader = /^H[2-4]$/.test(el.tagName);
      const isShortBlock = isLi || isHeader;
      splitSentences(t, isShortBlock).forEach((sent) => {
        out.push({ t: sent, p, ex: null, sh: null });
      });
    });

    if (out.length < 2) {
      return {
        error: out.length === 0
          ? "No readable text extracted from page."
          : "Only 1 sentence found. Need at least 2 sentences for reading stream."
      };
    }
    return { sentences: out, title: pageTitle || "Article" };
  }

  function loadDocument() {
    const res = parseLive();
    if (!res || res.error) {
      parseFailureReason = (res && res.error) || "Sift couldn't find article text on this page.";
      S = []; title = ""; idx = 0; advances = 0; lastTap = null; live = false;
      hl = new Set();
      scratch = [];
      return false;
    }
    parseFailureReason = "";
    S = res.sentences; title = res.title;
    idx = 0; advances = 0; lastTap = null; live = true;
    hl = new Set();
    scratch = [];
    return true;
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
          // String ids (ai_...) must not poison the numeric quote counter.
          uid = scratch.reduce((m, c) => Math.max(m, typeof c.id === "number" ? c.id : 0), 0);
          scratch.forEach((c) => {
            if (c.type === "q" && isCurrentPage(c)) {
              const s = typeof c.startIdx === "number" ? c.startIdx : c.idx;
              const e = typeof c.endIdx === "number" ? c.endIdx : c.idx;
              if (typeof s === "number") {
                for (let k = s; k <= (typeof e === "number" ? e : s); k++) hl.add(k);
              }
            }
          });
        }
        const st = res && res[SETTINGS_KEY];
        if (st) {
          if (st.speed && WORD_STEPS[st.speed]) WORD_STEP = WORD_STEPS[st.speed];
          if (st.size && SIZE_CLASS[st.size] !== undefined) textSizeClass = SIZE_CLASS[st.size];
        }
        done();
      }).catch(done);
    } catch (e) { done(); }
  }

  function render() {
    if (!S.length) { renderNotice(); return; }
    activeEl.hidden = false;
    drawer.hidden = false;
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
    // A fresh landed sentence starts at the top. During a cross-sentence
    // scrub renderActive already positioned the follow-scroll, so keep it.
    if (!(wordSeek && wordSeek.idx === idx)) activeEl.scrollTop = 0;
    bar.style.width = (S.length > 1 ? (idx / (S.length - 1)) * 100 : 100) + "%";
    seekEl.setAttribute("aria-valuemax", String(S.length));
    seekEl.setAttribute("aria-valuenow", String(idx + 1));
    $("sift-title").textContent = title;
    hintMsg.textContent = idx === S.length - 1 ? "End of article · " + scratch.length + " saved" : "";
    renderDrawer();
  }

  // No article text on this page: show a notice instead of dummy content.
  function renderNotice() {
    $("sift-title").textContent = "Sift";
    priorEl.replaceChildren();
    const n = document.createElement("div");
    n.className = "sift-nopage";
    n.innerHTML = "<strong style='display:block;margin-bottom:8px;font-size:16px;'>No Article Detected</strong>" +
      "<p style='margin:0 0 10px;font-size:14px;opacity:.8;'>" + (parseFailureReason || "Sift couldn't find article text on this page.") + "</p>" +
      "<span style='font-size:12px;opacity:.6;'>Open an article or documentation page, then tap the book button.</span>";
    priorEl.appendChild(n);
    activeText.replaceChildren();
    activeText.className = "";
    bar.style.width = "0%";
    activeEl.hidden = true;
    drawer.hidden = true;
  }

  function renderActive() {
    const cur = S[idx];
    if (!cur) return;
    // Fixed reading size: the settings class is the only size ever applied.
    // Long sentences overflow with native scroll instead of shrinking.
    // Preserve scroll across re-renders during a scrub so words never move.
    const prevScroll = activeEl.scrollTop;
    const wasScrubbing = !!(wordSeek && wordSeek.idx === idx);
    activeText.replaceChildren();
    let inner = activeText;
    if (hl.has(idx)) {
      inner = document.createElement("span");
      inner.className = "sift-mark";
      activeText.appendChild(inner);
    }
    const words = wordsFor(idx);
    const scrubbing = !!(wordSeek && wordSeek.idx === idx);
    const activeWordIdx = scrubbing ? wordSeek.word : -1;

    let activeSpan = null;
    words.forEach((text, i) => {
      const w = document.createElement("span");
      w.textContent = text;
      // Every word reserves identical highlight padding via sift-w, so
      // activating/deactivating never changes metrics or re-wraps lines.
      if (scrubbing && i === activeWordIdx) {
        w.className = "sift-w sift-seek-word";
        activeSpan = w;
      } else if (scrubbing && i > activeWordIdx) {
        w.className = "sift-w sift-word-dim";
      } else {
        w.className = "sift-w";
      }
      inner.appendChild(w);
    });

    activeText.className = textSizeClass;
    // No fitActive(): font size stays exactly as selected in settings.
    // Overflow is handled by native scroll in .sift-active, never shrinking.
    // Follow-scroll only while scrubbing and only when the active word is
    // out of view: nudge by exactly the overflow amount, never on every step.
    if (scrubbing || wasScrubbing || activeSpan) {
      activeEl.scrollTop = prevScroll;
      if (scrubbing && activeSpan) followActiveWord(activeEl, activeSpan, prevScroll);
    } else {
      activeEl.scrollTop = 0;
    }
  }
  function followActiveWord(boxEl, wordEl, prevScroll) {
    try {
      const box = boxEl.getBoundingClientRect();
      const r = wordEl.getBoundingClientRect();
      if (!box || !r || !box.height) return;
      const pad = 8;
      if (r.bottom > box.bottom - pad) {
        boxEl.scrollTop = prevScroll + (r.bottom - box.bottom) + pad;
      } else if (r.top < box.top + pad) {
        boxEl.scrollTop = prevScroll + (r.top - box.top) - pad;
      }
    } catch (e) {}
  }

  function isCurrentPage(c) {
    if (!c) return false;
    if (c.url && location.href) {
      const cleanA = c.url.split("#")[0].replace(/\/$/, "");
      const cleanB = location.href.split("#")[0].replace(/\/$/, "");
      if (cleanA === cleanB) return true;
    }
    return !!(c.src && title && c.src === title);
  }

  function renderDrawer() {
    dlist.replaceChildren();
    const pageItems = scratch.filter(isCurrentPage);
    if (!pageItems.length) {
      const e = document.createElement("p");
      e.className = "sift-empty";
      e.textContent = "Double-tap to highlight";
      dlist.appendChild(e);
      return;
    }
    pageItems.forEach((c) => {
      const d = document.createElement("div");
      d.className = "sift-chip";
      const b = document.createElement("div");
      b.className = "sift-body";
      if (c.type === "ai") {
        const tag = document.createElement("span");
        tag.className = "sift-tag";
        // Legacy chips without a tier keep the old label.
        if (c.status === "loading") {
          tag.textContent = "AI · THINKING...";
          tag.classList.add("sift-thinking");
        } else if (c.status === "error" || c.status === "setup") {
          tag.textContent = c.status === "setup" ? "AI · SETUP" : "AI · ERROR";
        } else {
          tag.textContent = AI_TAG[c.level] || "AI NOTE";
        }
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
        if (c.type === "q") {
          const s = typeof c.startIdx === "number" ? c.startIdx : c.idx;
          const e = typeof c.endIdx === "number" ? c.endIdx : c.idx;
          if (typeof s === "number") {
            for (let k = s; k <= (typeof e === "number" ? e : s); k++) hl.delete(k);
          }
        }
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

    const curUrl = location.href;
    const existing = scratch.find((c) => {
      if (c.type !== "q" || (c.url && c.url !== curUrl && c.src !== title)) return false;
      const s = typeof c.startIdx === "number" ? c.startIdx : c.idx;
      const e = typeof c.endIdx === "number" ? c.endIdx : c.idx;
      return i >= s && i <= e;
    });

    if (existing) {
      flashDrawer();
      vibrate([10, 30, 10]);
      return;
    }

    const prevChip = scratch.find((c) => {
      if (c.type !== "q" || (c.url && c.url !== curUrl && c.src !== title)) return false;
      const e = typeof c.endIdx === "number" ? c.endIdx : c.idx;
      return e === i - 1;
    });
    const nextChip = scratch.find((c) => {
      if (c.type !== "q" || (c.url && c.url !== curUrl && c.src !== title)) return false;
      const s = typeof c.startIdx === "number" ? c.startIdx : c.idx;
      return s === i + 1;
    });

    if (prevChip && nextChip && prevChip !== nextChip) {
      const newStart = typeof prevChip.startIdx === "number" ? prevChip.startIdx : prevChip.idx;
      const newEnd = typeof nextChip.endIdx === "number" ? nextChip.endIdx : nextChip.idx;
      prevChip.startIdx = newStart;
      prevChip.endIdx = newEnd;
      prevChip.idx = newStart;
      prevChip.text = S.slice(newStart, newEnd + 1).map((s) => s.t).join(" ");
      scratch = scratch.filter((c) => c !== nextChip);
    } else if (prevChip) {
      const s = typeof prevChip.startIdx === "number" ? prevChip.startIdx : prevChip.idx;
      prevChip.startIdx = s;
      prevChip.endIdx = i;
      prevChip.idx = s;
      prevChip.text = S.slice(s, i + 1).map((x) => x.t).join(" ");
    } else if (nextChip) {
      const e = typeof nextChip.endIdx === "number" ? nextChip.endIdx : nextChip.idx;
      nextChip.startIdx = i;
      nextChip.endIdx = e;
      nextChip.idx = i;
      nextChip.text = S.slice(i, e + 1).map((x) => x.t).join(" ");
    } else {
      scratch.unshift({
        id: ++uid,
        type: "q",
        idx: i,
        startIdx: i,
        endIdx: i,
        text: S[i].t,
        src: title,
        url: curUrl
      });
    }

    persist();
    flashDrawer();
    render();
    vibrate([10, 30, 10]);
  }

  // Progressive AI tiers: drawer double-taps cycle 1 → 2 → 3 → 1.
  const AI_TAG = { 1: "AI · GIST", 2: "AI · DETAIL", 3: "AI · BREAKDOWN" };
  const AI_NAME = { 1: "Gist", 2: "Detail", 3: "Breakdown" };
  const aiCache = new Map();
  const aiInflight = new Set();
  function aiKey(i, level) {
    const clean = (location.href || "").split("#")[0].replace(/\/$/, "");
    return clean + ":" + i + ":" + level;
  }

  function explainActiveSentence(i) {
    if (!S.length || !S[i]) return;
    const cur = scratch.find((c) => c.type === "ai" && c.idx === i && isCurrentPage(c));
    const level = cur ? (cur.level >= 3 ? 1 : cur.level + 1) : 1;
    const key = aiKey(i, level);
    if (aiCache.has(key)) {
      upsertAiChip(i, level, "ready", aiCache.get(key));
      return;
    }
    if (aiInflight.has(key)) return; // Debounce rapid multi-taps.
    upsertAiChip(i, level, "loading", "Analyzing sentence context...");
    requestExplanation(i, level, key);
  }

  function upsertAiChip(i, level, status, text) {
    let chip = scratch.find((c) => c.type === "ai" && c.idx === i && isCurrentPage(c));
    if (!chip) {
      chip = {
        id: "ai_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        type: "ai",
        idx: i,
        level,
        status,
        text,
        quote: S[i].t,
        src: title,
        url: location.href,
        createdAt: Date.now()
      };
      scratch.unshift(chip);
    } else {
      chip.level = level;
      chip.status = status;
      chip.text = text;
      chip.quote = S[i].t;
    }
    persist();
    flashDrawer();
    render();
    vibrate([10, 30, 10]);
    return chip.id;
  }

  const GEMINI_KEY = "geminiApiKey";
  // 2.0/1.5 Flash shut down June 2026 / 2025. 3.8 Flash is current stable;
  // 3.6 Flash is the documented fallback.
  const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash"];
  function aiPromptFor(level, articleTitle) {
    if (level === 2) {
      return "Provide a deeper explanation (3-4 sentences) of this sentence from the article ('" +
        articleTitle + "'). Explain any industry jargon, metaphors, philosophical nuances, " +
        "or unstated assumptions made by the author. Be precise and insightful.";
    }
    if (level === 3) {
      return "Break down this sentence clause-by-clause. Explain the grammatical structure, " +
        "core claim, conditions/caveats, and implications using bullet points:\n" +
        "• Core Claim: ...\n• Condition/Nuance: ...\n• Implication: ...\n" +
        "Keep it clean, compact, and analytical.";
    }
    return "In 1 to 2 clear, concise sentences, explain what the following sentence means " +
      "in the context of this article ('" + articleTitle + "'). Focus on the author's " +
      "primary argument or takeaway. No fluff, no introductory filler.";
  }

  function setAiChip(chipId, level, status, text) {
    const live = scratch.find((c) => c.id === chipId);
    if (!live || live.level !== level) return false; // Superseded by a newer tap.
    live.status = status;
    live.text = text;
    persist();
    render();
    return true;
  }

  function getApiKey() {
    if (!storage) return Promise.resolve("");
    try {
      return Promise.resolve(storage.get([GEMINI_KEY]))
        .then((res) => (res && typeof res[GEMINI_KEY] === "string" ? res[GEMINI_KEY].trim() : ""))
        .catch(() => "");
    } catch (e) {
      return Promise.resolve("");
    }
  }

  function callGemini(model, apiKey, body) {
    return fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then((data) => {
      const parts = data && data.candidates && data.candidates[0] &&
        data.candidates[0].content && data.candidates[0].content.parts;
      const text = Array.isArray(parts)
        ? parts.map((p) => (p && p.text) || "").join("").trim()
        : "";
      if (!text) throw new Error("empty");
      return text;
    });
  }

  function requestExplanation(i, level, key) {
    aiInflight.add(key);
    const chip = scratch.find((c) => c.type === "ai" && c.idx === i && isCurrentPage(c));
    const chipId = chip && chip.id;
    const finish = () => aiInflight.delete(key);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      finish();
      setAiChip(chipId, level, "error", "Offline: AI explanation requires internet access.");
      return;
    }
    getApiKey().then((apiKey) => {
      if (!alive()) { finish(); return; }
      if (!apiKey) {
        finish();
        setAiChip(chipId, level, "setup",
          "Gemini API Key missing. Tap Settings in the Sift popup to paste your free Google AI Studio key.");
        return;
      }
      const contextBefore = S.slice(Math.max(0, i - 2), i).map((s) => s.t).join(" ");
      const targetSentence = S[i].t;
      const contextAfter = S.slice(i + 1, Math.min(S.length, i + 3)).map((s) => s.t).join(" ");
      const articleTitle = title || document.title;
      const body = {
        contents: [{
          parts: [{
            text: aiPromptFor(level, articleTitle) +
              "\n\nArticle Title: " + articleTitle +
              "\nContext: " + contextBefore + " [TARGET] " + targetSentence + " [/TARGET] " + contextAfter +
              "\nTarget Sentence: " + targetSentence
          }]
        }],
        generationConfig: { maxOutputTokens: 300 }
      };
      const tryModel = (n) => callGemini(GEMINI_MODELS[n], apiKey, body).catch((err) => {
        if (n + 1 < GEMINI_MODELS.length) return tryModel(n + 1);
        throw err;
      });
      tryModel(0).then((text) => {
        finish();
        if (!alive()) return;
        aiCache.set(key, text);
        setAiChip(chipId, level, "ready", text);
      }).catch(() => {
        finish();
        if (!alive()) return;
        setAiChip(chipId, level, "error",
          "Couldn't reach Gemini. Double-tap the drawer to retry.");
      });
    });
  }

  function onDoubleTap(origin) {
    const now = performance.now();
    if (lastTap && now - lastTap.t < 350) {
      lastTap = null;
      clearSelection();
      // Stream double-tap highlights verbatim; drawer double-tap explains.
      if (origin === "drawer") explainActiveSentence(idx);
      else drop(idx);
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
    applyThemeColor(open);
    if (open) {
      restore(() => { if (alive()) { applySettingsToReader(); render(); scrollEnd(true); } });
    }
  }

  function applySettingsToReader() {
    if (!storage) return;
    try {
      const p = storage.get([SETTINGS_KEY]);
      Promise.resolve(p).then((res) => {
        const st = res && res[SETTINGS_KEY];
        if (st) {
          if (st.speed && WORD_STEPS[st.speed]) WORD_STEP = WORD_STEPS[st.speed];
          if (st.size && SIZE_CLASS[st.size] !== undefined) textSizeClass = SIZE_CLASS[st.size];
        }
      }).catch(() => {});
    } catch (e) {}
  }

  // Keep the mobile browser chrome dark while reading by syncing the
  // page theme-color with the overlay, restoring the original on close.
  let prevThemeColor = null;
  function applyThemeColor(on) {
    try {
      let meta = document.querySelector('meta[name="theme-color"]');
      if (on) {
        if (meta) {
          if (!meta.hasAttribute("data-sift")) prevThemeColor = meta.getAttribute("content");
          meta.setAttribute("content", "#100F0F");
        } else if (document.head) {
          meta = document.createElement("meta");
          meta.setAttribute("name", "theme-color");
          meta.setAttribute("content", "#100F0F");
          meta.setAttribute("data-sift", "1");
          document.head.appendChild(meta);
        }
      } else if (meta) {
        if (meta.hasAttribute("data-sift")) meta.remove();
        else if (prevThemeColor !== null) meta.setAttribute("content", prevThemeColor);
      }
    } catch (e) {}
  }

  // Reading gestures: double-tap saves the active sentence, horizontal
  // slide seeks by word. Bound to the stream and to the scratchpad drawer,
  // which is part of the reading surface. Chips stay inert: presses on
  // buttons opt out, and an in-progress text selection aborts the gesture.
  function endScrub() { root.classList.remove("sift-scrubbing"); }
  function revertReadingGesture(s) {
    endScrub();
    idx = s.start;
    wordSeek = { idx: s.start, word: s.startWord };
    render();
    scrollEnd(true);
  }
  function cancelReadingGesture() {
    if (!g) return;
    const s = g;
    g = null;
    if (!s.scrub && idx === s.start) { endScrub(); return; }
    revertReadingGesture(s);
  }
  function hasSelection() {
    const sel = window.getSelection();
    return !!(sel && !sel.isCollapsed);
  }
  function clearSelection() {
    try {
      const sel = window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    } catch (e) {}
  }
  // Complete selection lockout at the root: no native selection, handles,
  // magnifiers, or copy bubbles anywhere in the overlay, chips included.
  root.addEventListener("selectstart", (e) => e.preventDefault());
  root.addEventListener("dblclick", (e) => e.preventDefault());
  root.addEventListener("mousedown", (e) => { if (e.detail > 1) e.preventDefault(); });
  function bindReadingGestures(el, capture) {
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("pointerdown", (e) => {
      if (e.button > 0 || !scrim.hidden) return;
      if (e.isPrimary === false) return;
      if (e.target.closest && e.target.closest("button")) return;
      clearSelection();
      // No capture here: grabbing the pointer on every touch would steal
      // native scrolling from the sentence box and the prior list. Capture
      // only once a horizontal scrub definitively starts (see move below).
      g = {
        id: e.pointerId, el, capture, captured: false, x: e.clientX, y: e.clientY, start: idx,
        startWord: wordSeek && wordSeek.idx === idx ? wordSeek.word : 0,
        target: { idx, word: 0 }, moved: false, scrub: null, trail: []
      };
      g.target.word = g.startWord;
    });
  }
  window.addEventListener("pointermove", (e) => {
    if (!g || e.pointerId !== g.id) return;
    if (hasSelection()) { cancelReadingGesture(); return; }
    g.trail.push({ x: e.clientX, t: performance.now() });
    if (g.trail.length > 12) g.trail.shift();
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) > 10) {
      g.moved = true;
      g.scrub = Math.abs(dx) > Math.abs(dy) * 1.2;
      if (g.scrub) {
        root.classList.add("sift-scrubbing");
        if (g.capture && !g.captured) {
          g.captured = true;
          try { g.el.setPointerCapture(g.id); } catch (err) {}
        }
      }
    }
    if (g.scrub) {
      const target = moveWord(g.start, g.startWord, Math.round(-dx / WORD_STEP));
      g.target = target;
      if (target.idx !== idx) { wordSeek = target; idx = target.idx; render(); scrollEnd(true); }
      else { wordSeek = target; renderActive(); }
    }
  });
  // Peel-off damping: the thumb contact patch shifts as it lifts, adding a
  // few stray pixels after the hold. Settle on the position held ~90ms
  // before release instead of the release point itself.
  function settleScrubTarget(s, releaseX) {
    const now = performance.now();
    let settleX = releaseX;
    if (s.trail) {
      for (let i = s.trail.length - 1; i >= 0; i--) {
        if (now - s.trail[i].t > 90) { settleX = s.trail[i].x; break; }
      }
    }
    return moveWord(s.start, s.startWord, Math.round(-(settleX - s.x) / WORD_STEP));
  }
  window.addEventListener("pointerup", (e) => {
    if (!g || e.pointerId !== g.id) return;
    const s = g;
    g = null;
    if (hasSelection()) {
      if (s.scrub || idx !== s.start) revertReadingGesture(s);
      else endScrub();
      return;
    }
    if (s.scrub) {
      if (Math.abs(e.clientX - s.x) < 12) {
        // Sub-threshold: a tap with finger roll, never a deliberate scrub.
        idx = s.start;
        wordSeek = s.startWord === 0 ? null : { idx: s.start, word: s.startWord };
        render();
        endScrub();
      } else {
        wordSeek = settleScrubTarget(s, e.clientX);
        renderActive();
        endScrub();
      }
      return;
    }
    if (s.moved) return;
    onDoubleTap(s.el === drawer ? "drawer" : "stream");
  });
  window.addEventListener("pointercancel", cancelReadingGesture);
  bindReadingGestures(stream, true);
  bindReadingGestures(drawer, false);

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
  // Both click and pointerup: if mobile click synthesis ever fails for this
  // button, the pointer event still closes. setOpen(false) is idempotent.
  $("sift-close").addEventListener("click", () => setOpen(false));
  $("sift-close").addEventListener("pointerup", (e) => {
    if (e.button > 0) return;
    setOpen(false);
  });
  function formatCopyItem(c) {
    if (c.type === "ai" && c.level && c.quote) {
      return "> " + c.quote + "\n\n*AI Note (Level " + c.level + ": " + (AI_NAME[c.level] || "") + "): " + c.text + "*";
    }
    return "- " + c.text;
  }

  $("sift-copy").addEventListener("click", () => {
    const pageItems = scratch.filter(isCurrentPage);
    if (!pageItems.length) { toast("Nothing to copy on this page"); return; }
    const text = title + "\n" + location.href + "\n\n" +
      pageItems.slice().reverse().map(formatCopyItem).join("\n");
    try {
      navigator.clipboard.writeText(text).then(
        () => toast("Copied " + pageItems.length + (pageItems.length === 1 ? " item" : " items")),
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
    scratch.unshift({ id: ++uid, type: "ai", idx: askIdx, text: answerText, src: title, url: location.href });
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
  console.log("[Sift] reader ready:", S.length, "sentences,", live ? "live article" : "no article text");
})();
