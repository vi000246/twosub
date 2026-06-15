# Spec: TwoSub (Bilingual Subtitle + Word-Learning Extension)

## Metadata
- **Module**: twosub
- **Parent Module**: N/A
- **Sub-modules**: N/A (single-module; candidate future split noted in Open Questions)
- **Source PRDs**:
  - `docs/prd/twosub.prd.md` — initial creation
- **Source Linear Issue**: N/A
- **Owner**: Logan (personal project)
- **Status**: ACTIVE — living document
- **Created**: 2026-06-15
- **Last Updated**: 2026-06-15

## Change History

| Date | Source PRD | Feature SRS | Summary |
|------|------------|-------------|---------|
| 2026-06-15 | `docs/prd/twosub.prd.md` | `docs/srs/twosub-dual-subtitle-mvp.srs.md` | Created — MV3 cross-browser extension that overlays native-first/AI-fallback dual subtitles (EN/ZH) on Netflix, YouTube, HBO Max, with instant contextual word lookup + TTS |

## Summary

TwoSub is a Manifest-V3 browser extension (Firefox + Chromium/Brave from one WXT codebase) that overlays **dual subtitles** — English on top, Chinese below — on Netflix, YouTube, and HBO Max. It captures each platform's **native** subtitle tracks via page-context network/JSON sniffers, pairs a native Chinese track when one exists, and falls back to **Gemini** machine translation otherwise. A learning layer lets the user hover/click an English word while paused to get a **contextual** Chinese meaning plus **TTS** pronunciation. All AI calls and the user's API key live in the background service worker; there is no telemetry.

---

## Domain Model

### Bounded Context
- **Context Name**: BilingualSubtitleViewer
- **Domain Layer**: Core Domain (this is the product)
- **Parent Module**: N/A

### Ubiquitous Language
| Term | Definition |
|------|-----------|
| **Cue** | A single timed subtitle unit: `{ startMs, endMs, text, lang }`. The normalized currency between capture and overlay. |
| **Track** | A full subtitle stream for one language on one title, e.g. an English WebVTT track. |
| **Native track** | A subtitle Track the streaming platform itself serves (official translation/CC), as opposed to an AI-generated one. |
| **Sniffer** | A page-context (MAIN-world) script that intercepts the player's network/JSON to discover and fetch Tracks. |
| **Capture adapter** | The content-script (ISOLATED-world) counterpart that receives sniffer output and normalizes it to `Cue[]`. |
| **Overlay** | The Shadow-DOM element rendering the two subtitle lines over the video. |
| **Tokenized line** | The English line split into per-word spans so each word is hoverable/clickable. |
| **Lemma** | The dictionary base form of a word (e.g. *running → run*) used to improve lookup. |
| **Provider** | An implementation of the translation/lookup interface; `GeminiProvider` is the only v1 impl. |
| **Learning line** | The language the user is studying (English) — rendered on top by default. |
| **Native line** | The user's first language (Chinese) — rendered below. |

### Domain Events *(internal)*
| Event | Trigger Condition | Consumers |
|---|---|---|
| `CuesCaptured` | A sniffer discovers/loads a Track | Capture adapter → Sync engine (same tab) |
| `SettingsChanged` | User edits settings in popup/options | Content scripts (live re-style), Orchestrator |
| `PlaybackPaused` / `PlaybackResumed` | `video` element pause/play | Interaction layer (enables/disables word lookup) |

---

## System Context

### Scope & Boundaries
- **In scope**: the MV3 extension end-to-end — background service worker, content scripts (capture adapters, sync engine, overlay, interaction), page-context sniffers, options + popup UI, settings/cache storage, the `GeminiProvider`.
- **Out of scope**: vocabulary persistence / SRS review; app-store distribution; platforms beyond NF/YT/HBO; language pairs other than EN↔ZH (validated); providers other than Gemini (implemented); telemetry; settings cloud sync.

### Actors
| Actor | Type | Interaction |
|---|---|---|
| Logan (viewer/learner) | Human | Watches, customizes appearance, sets Gemini key, hovers/clicks words |
| Streaming player (Netflix / YouTube / HBO Max) | Service (page) | Source of native tracks; intercepted, not contracted |
| Gemini API | External service | Translates cue lines + resolves contextual word meanings (user's key) |
| Browser TTS engine (Web Speech) | Platform API | Pronounces English words |

### External Dependencies
| Dependency | Purpose | Failure Mode |
|---|---|---|
| Gemini `generateContent` | Line translation + word lookup | No AI Chinese line / no lookup → fall back to native track only; popup shows "translation unavailable"; backoff on rate limit |
| Streaming platform internals (timedtext / DASH manifest) | Native track source | No subtitles captured → non-blocking notice; per-platform isolated |
| Web Speech `speechSynthesis` | Pronunciation | No audio → meaning still shown, audio marked unavailable |
| Browser extension APIs (`storage`, `runtime`, `scripting`) | Platform substrate | Hard dependency; WXT + polyfill normalize across browsers |

---

## Architecture

### High-Level Diagram
```
            ┌──────────────────────── Streaming page (MAIN world) ────────────────────────┐
            │  Netflix / YouTube / HBO player  ──fetch/XHR/JSON──►  [ Sniffer (injected) ] │
            └───────────────────────────────────────────────────────────┬─────────────────┘
                                       CustomEvent  twosub:cues ▲        │ twosub:command
                                                                │        ▼
            ┌──────────────────── Content script (ISOLATED world) ───────────────────────┐
            │  Capture adapter ─► Sync engine ─► Overlay (Shadow DOM, tokenized EN line)  │
            │                       ▲                         │ hover/click (while paused)│
            │                       │ translated cues         ▼                           │
            │                  Interaction layer ─────────────────────────────────────────│
            └───────────┬───────────────────────────────────────────────▲────────────────┘
                        │ runtime msg: TRANSLATE_CUES / LOOKUP_WORD       │ results
                        ▼                                                 │
            ┌──────────────────── Background service worker ──────────────┴────────────────┐
            │  Translation orchestrator (native-vs-AI, batch, cache)  ─►  GeminiProvider    │──HTTPS──► Gemini
            │  Settings store (storage.local)  ◄──── options/popup UI (React) ──────────────│
            └───────────────────────────────────────────────────────────────────────────────┘
```

### Components
| Component | Responsibility | Interface |
|---|---|---|
| Page-context Sniffer (per platform) | Intercept player network/JSON; discover + fetch native Tracks; emit raw cues | Injected MAIN-world script; emits `CustomEvent('twosub:cues')`; listens `twosub:command` |
| Capture adapter (per platform) | Normalize platform tracks → `Cue[]`; manage track selection | Content-script module; consumes sniffer events |
| Sync engine | Pick active cue(s) from `video.currentTime`; drive overlay; request upcoming translations | Content-script; `requestAnimationFrame`/`timeupdate` loop |
| Overlay renderer | Render EN(top)/ZH(bottom) in Shadow DOM; tokenize EN into word spans; apply style vars; hide native subs | Content-script; Shadow root mounted near the video |
| Interaction layer | Detect pause; bind hover/click on word spans → lookup; play TTS | Content-script; `speechSynthesis` |
| Translation orchestrator | Decide native-vs-AI; batch + prefetch; cache; dedupe | Background; handles `TRANSLATE_CUES` |
| Provider (`GeminiProvider`) | Call Gemini for `translateBatch` + `lookupWord` | Background; implements `TranslationProvider` |
| Settings store | Typed, versioned `storage.local`; reactive change broadcast | Shared (WXT storage); `GET_SETTINGS`/`SETTINGS_CHANGED` |
| Options + Popup UI | Edit settings, key entry, per-platform + global toggles | React pages (WXT) |
| Messaging bus | content↔background (`runtime`), page↔content (DOM events) | Typed message envelopes (`v`, `type`, `payload`) |

### Data Flow
- **Capture**: push — sniffers fire as the player loads tracks; adapters normalize to `Cue[]`.
- **Translation**: pull/batch — the sync engine requests translations for the next *N* cues ahead of display; orchestrator serves from cache or Gemini.
- **Overlay sync**: a per-frame loop reads `video.currentTime` and swaps the active cue (sync, no async in the hot path).
- **Word lookup**: on-demand request/response while paused; cached per `(word, sentence-hash)`.

### Sequence Diagrams (key flows)
```
[Dual-subtitle render — native EN, AI ZH]
player → sniffer: fetch timedtext/manifest
sniffer → capture: twosub:cues { tracks:[en], cues_en }
capture → sync: normalized Cue[] (en)
sync → background: TRANSLATE_CUES { next N en cues, src=en, tgt=zh }
background → cache: lookup
cache --miss--> GeminiProvider → Gemini: generateContent(batch)
Gemini → background: zh lines
background → sync: { translations }
sync → overlay: render(en_top, zh_bottom) @ currentTime
```
```
[Word lookup while paused]
user → video: pause
interaction: PlaybackPaused → enable word hover/click
user → overlay(word span): hover/click
interaction → background: LOOKUP_WORD { word, sentence, en→zh }
background → cache: lookup  --miss--> Gemini: generateContent(word+context)
Gemini → background: { meaning, lemma, pos }
background → interaction: result
interaction → overlay: show popup(meaning) + 🔊
user → interaction: click 🔊 → speechSynthesis.speak(word)
```

---

## Data Model

> No database. State lives in `browser.storage.local` (persisted) + per-tab memory (ephemeral). Schema expressed as TypeScript-shaped contracts (the storage equivalent of a schema).

### Entities
| Entity | Owner | Lifecycle |
|---|---|---|
| `Settings` | Extension (single record) | Created on install (defaults); persists; migrated on version bump |
| `TranslationCacheEntry` | Background | LRU; evicted by size/age |
| `WordLookupCacheEntry` | Background | LRU; evicted by size/age |
| `SessionState` | Content script (per tab) | In-memory; discarded on navigation/close |

### Schema (new)
```ts
// storage.local — versioned root
interface TwoSubStorage {
  schemaVersion: number;            // for forward migration
  settings: Settings;
  caches: { translation: LruMap; wordLookup: LruMap };  // bounded
}

interface Settings {
  enabled: boolean;                              // global toggle
  platforms: { netflix: boolean; youtube: boolean; hboMax: boolean };
  languages: { learning: 'en'; native: 'zh'; learningOnTop: boolean };
  appearance: {
    fontSizePx: number;            // e.g. 16–48
    bgOpacity: number;             // 0.0–1.0
    textColor: string;            // hex
    position: 'bottom' | 'top' | 'custom';
    offsetY?: number;             // when position = custom
  };
  provider: { name: 'gemini'; apiKey: string; model: string /* default 'gemini-2.5-flash' */ };
  lookup: { source: 'gemini'; ttsEnabled: boolean; ttsRate: number };
}

interface Cue { id: string; startMs: number; endMs: number; text: string; lang: string }
```

### Migration Strategy
- **Forward**: on extension update, compare `schemaVersion`; run ordered migrators to fill new fields with defaults.
- **Backward**: not supported (personal tool); a corrupt/older store resets to defaults (key preserved if readable).
- **Backfill**: none.
- **Coexistence**: single local store; no multi-version coexistence.

---

## API Contracts

### Endpoints

No HTTP server is hosted. Contracts are the **internal messages** and the **external Gemini call**.

**External — Gemini** (`POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, header `x-goog-api-key: <key>`):

```jsonc
// Batch cue translation — Request (conceptual; structured output preferred)
{
  "contents": [{ "parts": [{ "text": "Translate each English line to zh-TW. Return JSON array...\n1. <line>\n2. <line>" }] }],
  "generationConfig": { "responseMimeType": "application/json", "temperature": 0.2 }
}
// Response → JSON array of { "i": 1, "zh": "<translation>" } (validated; fallback to indexed parse)
```
```jsonc
// Word lookup — Request
{ "contents": [{ "parts": [{ "text": "Word: \"<word>\" in sentence: \"<sentence>\". Give concise zh-TW meaning, base form, POS as JSON." }] }],
  "generationConfig": { "responseMimeType": "application/json" } }
// Response → { "meaning": "<zh>", "lemma": "<base>", "pos": "<noun|verb|...>" }
```

**Internal — runtime messages** (content ↔ background), envelope `{ v: 1, type, payload }`:

| `type` | Payload → Result |
|---|---|
| `TRANSLATE_CUES` | `{ cues: {id,text}[], src:'en', tgt:'zh' }` → `{ translations: {id,text}[] }` |
| `LOOKUP_WORD` | `{ word, sentence, src:'en', tgt:'zh' }` → `{ meaning, lemma?, pos? }` |
| `GET_SETTINGS` | `{}` → `Settings` |
| `SETTINGS_CHANGED` | broadcast `{ settings: Settings }` (no reply) |

**Page ↔ content — DOM CustomEvents**:

| Event | Direction | Detail |
|---|---|---|
| `twosub:cues` | sniffer → content | `{ platform, tracks: TrackMeta[], cues: Cue[] }` |
| `twosub:command` | content → sniffer | `{ selectTrack: lang }` |

### Error Codes
| Code | Surfaced As | Meaning | Caller Action |
|---|---|---|---|
| `PROVIDER_NO_KEY` | popup banner | No Gemini key set | Prompt user to add key in settings |
| `PROVIDER_RATE_LIMITED` | transient notice | Gemini 429 | Exponential backoff; show "retrying"; keep native line |
| `PROVIDER_ERROR` | transient notice | Gemini 4xx/5xx/parse fail | Skip AI line; keep native; log locally |
| `CAPTURE_NO_TRACKS` | non-blocking notice | No native track found | Offer AI-only (if EN somehow available) or inform |
| `CAPTURE_PLATFORM_UNSUPPORTED` | silent | Page not a supported player | No-op |

### Versioning Strategy
- Internal messages carry `v` (bump on breaking shape change).
- Gemini model pinned via `settings.provider.model` (default `gemini-2.5-flash`); swappable without code change.

---

## Non-Functional Requirements

| Category | Target | Measurement | How Achieved |
|---|---|---|---|
| Performance | Overlay active cue within ±50 ms; word popup ≤ 600 ms (≤ 50 ms cached); next ZH line ready before display ≥ 95% | Manual timing / console marks | rAF sync loop; prefetch+batch; LRU caches |
| Security | Gemini key never in MAIN world or DOM; minimal permissions | Code audit + DOM/MAIN scan | Key only in background + `storage.local`; calls from SW |
| Privacy | Zero telemetry; only Gemini receives data (user key) | Network capture; code audit | No log-server; explicitly removed vs InterSub |
| Reliability | One platform's breakage never disables others; HBO degrades gracefully | Manual fault injection | Independent adapters; AI fallback; try/catch + notices |
| Cross-browser | Feature parity Firefox + Brave | Manual test matrix | WXT dual MV3 build; `webextension-polyfill` |
| Cost | Near-zero steady-state on user's key | Gemini usage dashboard (user's) | Caching + batching; flash default; flash-lite option |
| Observability | Local debug log toggle; no remote | Manual | Console/debug flag in settings |

---

## Technology Choices

| Concern | Choice | Alternatives | Rationale |
|---|---|---|---|
| Extension framework | **WXT** | Plasmo, CRXJS, vanilla MV3 | Leading 2026 cross-browser MV3; one codebase → Firefox + Chromium/Brave; Vite + HMR; auto background-worker config |
| Language | **TypeScript** | JS | Type-safe message/contract surface |
| UI (options/popup) | **React** | Svelte, vanilla | Familiar; matches Lingosive's approach; rich settings UI |
| In-video overlay | **Shadow-DOM + vanilla DOM** | React in content | Perf hot path (per-frame cue swap, many word spans); style isolation from host page |
| Native-track capture | **Page-context sniffer (monkey-patch `XHR`/`fetch`/`JSON.parse`/`DOMParser`)** | DOM-scrape rendered subs | Gets official tracks + timing; proven by InterSub; works under DRM via manifest |
| Translation/lookup | **Gemini `generateContent`**, default `gemini-2.5-flash` | flash-lite (cheaper), Google Translate, DeepL | User chose balanced quality; pluggable `Provider`; model is a setting |
| Pronunciation | **Web Speech `speechSynthesis`** | Dictionary audio, cloud TTS | Free, no extra key; upgrade path noted |
| Storage | **`browser.storage.local`** + bounded LRU caches | IndexedDB | Simple; settings small; caches bounded |
| Cross-browser shim | **`webextension-polyfill`** (via WXT) | manual `chrome.*` guards | Promise-based `browser.*` parity |

---

## Integration Points

| Touchpoint | Type | Contract | Backwards Compat |
|---|---|---|---|
| Netflix player | DOM/network interception | `timedtexttracks` JSON → WebVTT/TTML (no public contract) | N/A — version-tolerant parsing, may break on platform change |
| YouTube player | DOM/network interception | `ytInitialPlayerResponse.captions.captionTracks` → timedtext | N/A — same |
| HBO Max player | DOM/network interception | `/playback/v1/playbackInfo` → DASH MPD → WebVTT segments | N/A — fragile, best-effort |
| Gemini API | HTTPS | `generateContent` request/response above | Pin model in settings |
| Browser TTS | Platform API | `speechSynthesis.speak()` | Graceful absence |

### Rollout Strategy
- **Feature flags**: per-platform toggles + global toggle in `Settings` (also the kill switch).
- **HBO Max** ships behind a "best-effort" status indicator; failures are non-blocking.
- **Rollback**: it's a self-installed unpacked/zipped extension — revert by loading a prior build; no server state.

---

## Codebase Patterns to Follow

> Greenfield project — no internal code yet. Patterns below reference the **analyzed reference extension** (InterSub 4.46.0, unpacked at `/tmp/twosub-ref/intersub/` during grounding) as proven blueprints. Pointers only — reimplement cleanly, do not copy.

| Pattern | Where to Find (reference) | Why Follow |
|---|---|---|
| MAIN-world injector | `/tmp/twosub-ref/intersub/hbo-max-subtitle-sniffer-injector.js` | Inject page-context script via `runtime.getURL` + `<script>` tag (de-duped) |
| Network monkey-patch sniff | `/tmp/twosub-ref/intersub/hbo-max-subtitle-sniffer.js` | Patch `XHR.open/send`, `fetch`, `DOMParser`; intercept `playbackInfo`; parse DASH `AdaptationSet[lang][contentType="text"]`; prefer SDH/full over forced/CC |
| Netflix timedtext capture | `/tmp/twosub-ref/intersub/netflix-subtitle-sniffer.js` | Read `timedtexttracks`, choose WebVTT/DFXP profile |
| YouTube captions | InterSub `content-script.js` (`ytInitialPlayerResponse` / `captionTracks`) | Read caption track list; fetch timedtext (json3/vtt); optional `&tlang=` auto-translate |
| Tokenize + lemma + dictionary | InterSub `main.js` (`Token`/`Lemma`/`Dictionary`, `dblclick`/`mouseover`) | Tokenize line into word spans; lemmatize before lookup |
| Manifest permissions shape | `/tmp/twosub-ref/intersub/manifest.json` | MV3 `storage`/`webRequest`, host `<all_urls>`, per-platform `document_start` injector content scripts, `web_accessible_resources` for sniffer JS |

---

## Risks & Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| HBO Max breaks (rebrands/DRM/CSP) | H | H | Best-effort flag; AI fallback; isolate adapter; version-tolerant MPD parse; verify live |
| Netflix/YouTube change internal shapes | M | H | Defensive parsing; per-platform isolation; graceful "no subs" notice |
| Gemini latency/cost during fast dialogue | M | M | Batch + prefetch + cache; flash default; flash-lite option |
| MAIN-world injection blocked by page CSP | M | M | `web_accessible_resources` + injector `<script src=runtime.getURL>` (InterSub-proven); detect + notify on failure |
| Gemini free-tier rate limits during binge | M | M | Backoff + "retrying" UX; keep native line; cache aggressively |
| Key in `storage.local` not encrypted | L | M | Acceptable for personal BYO; never sync; document; key stays in background |
| Firefox vs Chromium MV3 differences (background type, APIs) | L | M | WXT abstraction (`defineBackground`); polyfill; test both |
| TTS voice missing (esp. Firefox/OS) | L | L | Degrade: show meaning, mark audio unavailable |

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Extension framework | WXT + TypeScript + React | Plasmo, vanilla MV3 | Best 2026 cross-browser MV3 DX; one codebase Firefox + Brave (user-selected) |
| Where Gemini key + calls live | Background service worker | Content script direct | Keeps key out of page/MAIN world; avoids page CSP/CORS (security boundary) |
| Native-track capture | Page-context network/JSON sniffers | DOM-scrape rendered subtitles | Official tracks + accurate timing; works under DRM; proven by InterSub |
| Chinese line source | Native track first, Gemini fallback | Always AI | Official translation quality; matches PRD Q3 |
| Word lookup source | Gemini contextual (word + sentence) | Dictionary API, both | Handles idioms/phrasal verbs; best for learning (user-selected) |
| Default Gemini model | `gemini-2.5-flash` (configurable) | flash-lite, pro | Balanced quality/cost on user's key (user-selected) |
| Overlay rendering | Shadow-DOM vanilla | React in content | Per-frame perf + style isolation |
| Pronunciation | Web Speech `speechSynthesis` | Dictionary/cloud audio | Free, no extra key; upgrade later |
| Telemetry | None | InterSub-style log server | Privacy; personal tool |
| Settings storage | `storage.local` (versioned) | IndexedDB / sync | Simple, small, local-only |

---

## Open Questions

- [ ] Gemini **structured-output** reliability (JSON array) for batch translation vs. delimiter parsing — decide in Plan.
- [ ] Lemmatize **client-side** (small lib) or rely on Gemini's returned `lemma`.
- [ ] Free-tier Gemini **rate-limit** handling/UX during long sessions.
- [ ] HBO Max **durability** across future rebrands (standing risk).
- [ ] TTS voice quality acceptability; schedule dictionary-audio upgrade?
- [ ] Future **sub-module split** (`twosub/capture`, `twosub/translation`, `twosub/learning`) once the codebase grows — not now.
- [ ] Manifest **host-permission** scope: `<all_urls>` (like InterSub) vs. only the three platforms' domains (tighter, preferred if feasible).
