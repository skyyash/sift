# Implementation Prompt: 3-Tier Progressive AI Chips in Sift Scatterpad

## Objective
Implement a multi-tier progressive AI sentence comprehension system powered by Google's free-tier **Gemini 2.0 / 1.5 Flash** API in Sift.

Double-tapping the **Active Sentence** continues to highlight and save verbatim quotes. In contrast, double-tapping the **Scatterpad (Scratchpad Drawer)** will trigger an AI explanation of the current active sentence that renders as a first-class chip alongside highlights and steps progressively through three levels of comprehension depth:
1. **Level 1 (`AI · GIST`)**: High-level contextual meaning within the article.
2. **Level 2 (`AI · DETAIL`)**: Nuance, jargon, assumptions, or metaphors explained.
3. **Level 3 (`AI · BREAKDOWN`)**: Structural, clause-by-clause dissection.

---

## Specification & Requirements

### 1. Gesture Separation
Modify gesture binding in `src/content/sift.js`:
- Currently, `bindReadingGestures` routes double-taps on both `stream` and `drawer` to `onDoubleTap()` which unconditionally calls `drop(idx)`.
- **Change**: Differentiate the tap origin target:
  - If double-tap occurred on `stream` (or `.sift-active`): Call `drop(idx)` to highlight the verbatim sentence.
  - If double-tap occurred on `drawer` (the scatterpad): Call `explainActiveSentence(idx)`.

---

### 2. Progressive 3-Tier Explanation Model

When `explainActiveSentence(idx)` is invoked for sentence index `idx`:
- **State Check**: Check if an AI chip for the current article sentence `idx` already exists in `scratch`.
- **Tap Progression**:
  - **No existing chip for sentence `idx`**: Create a chip with `level: 1`, status `loading`, and dispatch Level 1 prompt.
  - **Existing chip has `level === 1`**: Transition chip to `level: 2`, status `loading`, and dispatch Level 2 prompt.
  - **Existing chip has `level === 2`**: Transition chip to `level: 3`, status `loading`, and dispatch Level 3 prompt.
  - **Existing chip has `level === 3`**: Reset/cycle back to `level: 1` or toggle off.

#### Level Definitions & System Instructions:
Construct prompts sending the **target sentence** in context of surrounding sentences:
- **Context window**: Include the active sentence, the 2 preceding sentences, and 2 following sentences:
  ```javascript
  const contextBefore = S.slice(Math.max(0, idx - 2), idx).map(s => s.t).join(" ");
  const targetSentence = S[idx].t;
  const contextAfter = S.slice(idx + 1, Math.min(S.length, idx + 3)).map(s => s.t).join(" ");
  const articleTitle = title || document.title;
  ```

* **Level 1 (`AI · GIST`)**:
  - *Prompt*: "In 1 to 2 clear, concise sentences, explain what the following sentence means in the context of this article ('{articleTitle}'). Focus on the author's primary argument or takeaway. No fluff, no introductory filler."
  - *Tag Label*: `AI · GIST`

* **Level 2 (`AI · DETAIL`)**:
  - *Prompt*: "Provide a deeper explanation (3-4 sentences) of this sentence from the article ('{articleTitle}'). Explain any industry jargon, metaphors, philosophical nuances, or unstated assumptions made by the author. Be precise and insightful."
  - *Tag Label*: `AI · DETAIL`

* **Level 3 (`AI · BREAKDOWN`)**:
  - *Prompt*: "Break down this sentence clause-by-clause. Explain the grammatical structure, core claim, conditions/caveats, and implications using bullet points:
• Core Claim: ...
• Condition/Nuance: ...
• Implication: ...
Keep it clean, compact, and analytical."
  - *Tag Label*: `AI · BREAKDOWN`

---

### 3. Chip Data Structure & Rendering

#### Data Object Schema
Store AI chips in the existing `scratch` array (persisted via `browser.storage.local` / `chrome.storage.local`):
```javascript
{
  id: "ai_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
  type: "ai",
  idx: idx,
  level: 1, // 1 | 2 | 3
  status: "ready", // "loading" | "ready" | "error"
  text: "Explanation text returned by Gemini...",
  url: location.href,
  src: title || document.title,
  createdAt: Date.now()
}
```

#### Scatterpad Chip UI (`renderDrawer` in `src/content/sift.js` & `src/content/sift.css`):
- AI chips follow the exact same visual language as highlight chips:
  - Background `var(--tint)`
  - Left border `4px solid var(--terra)`
  - Close/remove button `×`
- Header tag displays the dynamic tier:
  - `.sift-tag`: Displays `AI · GIST`, `AI · DETAIL`, or `AI · BREAKDOWN`.
- **Loading State**:
  - While fetching, render `.sift-tag` as `AI · THINKING...` with a subtle pulsing CSS animation or dots.
  - Text body displays: `"Analyzing sentence context..."`
- **Error / Missing API Key State**:
  - If no API key is configured, set tag to `AI · SETUP` and text: `"Gemini API Key missing. Tap Settings in the Sift popup to paste your free Google AI Studio key."`
  - If API error (rate-limit / network failure), set tag to `AI · ERROR` with a retry prompt.

---

### 4. Gemini API Integration

1. **Endpoint**:
   - `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
   - Fallback model: `gemini-1.5-flash`
2. **Request Payload**:
   ```json
   {
     "contents": [
       {
         "parts": [
           {
             "text": "${systemInstructions}\n\nArticle Title: ${articleTitle}\nContext: ${contextBefore} [TARGET] ${targetSentence} [/TARGET] ${contextAfter}\nTarget Sentence: ${targetSentence}"
           }
         ]
       }
     ],
     "generationConfig": {
       "temperature": 0.3,
       "maxOutputTokens": 300
     }
   }
   ```
3. **In-Memory Caching**:
   - Cache results in memory (`const aiCache = new Map()`) using the cache key `${cleanUrl}:${idx}:${level}` so re-tapping or cycling through levels never re-queries the API or wastes quota.

---

### 5. Settings UI: Gemini API Key Configuration

1. **Extension Popup (`src/popup/popup.html` & `src/popup/popup.js`)**:
   - Add a clean setting section in `#panel` (Settings):
     ```html
     <div class="set">
       <div class="lbl">
         <b>Gemini API Key</b>
         <span>For progressive scatterpad explanations (<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Get free key</a>)</span>
       </div>
       <div class="set-input-row">
         <input type="password" id="geminiKeyInput" placeholder="AIzaSy..." autocomplete="off" spellcheck="false" />
         <button class="ib sm" id="saveKeyBtn">Save</button>
       </div>
     </div>
     ```
2. **Storage Synchronization**:
   - Store under key `geminiApiKey` in `browser.storage.local`.
   - On change, sync via `browser.storage.onChanged` to active content script instances.

---

### 6. Edge Cases & Resilience
- **Rapid Double-Taps**: Debounce API requests so rapid multi-taps don't trigger multiple simultaneous network requests for the same sentence.
- **Offline / Flight Mode**: Provide an immediate clean error chip (`"Offline: AI explanation requires internet access"`) without hanging or breaking reading flow.
- **Copy Drawer Action**: When clicking the Copy button in the drawer/popup, include AI chips cleanly formatted, e.g.:
  ```markdown
  > [Original Quote]

  *AI Note (Level 1: Gist): The author argues that...*
  ```

---

## Files to Modify:
1. `src/content/sift.js`: Gesture routing, `explainActiveSentence()` handler, Gemini fetch/cache, drawer rendering updates.
2. `src/content/sift.css`: `.sift-tag` variants, pulsing loading state, subtle level transitions.
3. `src/popup/popup.html`: API key input field and helper link in settings panel.
4. `src/popup/popup.js`: API key load, save, and storage change listeners.
5. `manifest.json`: Ensure `host_permissions` allow calls to `https://generativelanguage.googleapis.com/*` (or verify `https://*/*` covers it).

---

## Verification Steps:
1. Double-tap active sentence: Verifies verbatim highlight chip appears.
2. Double-tap scatterpad drawer: Verifies Level 1 `AI · GIST` chip appears within ~400ms.
3. Double-tap scatterpad drawer again: Verifies chip updates in-place to Level 2 `AI · DETAIL`.
4. Double-tap scatterpad drawer a 3rd time: Verifies chip updates to Level 3 `AI · BREAKDOWN`.
5. Remove button (`×`) on AI chip: Verifies chip is dismissed cleanly from scratchpad.
6. Copy excerpts button: Verifies AI notes copy cleanly alongside quotes.
