# Feature Implementation Report: TwoSub M3 — HBO Max Support

## Summary
Added HBO Max as a third platform, reusing the entire M1/M2 pipeline (overlay, session, orchestrator, word lookup all platform-generic). The new piece is HBO-specific capture: since HBO ships subtitles inside the DRM-wrapped **DASH manifest** (no open API), the sniffer intercepts `/playback/v1/playbackInfo`, parses the **MPD** for WebVTT text tracks, and fetches + concatenates the segments — exactly InterSub's proven approach.

## Strategy Used
- Size: M · Mode: B (task-first tests where possible) · Rigor: balanced · Main-session sequential
- 1 feature commit; the pure MPD parser is unit-tested, the sniffer/wiring is build-verified

## Tasks Completed
| # | Task | Status |
|---|---|---|
| 1 | DASH MPD parser (`parseDashTextTracks`) | done (3 tests) |
| 2 | HBO MAIN-world sniffer | done (build-verified; **live pending**) |
| 3 | Content script + manifest + enable toggle | done |
| 4 | Integration build + report | done |

## Validation Results
| Level | Status | Notes |
|---|---|---|
| Static (tsc) | ✅ Pass | clean |
| Unit Tests | ✅ Pass | **44 total** (+3: DASH parser) |
| Build (Chromium + Firefox) | ✅ Pass | `hbo.js` content + `hbo-sniffer.js` bundle in both |
| Smoke test (live) | ⏳ Pending | **HBO is the fragile one** — needs a real session to calibrate |

## Files Changed
- New: `src/capture/hbo.ts` (+test), `entrypoints/hbo-sniffer.ts`, `entrypoints/hbo.content.ts`
- Edited: `wxt.config.ts` (HBO host_permissions + WAR), `src/types/settings.ts` (hboMax default on), `entrypoints/options/App.tsx` + `entrypoints/popup/App.tsx` (HBO toggle enabled)

## AC Verification Map
| AC | Description | Coverage | Status |
|----|-------------|----------|--------|
| AC-4 | HBO Max dual subtitles (native track via MPD; Gemini fallback; non-blocking on failure) | `hbo.test.ts` (MPD → segment URLs + timing + one-per-lang) | 🟢 parser / ⏳ live |

## Deviations from Plan
- MPD parser is **regex-based** (not DOMParser) so it's node-testable; handles the flat HBO MPD shape (Period > AdaptationSet[text] > Representation > SegmentTemplate + SegmentTimeline), `$Number$` / `$Number%0Nd$`, `presentationTimeOffset`/`timescale`/Period-`start` timing shift, and prefers non-forced tracks. No architectural deviation.

## Known best-effort gaps (need live HBO to calibrate — expected per PRD)
- [ ] **Segment timing**: cue offset = `periodStart − presentationTimeOffset/timescale` applied per track. Real HBO WebVTT fragments may carry their own `X-TIMESTAMP-MAP`; if subtitles are time-shifted, this is the dial to adjust.
- [ ] **`manifest.url` path**: assumed `playbackInfo.manifest.url` (with `manifests[0].url` fallback). Confirm against a real response.
- [ ] **Native-subtitle hide selector**: no HBO entry in `NATIVE_HIDE_CSS` yet (unknown container) → HBO's own subtitles may show *under* our overlay until the selector is found by inspecting the live player.
- [ ] **Domains**: `*.max.com` + `*.hbomax.com` covered; add `hbogo*`/regional if needed.

## Follow-ups
- [ ] Live HBO Max test (load unpacked, enable HBO Max, play a title) → capture a real `playbackInfo` + MPD if subtitles don't appear, and tune the 4 gaps above.
- [ ] **M4**: cross-browser hardening (lint, SPA-nav edge cases, fullscreen popup re-anchor), README, **push to GitHub**.
