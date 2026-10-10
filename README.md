# Sift

> A gesture-first Firefox mobile extension designed for focused, commute-friendly reading.

---

## The Problem: Why Mobile Reading Sucks Today

Reading long-form articles on mobile devices during daily transit is exhausting and frustrating:
- Standard web pages and reader modes throw massive blocks of text onto a tiny screen, making reading stressful.
- During a 30-minute commute (bus, metro, train), you frequently need to look away, watch your stop, or rest your eyes. When you glance back, you have completely lost your spot in the paragraph.
- Readers shouldn't be forced to keep their eyes locked onto a miniature screen. The UI should encourage glancing up, relaxing, and blinking.
- Highlighting and capturing thoughts on mobile requires awkward precision cursors and tiny popup menus.

---

## Analysis of Existing Tools

| Tool | Strengths | Where It Falls Short |
| :--- | :--- | :--- |
| **Obsidian Reader** (Mobile / Firefox) | Clean typography, customizable font sizing. | Still throws the entire wall of text at your face. No pacing or glance-friendly context. |
| **Seratim Reader** | Sentence-by-sentence focus (closest to the desired pacing). | If you look away and need previous context, you must navigate backwards—losing your current reading position. Lacks fast highlighting and note capture. |
---

## Core Interaction & Gesture Model

Sift replaces chaotic vertical scrolling with a rhythmic, gesture-driven flow:

1. **Sliding Stream Navigation**:
   - Sliding horizontally/left reveals subsequent text while smoothly anchoring prior sentences above.
   - You never lose where you were even after looking away.
2. **Single Tap**:
   - Advance to the next sentence at your own natural reading cadence.
3. **Double Tap**:
   - Instant highlight on the active sentence.
4. **Hold & Drop**:
   - Drop the highlighted excerpt into a scratchpad or persistent notes drawer.
5. **Hold & Ask (AI)**:
   - Query on-device / local AI for instant clarification or summarization of the selected passage without breaking reading flow.

---

## Target Architecture (v0 Firefox Extension)

- **Initial Target Platforms**: Firefox Mobile (Android)

---

## Changelog

### Phase 1: Project Genesis & Concept Definition
- [x] **Task 1.1: Project Rebranding & Identity**
  - *Outcome*: Settled on **Sift** as the project identity. Renamed all project artifacts, tldraw canvas document settings, and workspace references from `firefox-extension` to `sift`.
- [x] **Task 1.2: Craft Document Integration & Problem Synthesis**
  - *Outcome*: Linked Craft design document (`https://s.craft.me/XzpiUGYwkZq3Fu`). Synthesized core user journey (commute reading, looking away without losing spot), comparative breakdown against Obsidian and Seratim readers, and defined the gesture model.
- [x] **Task 1.3: Canvas Visual Blueprint Expansion**
  - *Outcome*: Expanded `sift.tldraw` with 4 structured visual frames (The Problem & Commute Context, Current Alternatives vs Sift, Interaction & Gesture Blueprint, and v0 Architecture) containing 15 comprehensive cards directly synthesized from the Craft document.

### Phase 2: v0 Firefox Extension Prototype
- [x] **Task 2.1: Extension Scaffold**
  - *Outcome*: MV3 `manifest.json` (activeTab, storage, scripting; http/https content scripts; gecko min 109.0), `src/content/sift.js` plus `sift.css` placeholder, `icons/icon.svg`, `test/test-page.html` fixture. Verified with JSON load and `node --check`.
- [x] **Task 2.2: Rough design of complete Firefox extension**
  - *Outcome*: Designed four Paper artboards for the reading surface, highlight and hold drawer, scratchpad, and Ask response flow in the [Sift Paper file](https://app.paper.design/file/01M4GAKBDMZVWQZ2GK8DPNXR0C/p-1-0).
- [x] **Task 2.4: Flexoki theme pass**
  - *Outcome*: Recolored the standalone Sift interface with Flexoki's warm paper, ink, UI, and cyan accent tokens while preserving the existing reading interactions.
- [x] **Task 2.5: Flexoki dark theme variant**
  - *Outcome*: Added `Sift-dark.html`, a standalone dark-theme variant using Flexoki's dark paper, ink, UI, and cyan accent tokens.
- [x] **Task 2.8: Remove visible top seekbar**
  - *Outcome*: Removed the top seekbar from the reading surface while keeping horizontal scrub seeking available in the article area.
- [x] **Task 2.9: Focused reading interaction pass**
  - *Outcome*: Reduced distraction by removing single-tap advancement, hold zones, the back-to-place pill, and the open-article dialog. Double-tap now highlights and saves to the scratchpad, the info control sits beside SIFT, and the guide no longer exposes keyboard instructions.
  - *Reason*: Keep the reading surface stable and glance-friendly, avoid accidental navigation, and reserve gestures for deliberate actions.
- [x] **Task 2.10: Word-level seek reveal**
  - *Outcome*: Changed horizontal seeking from sentence jumps to progressive word reveal, with the active sentence anchored at the top of its panel to prevent vertical movement while seeking.
  - *Reason*: Make seeking more precise without moving the reading anchor or distracting the reader with whole-sentence motion.
- [x] **Task 2.11: Quiet scratchpad feedback**
  - *Outcome*: Removed sentence-save toasts. New and duplicate saves now use a brief scratchpad opacity increase as the only feedback.
  - *Reason*: Keep saving immediate and quiet without interrupting the reading surface with a notification pill.
- [x] **Task 2.12: Brand identity & icon redesign (Concept 2: The Horizon Sifter)**
  - *Outcome*: Replaced generic 3-line filter icon with Concept 2 ("The Horizon Sifter")—stacked perspective reading cards sifting down to a glowing focus sentence horizon. Generated high-res assets, `icons/icon.svg`, multi-size PNGs (16, 32, 48, 96, 128), `SIFT.png`, `SIFT.ico`, and updated `manifest.json`.
- [x] **Task 2.13: Flexoki theme harmonization for brand assets & icon**
  - *Outcome*: Harmonized the logo and icon system with `Sift.html`'s Flexoki dark palette: stage/paper dark tones (`#100F0F`, `#1C1B1A`, `#282726`, `#403E3C`), subtle reading sheet outlines, and Flexoki cyan (`#3AA99F` / `#143F3C`) for the glowing active horizon line. Re-exported SVG, PNG sizes, and favicon.
- [x] **Task 2.14: Reader overlay frontend (clipper-informed port)**
  - *Outcome*: Ported `Sift.html` into `src/content/sift.js` plus scoped `src/content/sift.css` (`#sift-root`, FAB launcher, `sift-toggle`/`sift-ping` message router, generation guard). Live article parsing first with sample fallback; slide word-seek, double-tap save, copy, guide and simulated Ask sheets kept. Scratchpad persists to `storage.local`.
  - *Reference*: Borrowed container isolation, loader restraint, and highlighter menu placement ideas from `obsidian-clipper` (`content-loader.ts`, `content.ts`, `highlighter.scss`, `reader.scss`, `manifest.firefox.json`).
- [x] **Task 2.15: Popup frontend (clipper-informed port)**
  - *Outcome*: Ported `Sift Popup.html` into `src/popup/popup.html` plus `popup.css` and `popup.js`. Scratchpad list shares `sift.scratch` with the reader, copy works, settings persist `sift.settings` (size preview, seek speed read by the reader), book button toggles the reading view in the active tab. Wired as `action.default_popup` in `manifest.json`.
- [x] **Task 2.16: Live-parse test fixture**
  - *Outcome*: Expanded `test/test-page.html` into a 5-paragraph article matching the sample narrative so the live parsing path is exercised over HTTP.
- [x] **Task 2.17: Icon refresh from new logo**
  - *Outcome*: Regenerated `icons/icon-16/32/48/96/128.png` from `SIFT.png` (1200x1200 source). Manifest references unchanged.
- [x] **Task 2.18: Popup-only entry flow**
  - *Outcome*: Removed the on-page SIFT launcher pill. Flow is now extension button to popup, book button sends `sift-toggle`, reader overlay opens on the active page. Close stays via the header button and Escape.
- [x] **Task 2.19: Scratchpad-first popup with on-demand settings**
  - *Outcome*: Popup opens on the scratchpad view. Gear button next to SIFT opens the settings slide-over (text size, seek speed) on demand, per `Sift Popup.html`. Page title keeps a 120px floor and truncates. Reading view drops the hairline border and corner radius.
- [x] **Task 2.20: Fix hidden-attribute override**
  - *Outcome*: Added `[hidden] { display: none !important; }` resets to popup and reader CSS. The popup now opens on the scratchpad home, gear navigates to settings, Back returns home. Same bug hid the reader sheets incorrectly. Also restored the mockup's hidden seekbar (scrub seeking still works).
- [x] **Task 2.21: Popup header, actions, and highlight cards**
  - *Outcome*: Removed the empty-list text. Title block fills the header gap with a 120px floor and truncates. Copy and read buttons sit at opposite ends. Saved highlights live in a drawer card mirroring the reading view, with per-item chips unchanged.
- [x] **Task 2.22: Mobile header and theme hardening**
  - *Outcome*: Close button moved to the right edge after the truncated title, with explicit sizing. Overlay gets a background fallback, full-bleed layout under 480px, and a reversible `theme-color` sync so the mobile browser chrome stays dark while reading.
- [x] **Task 2.23: No-dummy extraction plus theme guard**
  - *Outcome*: Removed the sample fallback. Pages without article text (search results) show a notice instead of dummy content. Extraction prefers article/main, skips site chrome and short fragments. Overlay colors now carry a clipper-style `!important` guard block so host stylesheets cannot recolor the reading view.
  - *Reference*: Open/extract/theme flow studied in `obsidian-clipper` (`utils/reader.ts` shell plus `obsidian-reader-active`, Defuddle parse in `utils/clip-utils.ts`, `!important`-heavy `reader.scss`/`highlighter.scss`). Defuddle itself deferred (no build step yet).
- [x] **Task 2.24: Two-way scratchpad gestures**
  - *Outcome*: Scratchpad chips drive the reader. Tap or horizontal scribble jumps to the saved sentence, double-tap highlights it in place. Saved indexes resolve by index only when the text still matches, else by text search, else a toast. Text selection and the remove button are excluded from gestures. Guide sheet documents the new rows.
- [x] **Task 2.25: Reading gestures work over the scratchpad**
  - *Outcome*: Reverted chip tap actions from 2.24, chips are inert again. The shared gesture binder now covers the stream and the drawer, so double-tap saves and slide seeks work over the scratchpad too. Button presses opt out, text selection aborts, list scrolling is untouched.
- [x] **Task 2.26: Anchor active sentence above scratchpad**
  - *Outcome*: Active text uses `margin-top: auto`, so it sits at the bottom of its panel just above the scratchpad instead of leaving dead space. Overflowing long sentences still scroll from the top.
- [x] **Task 2.27: Fix sentence-box scrolling on touch**
  - *Outcome*: Pointer capture now engages only once a horizontal scrub starts, so vertical touches scroll the sentence box and prior list natively instead of being swallowed. Verified by measurement: forced overflow collapses the anchor margin to zero and scroll reaches the last word.
- [x] **Task 2.28: Auto-fit long sentences to the sentence box**
  - *Outcome*: `renderActive` now steps the size class down (new `sift-xs` floor) until the sentence fits the fixed box, verified with the reported gwern chunk at phone width. Native scroll remains the backstop past the floor. Narrow screens also gain wider text padding.
- [x] **Task 2.29: Larger header tap targets**
  - *Outcome*: Header icon buttons (info, close) grow from 32px to 40px. The close wiring itself verified working via a real click test (overlay hides); the small corner target was the likely on-device miss.
- [x] **Task 2.30: Bulletproof reader close button**
  - *Outcome*: Close now listens to `pointerup` in addition to `click` (idempotent), so a tap closes even if mobile click synthesis fails. Header buttons and brand group are crush-proof (`flex-shrink: 0`) so a long title cannot squeeze the × target. Verified both paths hide the overlay.
- [x] **Task 2.31: Constant-size scrub reveal**
  - *Outcome*: Scrubbing keeps the popup text-size setting with no shrinking. Only the fitting slice around the current word shows (leading words trim, current word stays). Landed sentences still shrink-to-fit from the settings size. Verified live: 24px constant across a scrub, always fitting.
- [x] **Task 2.32: Title, URL, bullets copy format**
  - *Outcome*: Both copy buttons emit `title`, `url`, blank line, then `- highlight` bullets. Saved items now store the page URL; the popup groups mixed-article lists with a header per article. Verified format in node.
- [ ] **Task 2.3: Laying out the  plan of the extension.
