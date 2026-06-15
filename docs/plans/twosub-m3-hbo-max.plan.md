---
linear_issue: null
---
# Plan: TwoSub M3 — HBO Max Support

## Summary
Add HBO Max as a third platform. The overlay, session, orchestrator, and word lookup are already platform-generic, so the only new work is HBO-specific capture: HBO ships subtitles inside the DRM-wrapped **DASH manifest** (no open API), so the sniffer intercepts `/playback/v1/playbackInfo`, parses the **MPD** for WebVTT text tracks, and fetches + concatenates the segments — mirroring InterSub.

## Metadata
- **Module**: twosub
- **Source PRD**: `docs/prd/twosub.prd.md` (Milestone 3)
- **Source Feature SRS**: `docs/srs/twosub-dual-subtitle-mvp.srs.md` (AC-4)
- **Source Module Spec**: `docs/spec/twosub.spec.md`
- **Type**: feature · **Size**: M · **Rigor**: balanced · **Mode**: B
- **Note**: PRD-flagged **best-effort / fragile** — verify and calibrate live.

## Acceptance Criteria (SRS AC-4)
HBO title with an English subtitle track in its DASH manifest → English from the native track, Chinese native-if-present-else-Gemini; capture failure shows a non-blocking notice rather than failing silently.

## Tasks (Mode B)

### Task 1 — DASH MPD parser
- `src/capture/hbo.ts` `parseDashTextTracks(mpd, manifestUrl)` → `HboTrack[]` (lang, kind, resolved segment URLs, timingShiftMs). Regex-based (node-testable). Handles Period`start`, `BaseURL` resolution, `SegmentTemplate` (`media`/`startNumber`/`timescale`/`presentationTimeOffset`), `SegmentTimeline` `S`@`r`, `$Number$`/`$Number%0Nd$`, one-track-per-lang preferring non-forced.
- **TEST**: synthetic MPD → segment URLs + timing + forced-exclusion.

### Task 2 — HBO MAIN-world sniffer
- `entrypoints/hbo-sniffer.ts`: patch `fetch` + `XHR` → intercept `/playback/v1/playbackInfo` → read `manifest.url` → fetch MPD → `parseDashTextTracks` → fetch each WebVTT segment → `parseWebVtt` + shift timings + de-dupe → emit `CuesDetail{platform:'hboMax'}`. De-dupe by manifest URL.
- **VALIDATE**: build (live calibration pending).

### Task 3 — Content + manifest + enable
- `entrypoints/hbo.content.ts` (matches `*.max.com`, `*.hbomax.com`); `host_permissions` + WAR for `hbo-sniffer.js`; `hboMax` default on + options/popup toggle enabled.

### Task 4 — Integration
- `npm test` + compile + both builds; report; PRD milestone 3.

## NOT Building
- HBO native-subtitle hide selector (unknown until live DOM inspection) — left empty, flagged.
- Regional HBO Go domains (add later if needed).

## Risks (all expected per PRD "fragile")
| Risk | Mitigation |
|---|---|
| Segment timing offset wrong | `periodStart − pto/timescale` shift; tune live vs `X-TIMESTAMP-MAP` |
| `manifest.url` path differs | `manifest.url` + `manifests[0].url` fallback; confirm on a real response |
| HBO rebrands/DRM break it | isolated adapter; non-blocking; per InterSub history, expect breakage |
| Native subs show under overlay | add hide selector once found in live player |
