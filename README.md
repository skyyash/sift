# Sift

> A gesture-first Firefox mobile extension designed for focused, commute-friendly reading, sentence-level skimming, and seamless knowledge capture.

📄 **Reference Document**: [Craft Doc: Sift](https://s.craft.me/XzpiUGYwkZq3Fu)  
🎨 **Design Canvas**: [`sift.tldraw`](file:///Users/skyash/PROJECTS/firefox-extension/sift.tldraw)

---

## The Problem: Why Mobile Reading Sucks Today

Reading long-form articles on mobile devices during daily transit is exhausting and frustrating:
- **Wall of Text Syndrome**: Standard web pages and reader modes throw massive blocks of text onto a tiny screen, making skimming stressful.
- **The "Look Away" Context Loss**: During a 30-minute commute (bus, metro, train), you frequently need to look away, watch your stop, or rest your eyes. When you glance back, you have completely lost your spot in the paragraph.
- **Eye Strain & Screen Fixation**: Readers shouldn't be forced to keep their eyes locked onto a miniature screen. The UI should encourage glancing up, relaxing, and blinking without penalty.
- **Friction in Capturing Thoughts**: Highlighting and capturing thoughts on mobile requires awkward precision cursors and tiny popup menus.

> *"Everything is your responsibility. If, and only if, you take them upon you willingly."*  
> If existing tools don't solve this, we build the interface we would personally love to use every single day.

---

## Analysis of Existing Tools

| Tool | Strengths | Where It Falls Short |
| :--- | :--- | :--- |
| **Obsidian Reader** (Mobile / Firefox) | Clean typography, customizable font sizing. | Still throws the entire wall of text at your face. No pacing or glance-friendly context. |
| **Seratim Reader** | Sentence-by-sentence focus (closest to the desired pacing). | If you look away and need previous context, you must navigate backwards—losing your current reading position. Lacks fast highlighting and note capture. |
| **Sift (Our Approach)** | **Sliding Horizon + Retained Context**: Focus on the active sentence while gracefully tucking prior context into view and revealing upcoming text. Fluid gestures for notes, highlights, and AI lookup. | Tailored specifically for mobile commute reading and quick capture. |

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

- **Target Platforms**: Firefox Mobile (Android) & Firefox Desktop.
- **Core Modules**:
  1. `manifest.json`: WebExtensions Manifest V3 tailored for Firefox mobile compatibility.
  2. `content/reader-parser.js`: Extracts article body text and splits into clean semantic sentence tokens.
  3. `content/sliding-viewport.js`: The custom reading interface rendering the active focus sentence and surrounding horizon.
  4. `content/gesture-controller.js`: Touch and swipe gesture handlers (tap, double tap, hold, slide).
  5. `background/storage-manager.js`: Syncs highlights, saved reading positions, and notes using `browser.storage.local`.

---

## Changelog

### Phase 1: Project Genesis & Concept Definition
- [x] **Task 1.1: Project Rebranding & Identity**
  - *Outcome*: Settled on **Sift** as the project identity. Renamed all project artifacts, tldraw canvas document settings, and workspace references from `firefox-extension` to `sift`.
- [x] **Task 1.2: Craft Document Integration & Problem Synthesis**
  - *Outcome*: Linked Craft design document (`https://s.craft.me/XzpiUGYwkZq3Fu`). Synthesized core user journey (commute reading, looking away without losing spot), comparative breakdown against Obsidian and Seratim readers, and defined the gesture model.
- [ ] **Task 1.3: Canvas Visual Blueprint Expansion**
  - *Outcome*: Update `sift.tldraw` with structured visual frames covering Problem Definition, Existing Tools Breakdown, Gesture Map, and v0 Architecture.

### Phase 2: v0 Firefox Extension Prototype
- [ ] **Task 2.1: Extension Scaffold**
  - *Outcome*: Setup WebExtensions Manifest V3, directory structure, and permissions.
- [ ] **Task 2.2: Reader Extraction & Sentence Tokenizer**
  - *Outcome*: Cleanly extract page text and split into accessible sentence nodes.
- [ ] **Task 2.3: Sliding Skimming Viewport & Gesture Handler**
  - *Outcome*: Working mobile touch interface with tap-to-advance and horizontal slide mechanics.
