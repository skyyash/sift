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
- [ ] **Task 2.1: Extension Scaffold**
  - *Outcome*: Setup WebExtensions Manifest V3, directory structure, and permissions.
- [ ] **Task 2.2: Rough design of complete firefox extension.
- [ ] **Task 2.3: Laying out the  plan of the extension.
