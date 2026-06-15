# Feature Implementation Report: TwoSub M2 — Instant Word Lookup + Pronunciation

## Summary
Added the M2 learning loop: while paused, hovering or clicking an English word in the overlay opens a popup with its **contextual Chinese meaning** (Gemini, word + sentence) and a **🔊 pronunciation** button (Web Speech TTS); clicking a word also auto-speaks it. Built on M1's inert seams — no architectural change.

## Strategy Used
- Size: M · Mode: B (task-first tests) · Rigor: balanced · Main-session sequential
- 3 committed batches (backend → overlay → session), 4 new unit tests

## Tasks Completed
| # | Task | Status |
|---|---|---|
| 1 | Word-lookup backend (`makeWordLookup` + `LOOKUP_WORD` handler + word cache) | done |
| 2 | TTS helper (`speak`/`ttsAvailable`) | done |
| 3 | Overlay word interaction + popup (paused-gated, XSS-safe, positioned) | done (build-verified; live pending) |
| 4 | Session wiring (pause detection + inject lookup/TTS handlers) | done (build-verified; live pending) |
| 5 | Integration build + report | done |

## Validation Results
| Level | Status | Notes |
|---|---|---|
| Static (tsc) | ✅ Pass | clean |
| Unit Tests | ✅ Pass | **41 total** (+4: wordlookup ×2, tts ×2) |
| Build (Chromium) | ✅ Pass | content scripts 24.6 kB |
| Build (Firefox) | ✅ Pass | |
| Smoke test (live) | ⏳ Pending | bundled with M1 live test (per user request) |

## Files Changed
- New: `src/background/wordlookup.ts` (+test), `src/overlay/tts.ts` (+test)
- Edited: `src/background/orchestrator.ts` (LOOKUP_WORD case + word cache), `src/types/messages.ts` (`error?` on LOOKUP_WORD), `src/overlay/overlay.ts` (popup + paused-gated hover/click + pronunciation), `src/capture/session.ts` (pause tracking + handler injection)

## AC Verification Map (M2 scope)
| AC | Description | Coverage | Status |
|----|-------------|----------|--------|
| AC-6 | Paused hover/click → contextual ZH meaning | `wordlookup.test.ts` (cache); overlay/session wiring | 🟢 logic / ⏳ live |
| AC-7 | Gated to paused (no trigger while playing) | `overlay.onWordOver/Click` early-return on `!paused`; session `setPaused` | 🟢 logic / ⏳ live |
| AC-8 | 🔊 pronounces EN word; degrades if no voice | `tts.test.ts` (speak/false-when-unavailable) | 🟢 logic / ⏳ live |

## Deviations from Plan
- None architectural. Hover uses a **220 ms debounce** (cost control) and lookups are cached by word+sentence; provider text is `esc()`-escaped before `innerHTML` (XSS-safe). All as planned.

## Follow-ups
- [ ] Live test (with M1): paused hover/click a word on Netflix/YouTube → meaning popup + pronunciation; confirm no trigger while playing.
- [ ] Possible M4 polish: popup re-anchoring in fullscreen; dictionary-audio fallback if Web Speech voice quality is poor.
- [ ] M3 (HBO Max), M4 (hardening + GitHub release) remain.
