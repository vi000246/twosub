---
linear_issue: null
---
# SRS: Dual-Subtitle + Instant Word-Learning MVP

## Metadata
- **Module**: `twosub`
- **Module Spec**: `docs/spec/twosub.spec.md`
- **Source PRD**: `docs/prd/twosub.prd.md`
- **Source Linear Issue**: N/A
- **Created**: 2026-06-15
- **Mode**: GREENFIELD (new module, no existing code)
- **Plans**: `docs/plans/twosub-m1-foundation-dual-subtitles.plan.md` (M1 — foundation + Netflix/YouTube; M2/M3/M4 to follow)

## Feature Summary

The entire v1 of the TwoSub MV3 browser extension: render dual subtitles (English on top, Chinese below) on Netflix, YouTube, and HBO Max — native track first, Gemini AI translation as fallback — with full appearance customization, a bring-your-own Gemini key, and an on-the-spot word-learning popup (hover-while-paused / click → contextual translation + TTS pronunciation). Targets Firefox + Brave from one WXT codebase.

## Delta from Current Module State

> This is a greenfield module. There is no "current state" to diff against — everything below is net-new. `docs/spec/twosub.spec.md` holds the full architecture; this SRS scopes the v1 feature set and its acceptance criteria.

### New / Changed "API Endpoints"

This extension exposes **no HTTP server**. Its contracts are (a) internal extension messages and (b) the external Gemini call. See `docs/spec/twosub.spec.md › API Contracts` for full shapes.

| Surface | Channel | Purpose |
|---|---|---|
| `TRANSLATE_CUES` | content → background (`runtime` msg) | Batch-translate upcoming English cues → Chinese (when no native ZH track) |
| `LOOKUP_WORD` | content → background (`runtime` msg) | Contextual word lookup (word + sentence → meaning/lemma/POS) |
| `GET_SETTINGS` / `SETTINGS_CHANGED` | content/UI ↔ background | Read + observe settings |
| `twosub:cues` / `twosub:command` | page(MAIN) ↔ content (DOM `CustomEvent`) | Sniffer emits captured tracks/cues; content selects track |
| Gemini `:generateContent` | background → Google (HTTPS) | Translation + word lookup via user's key |

### New / Changed Data Models

All in `browser.storage.local` (typed, versioned). New: `Settings`, `TranslationCacheEntry`, `WordLookupCacheEntry`; in-memory only: `SessionState` (per tab). Schema in `docs/spec/twosub.spec.md › Data Model`.

### Changed Business Logic

N/A — net-new. Core logic = the **native-first / AI-fallback orchestration** and the **per-platform capture → normalized `Cue` stream** pipeline (Module Spec › Architecture).

### Explicitly Out of Scope

- Saved vocabulary book / spaced-repetition review (PRD "Won't v1").
- App-store submission, privacy policy, store listing (self-install only).
- Platforms beyond Netflix / YouTube / HBO Max.
- Language pairs other than English↔Chinese (architecture stays parameterized, only EN↔ZH validated).
- Providers other than Gemini implemented (interface is pluggable; only `GeminiProvider` ships).
- Cloud sync of settings; telemetry of any kind.

## Functional Requirements

- [ ] **FR-1** Render two subtitle lines over the video — English (learning) on top, Chinese (native) below — synced to playback.
- [ ] **FR-2** Capture native subtitle tracks on **Netflix** (`timedtexttracks` → WebVTT/TTML).
- [ ] **FR-3** Capture native subtitle tracks on **YouTube** (`captionTracks` → timedtext json3/vtt).
- [ ] **FR-4** Capture native subtitle tracks on **HBO Max** (DASH manifest → WebVTT segments).
- [ ] **FR-5** Use the platform's **native Chinese track when present**; otherwise **Gemini-translate** the English line to Chinese.
- [ ] **FR-6** Let the user set a **Gemini API key** in settings; persist it locally; never expose it to page context.
- [ ] **FR-7** Customize appearance: **font size, background opacity, text color, on-screen position**; apply live.
- [ ] **FR-8** While **paused**, hovering or clicking an English word shows a popup with its **contextual Chinese meaning** (via Gemini, word + sentence).
- [ ] **FR-9** The word popup offers **audio pronunciation** of the English word (Web Speech TTS).
- [ ] **FR-10** Provide a **provider abstraction** with Gemini implemented; the model is a setting (default `gemini-2.5-flash`).
- [ ] **FR-11** **Per-platform enable/disable** + a global on/off toggle (popup).
- [ ] **FR-12** **Cache** translations and word lookups to cut latency and Gemini cost.
- [ ] **FR-13** Run with feature parity in **Firefox + Brave** (MV3, one WXT codebase).
- [ ] **FR-14** **No telemetry**: the only outbound network call is to Gemini with the user's own key.

## Non-Functional Requirements

| Category | Target | How Achieved |
|---|---|---|
| Performance — overlay sync | Active cue within ±50 ms of native timing | rAF/`timeupdate` loop reading `video.currentTime`; pre-normalized cue index |
| Performance — word lookup | Popup ≤ 600 ms (cache hit ≤ 50 ms) | Per-word LRU cache; single fast Gemini call; show spinner then result |
| Performance — line translation | Upcoming ZH line ready before its cue displays in ≥ 95% of cases | Prefetch + batch next N cues; cache by `(text, src, tgt, model)` |
| Security / Privacy | Key never in page/MAIN world; zero telemetry | Gemini calls only in background SW; `storage.local`; minimal permissions |
| Reliability | Per-platform failure is isolated; HBO degrades gracefully | Independent capture adapters; AI fallback; non-blocking status notice |
| Cross-browser | Identical features on Firefox + Brave | WXT dual build; `webextension-polyfill`; manual test matrix |
| Cost | Near-zero steady-state on user's key | Caching + batching; `gemini-2.5-flash` default (flash-lite selectable) |

## Architecture Notes

See `docs/spec/twosub.spec.md` for the full architecture, contracts, and decisions. Feature-specific points:
- Gemini key + all Gemini calls live in the **background service worker**; content scripts request via `runtime` messaging (security boundary).
- Per-platform **page-context sniffers** (injected MAIN-world scripts) monkey-patch `XHR`/`fetch`/`JSON.parse`/`DOMParser` to read native tracks, mirroring the proven InterSub reference (`/tmp/twosub-ref/intersub/*-subtitle-sniffer.js`). They emit a normalized `Cue` stream over `CustomEvent`.
- Overlay is a **Shadow-DOM** container (native subs hidden); the English line is tokenized into per-word spans to enable hover/click lookup.

## Acceptance Criteria

> BDD Given/When/Then. Each maps to a runnable check (mostly manual/E2E given browser-extension + DRM constraints; unit-testable pieces noted).

### AC-1: Dual subtitles on Netflix (native both languages)
- **Given** TwoSub is enabled, a valid Gemini key is set, and a Netflix title offers both English and Chinese subtitle tracks
- **When** the user plays the title
- **Then** an English line renders on top and a Chinese line below, both from the **native** tracks, synced within ±50 ms of playback
- **Test**: manual on a known dual-track title; unit test the `timedtexttracks` → `Cue[]` normalizer with a captured fixture

### AC-2: Native-Chinese-first, AI fallback
- **Given** a title has an English track but **no** Chinese track
- **When** the user plays it
- **Then** the English line comes from the native track and the Chinese line is **Gemini-translated**, and the same line is not re-translated twice (cache hit on repeat)
- **Test**: manual on an English-only title; unit test the orchestrator's native-vs-AI branch + cache

### AC-3: YouTube dual subtitles
- **Given** a YouTube video with English captions (manual or auto)
- **When** the user plays it with TwoSub enabled
- **Then** dual EN/ZH lines render (ZH native if available, else Gemini)
- **Test**: manual on a captioned video; unit test `captionTracks` parser

### AC-4: HBO Max dual subtitles (best-effort)
- **Given** an HBO Max title with an English subtitle track in its DASH manifest
- **When** the user plays it
- **Then** the English line renders from the native track and the Chinese line is native-if-present-else-Gemini; **and** if capture fails, a non-blocking notice appears instead of a silent failure
- **Test**: live manual test (DRM); unit test the MPD `AdaptationSet[lang][contentType="text"]` parser with a captured manifest fixture

### AC-5: Appearance customization applies live
- **Given** subtitles are showing
- **When** the user changes font size, background opacity, text color, or position in settings
- **Then** the overlay updates immediately without reload, and the choices persist across sessions
- **Test**: manual; unit test settings → CSS-variable mapping

### AC-6: Word lookup while paused
- **Given** playback is **paused** and dual subtitles are visible
- **When** the user hovers or clicks an English word in the top line
- **Then** a popup shows that word's **contextual** Chinese meaning (derived from the word + its sentence), within 600 ms (≤ 50 ms if cached)
- **Test**: manual; unit test the `LOOKUP_WORD` request builder + cache key

### AC-7: Word lookup is gated to paused state
- **Given** the video is **playing**
- **When** the user moves the mouse over a subtitle word
- **Then** no lookup popup is triggered (lookup only activates while paused)
- **Test**: manual; unit test the pause-state guard

### AC-8: Pronunciation
- **Given** the word popup is open
- **When** the user activates the pronounce control
- **Then** the English word is spoken via the browser TTS; if no TTS voice is available, the popup still shows the meaning and indicates audio is unavailable
- **Test**: manual on Firefox + Brave (voice availability differs)

### AC-9: Bring-your-own key + key safety
- **Given** no Gemini key is set
- **When** the user opens settings and saves a key
- **Then** translation/lookup start working; **and** the key is never present in the page/MAIN world or any DOM node (only background + `storage.local`)
- **Test**: manual; automated check that the key string never appears in page DOM / MAIN-world globals

### AC-10: Per-platform + global toggle
- **Given** TwoSub is installed
- **When** the user disables a platform (or the global toggle) in the popup
- **Then** no overlay or capture runs on that platform (or anywhere, for global), and re-enabling restores it without reload
- **Test**: manual; unit test toggle → capture-activation gate

### AC-11: Cross-browser parity
- **Given** the same build loaded in Firefox and Brave
- **When** the user runs AC-1, AC-6, AC-9 in each
- **Then** behavior is equivalent in both
- **Test**: manual matrix on both browsers

### AC-12: No telemetry
- **Given** normal usage across all three platforms
- **When** outbound network requests are inspected
- **Then** the only TwoSub-originated external requests go to the Gemini endpoint with the user's key — no analytics/log-server calls
- **Test**: manual network capture; code audit (no log-server URLs)

## Open Questions

- [ ] Reliability of Gemini **structured-output** (JSON array) for batch cue translation vs. delimiter-based parsing — pick in Plan.
- [ ] Lemmatization: client-side (e.g. a small lemmatizer) vs. let Gemini return the base form in `LOOKUP_WORD`.
- [ ] Free-tier Gemini **rate limits** during binge-watching — need backoff + "translations paused, retrying" UX?
- [ ] HBO Max durability across future rebrands (tracked as a standing risk, verify live).
- [ ] Is Web Speech TTS voice quality acceptable, or schedule a dictionary-audio upgrade later?
