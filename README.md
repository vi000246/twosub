# TwoSub

**Bilingual (English / Chinese) dual subtitles + instant word learning** for **Netflix, YouTube, and HBO Max** — built with [WXT](https://wxt.dev/), Manifest V3, for **Firefox + Brave/Chromium** from one codebase.

English sits on top (the language you're learning); Chinese below. The Chinese line uses the title's **official subtitle track when it has one**, and otherwise is translated on the fly by **Google Gemini** using **your own API key**. Pause and **hover or click an English word** for an instant contextual meaning + **pronunciation**.

> 🧪 **Status:** Milestones 1–3 are code-complete and build/test-green; live calibration on the streaming sites is ongoing (HBO Max especially is best-effort — see [Status](#status)). Not on any extension store — install from source.

---

## Features

- **Dual subtitles** — English (top) + Chinese (bottom), synced to playback.
- **Native-first, AI fallback** — uses the platform's official Chinese subtitle track when present; otherwise translates the English line with Gemini.
- **Bring your own Gemini key** — no subscription, no per-lookup quota; the key is stored locally and only ever sent to Google.
- **Instant word learning** — while **paused**, hover or click an English word → contextual Chinese meaning (+ base form / part of speech) and a 🔊 **pronunciation** button (Web Speech TTS).
- **Fully customizable** — font size, background opacity, text color, on-screen position; which language is on top.
- **Per-platform + global toggles.**
- **Private by design** — zero telemetry. The only outbound request is to Gemini, with your key.

## Supported platforms

| Platform | Status |
|---|---|
| Netflix | Native tracks (TTML/WebVTT) |
| YouTube | Native + auto captions |
| HBO Max (`max.com`) | Best-effort — reads the DRM-wrapped DASH manifest; may need calibration |

## Install (from source)

> Requires [Node.js](https://nodejs.org/) 18+.

```bash
git clone https://github.com/vi000246/twosub.git
cd twosub
npm install
```

**Run in dev (auto-loads a browser):**
```bash
npm run dev          # Chromium / Chrome
npm run dev:firefox  # Firefox
```

**Or build + load unpacked:**
```bash
npm run build            # → .output/chrome-mv3
npm run build:firefox    # → .output/firefox-mv2
```
- **Brave / Chrome:** `brave://extensions` → enable *Developer mode* → *Load unpacked* → `.output/chrome-mv3`
- **Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → `.output/firefox-mv2/manifest.json`

## Set your Gemini API key

1. Get a free key at [aistudio.google.com](https://aistudio.google.com/app/apikey).
2. Open the extension's **options** (toolbar icon → *Open settings*), paste the key, pick a model (default `gemini-2.5-flash`).

A key is only needed when a title has **no native Chinese track** (for AI translation) and for **word lookup**. Native dual-subtitle titles work without one.

## Usage

- Play a title on Netflix / YouTube / HBO Max → dual subtitles appear.
- Tune size / opacity / color / position in **options** (applies live).
- **Pause**, then **hover** an English word for its meaning, or **click** it for meaning + pronunciation.
- Toggle platforms or turn everything off from the **popup**.

## How it works

```
streaming page (MAIN world)  ──►  per-platform sniffer  ──CustomEvent──►  content script
  (Netflix timedtext / YouTube                                              (overlay + sync +
   captionTracks / HBO DASH manifest)                                        word interaction)
                                                                                   │ runtime msg
                                                                                   ▼
                                                          background service worker  ──►  Gemini
                                                          (translate / word lookup, cached;          (your key)
                                                           your key never leaves the background)
```

- A small **page-context "sniffer"** per platform reads the player's native subtitle tracks (Netflix `timedtexttracks`, YouTube `captionTracks`, HBO Max DASH MPD), normalizes them to timed cues, and hands them to the content script.
- A **Shadow-DOM overlay** renders the two lines (the English line tokenized into per-word spans), hiding the native subtitles.
- The **background service worker** holds the Gemini key and does all translation / word lookup, with caching — the key is never exposed to the page.

## Development

```bash
npm run dev / dev:firefox   # dev with HMR
npm test                    # unit tests (Vitest)
npm run compile             # type-check (wxt prepare && tsc --noEmit)
npm run build / build:firefox
npm run lint                # ESLint
npm run format              # Prettier
```

Product docs (PRD / SRS / plans / reports) live in [`docs/`](./docs).

```
entrypoints/   background, content scripts, MAIN-world sniffers, options + popup (React)
src/
  capture/     per-platform sniffer logic + parsers (WebVTT / TTML / json3 / DASH)
  background/  Gemini provider, translation orchestrator, word lookup
  overlay/     Shadow-DOM overlay, sync engine, styling, TTS
  core/        settings (storage), typed messaging, LRU cache
  types/       shared contracts
```

## Status

| Milestone | State |
|---|---|
| M1 — Netflix/YouTube dual subs + customization | ✅ code-complete |
| M2 — Word lookup + pronunciation | ✅ code-complete |
| M3 — HBO Max (DASH, best-effort) | ✅ code-complete |
| M4 — Cross-browser hardening + release | 🚧 in progress |

44 unit tests · type-clean · builds for Chromium + Firefox.

## Privacy

No analytics, no telemetry, no remote logging. Subtitle text and clicked words are sent **only** to the Gemini API using **your** key; your key is stored in the browser's local extension storage and is never placed in the page.

## License

[MIT](./LICENSE)

## Acknowledgements

Inspired by [InterSub](https://intersub.cc/) and [Lingosive](https://www.lingosive.com/) — independent project, not affiliated with either, nor with Netflix, YouTube, or HBO Max.
