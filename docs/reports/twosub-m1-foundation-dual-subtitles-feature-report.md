# Feature Implementation Report: TwoSub M1 — Foundation + Netflix/YouTube Dual Subtitles

## Summary

Built the entire TwoSub extension skeleton (WXT 0.20.26 + React 19 + TypeScript, MV3, Firefox + Chromium/Brave from one codebase) and the Milestone-1 functional surface: dual subtitles (English top / Chinese bottom) on **Netflix** and **YouTube**, native-track-first with **Gemini** fallback, a bring-your-own Gemini key, full appearance customization, per-platform + global toggles, and translation caching. Word lookup (M2), HBO Max (M3), and cross-browser hardening + GitHub release (M4) are intentionally left as inert seams.

## Strategy Used
- Size: L
- Concurrency cap: unlimited (but executed **main-session sequential** — greenfield scaffold is a hard dependency of every task and edit-only subagents can't run installs/builds)
- Subagent count: none
- Waves: implemented as 6 committed batches (scaffold → core → provider/orchestrator → capture → overlay/content → UI)

## Assessment vs Reality
| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Large | Large |
| Confidence | 7/10 | Core verified (37 tests, both builds green); live capture unverified (expected) |
| Files Changed | ~30 | 44 source files created |

## Tasks Completed
| # | Task (plan) | Subagent? | Status |
|---|---|---|---|
| 1 | Scaffold WXT + React + TS | No | done |
| 2 | Core types + typed messaging | No | done |
| 3 | Settings store (+migration) | No | done |
| 4 | Gemini provider | No | done |
| 5 | LRU cache | No | done |
| 6 | Translation orchestrator + handlers | No | done |
| 7 | Subtitle parsers (VTT/TTML/json3) | No | done |
| 8 | MAIN-world injector | No | done |
| 9 | Netflix sniffer | No | done (build-verified; live pending) |
| 10 | YouTube sniffer | No | done (build-verified; live pending) |
| 11 | Capture adapter (native-first) | No | done |
| 12 | Sync engine | No | done |
| 13 | Shadow-DOM overlay + style | No | done (build-verified; live pending) |
| 14 | Content wiring (NF/YT) | No | done (build-verified; live pending) |
| 15 | Options UI | No | done |
| 16 | Popup UI | No | done |
| 17 | Integration validation | No | automated done; manual pending |

## Validation Results
| Level | Status | Notes |
|---|---|---|
| Static Analysis (tsc) | ✅ Pass | `wxt prepare && tsc --noEmit` clean |
| Lint | ⚪ N/A | No linter configured in M1 (add in M4 hardening) |
| Unit Tests | ✅ Pass | **37 tests** across 15 files (Vitest) |
| Build (Chromium) | ✅ Pass | `.output/chrome-mv3` — bg + 2 content + 2 sniffers + options/popup |
| Build (Firefox) | ✅ Pass | `.output/firefox-mv2` |
| Smoke test (live) | ⏳ Pending | Requires loading unpacked on real Netflix/YouTube — see Follow-ups |

## Files Changed
44 source files created (excludes `docs/`). Key areas:
- `src/types/*`, `src/core/*` (messaging, settings, lru), `src/sniff/events.ts`
- `src/background/{orchestrator, provider/{provider,gemini}}.ts`
- `src/capture/{inject, adapter, netflix, youtube, parsers/{webvtt,ttml,ytjson3}}.ts`
- `src/overlay/{overlay, sync, style}.ts`, `src/content/activate.ts`, `src/ui/validate.ts`
- `entrypoints/{background, netflix-sniffer, youtube-sniffer, netflix.content, youtube.content, options/*, popup/*}`
- Scaffold: `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `README.md`

## Deviations from Plan
- **Package manager**: used **npm** (pnpm not installed). Plan explicitly allowed this.
- **Commit granularity**: committed in 6 logical batches rather than one-commit-per-task. Test-first preserved per module (every pure module landed with its test).
- **tsconfig**: dropped `noUncheckedIndexedAccess` (kept `strict`) to avoid littering parser/regex code with assertions.
- **`inject.ts`**: typed against WXT's generated `ScriptPublicPath` / `injectScript` return type (tsc caught the original generic template type).
- **No architectural deviation from the SRS** — background-SW key boundary, MAIN-world sniffers, native-first orchestration, Shadow-DOM overlay, zero telemetry all as specified.

## AC Verification Map (M1 scope)
| AC | Description | Coverage | Status |
|----|-------------|----------|--------|
| AC-1 | Netflix dual native | `netflix.test.ts`, `webvtt/ttml` parsers, `sync`, `selectTracks` | 🟢 logic / ⏳ live |
| AC-2 | Native-first, AI fallback | `adapter.test.ts` (selectTracks), `orchestrator.test.ts` (cache) | 🟢 logic / ⏳ live |
| AC-3 | YouTube dual subtitles | `youtube.test.ts` (pickCaptionTracks), `ytjson3.test.ts` | 🟢 logic / ⏳ live |
| AC-5 | Customization applies live | `style.test.ts`, `validate.test.ts`; `watchSettings`→overlay | 🟢 logic / ⏳ live |
| AC-9 | BYO key + key never in page | by construction (key only in background SW + storage.local) | 🟢 design / ⏳ audit |
| AC-10 | Per-platform + global toggle | `activate.test.ts` (shouldActivate); content mount/unmount | 🟢 logic / ⏳ live |
| AC-11 | Cross-browser parity | chrome-mv3 + firefox-mv2 builds pass | 🟢 build / ⏳ live |
| AC-12 | No telemetry | by construction — no log server; only Gemini + platform origins | 🟢 design |
| AC-4 | HBO Max | — | ⚪ M3 (out of scope) |
| AC-6/7/8 | Word lookup + TTS | seams inert (`LOOKUP_WORD` type, `lookup` settings, `.ts-w` spans) | ⚪ M2 (out of scope) |

## Issues Encountered
- WXT 0.20 (rolldown-vite) vs Vitest 3 (bundled vite) plugin type clash in `vitest.config.ts` → cast `WxtVitest() as never` (runtime fine).
- `tsc` (not esbuild/vite build) is the real type gate — builds passed while `inject.ts` had a type error; fixed.

## Follow-ups
- [ ] **Live acceptance test** (the M1 manual matrix): load unpacked in Brave (`.output/chrome-mv3`) and Firefox (`.output/firefox-mv2`); verify dual subs on (a) a Netflix title with native EN+ZH, (b) a Netflix EN-only title (Gemini ZH, needs key), (c) a captioned YouTube video; verify size/opacity/color/position live; verify toggles; confirm the key never appears in page DOM.
- [ ] **Harden capture from real data**: capture one real Netflix manifest + one YouTube player response during live testing and adjust `pickTextTracks` / `pickCaptionTracks` if the shapes differ from the synthetic fixtures.
- [ ] **M2** — word lookup (hover/click while paused → Gemini contextual meaning) + Web Speech TTS.
- [ ] **M3** — HBO Max sniffer (DASH manifest → WebVTT).
- [ ] **M4** — cross-browser hardening (lint, SPA-nav edge cases, fullscreen re-anchor), README polish, **push to GitHub**.
