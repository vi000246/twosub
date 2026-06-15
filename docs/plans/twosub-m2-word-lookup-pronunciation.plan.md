---
linear_issue: null
---
# Plan: TwoSub M2 — Instant Word Lookup + Pronunciation

## Summary
While paused, hovering or clicking an English word in the overlay shows a popup with its contextual Chinese meaning (Gemini, word + sentence) plus a 🔊 pronunciation button (Web Speech TTS). Builds on M1's inert seams: `LOOKUP_WORD` message + `MsgResult`, `GeminiProvider.lookupWord` (already tested), `lookup` settings, and the tokenized `.ts-w` spans.

## Metadata
- **Module**: twosub
- **Source PRD**: `docs/prd/twosub.prd.md` (Milestone 2)
- **Source Feature SRS**: `docs/srs/twosub-dual-subtitle-mvp.srs.md` (AC-6, AC-7, AC-8)
- **Source Module Spec**: `docs/spec/twosub.spec.md`
- **Type**: feature · **Size**: M · **Rigor**: balanced · **Mode**: B (task-first tests)
- **Depends on**: M1 (`docs/plans/completed/` once verified)

## Acceptance Criteria (from SRS)
- **AC-6**: paused + hover/click EN word → popup with contextual ZH meaning (≤600ms; cached ≤50ms).
- **AC-7**: while playing, hovering a word triggers nothing (gated to paused).
- **AC-8**: popup 🔊 speaks the EN word via TTS; degrades gracefully if no voice.

## Tasks (Mode B)

### Task 1 — Word-lookup backend
- **Files**: `src/background/wordlookup.ts` (+test), edit `src/background/orchestrator.ts`, edit `src/types/messages.ts`.
- `makeWordLookup(provider, model, cache)` — caches `WordMeaning` by `word+sentence+tgt+model`.
- Add `LOOKUP_WORD` case to `registerHandlers` (own `Lru<WordMeaning>`); on error return `{ meaning:'', error }`.
- Add `error?: string` to `MsgResult.LOOKUP_WORD`.
- **TEST**: cache hit skips provider; different sentence = different lookup.

### Task 2 — TTS helper
- **Files**: `src/overlay/tts.ts` (+test).
- `ttsAvailable()`, `speak(text, rate, lang)` via `speechSynthesis` + `SpeechSynthesisUtterance`; false if unavailable.
- **TEST**: false when unavailable; calls `synth.speak` with rate when stubbed.

### Task 3 — Overlay word interaction + popup
- **Files**: edit `src/overlay/overlay.ts`.
- `setPaused(b)` toggles `.ts-paused` (hover affordance) + hides popup when playing.
- `setHandlers({ lookup, speak })`; delegated `mouseover`(debounced 220ms)/`click` on `.ts-w`, **gated on paused**.
- Popup (in shadow root, `pointer-events:auto`) positioned above the word; shows `🔊 word (lemma) pos` + meaning; click auto-speaks; `esc()` all provider text (XSS-safe). Hide on mouseleave (debounced) / play.
- **VALIDATE**: build (DOM, live).

### Task 4 — Session wiring
- **Files**: edit `src/capture/session.ts`.
- Track `video.paused` in the loop → `overlay.setPaused`.
- Inject handlers: `lookup = sendMsg('LOOKUP_WORD', {word, sentence, src:'en', tgt:'zh'})`; `speak = settings.lookup.ttsEnabled && tts.speak(word, settings.lookup.ttsRate)`.
- **VALIDATE**: build + live.

### Task 5 — Integration
- `npm test` + `npm run compile` + build both browsers; M2 report; PRD milestone 2 → in-progress/complete.

## NOT Building
- Saved vocabulary / SRS review (M-future, PRD "Won't v1").
- Dictionary-audio fallback (Web Speech only).
- Lemmatization client-side (Gemini returns `lemma`).

## Risks
| Risk | Mitigation |
|---|---|
| Hover spamming Gemini | 220ms debounce + word+sentence cache |
| Provider text injected as HTML | `esc()` everything before innerHTML |
| TTS voice missing (esp. Firefox) | graceful: meaning still shows, speak() returns false |
| Popup escaping the player on fullscreen | positioned relative to host (in player); revisit in M4 |
