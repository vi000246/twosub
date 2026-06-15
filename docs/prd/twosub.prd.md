---
linear_issue: null
---
# TwoSub — Bilingual Subtitles + Instant Word Learning

## Problem Statement

Logan is learning English and watches Netflix, YouTube, and HBO Max daily, but the existing dual-subtitle + word-learning extensions he relies on (InterSub, Lingosive) gate the *actually useful* learning features behind paid tiers and per-month quotas, don't let him use his own AI key, and don't give him one tool that runs exactly his platforms and languages across **both** Firefox and Brave. The cost of not solving this is a daily, recurring friction: he hits a quota wall mid-show, juggles two extensions, and can't tune the learning loop to how he actually studies.

## Evidence

- **InterSub free tier caps dictionary lookups** (the learning feature) at ~15/month; unlimited lookup, AI subtitles, and the vocabulary book are Premium (~$1.50/mo). *(User research notes [1][4][6].)*
- **Lingosive** positions itself as *"YouTube & Netflix & HBO Immersive AI **Dual Subtitles**"* and pushes "AI tools" + a LanguageLab learning web app — i.e. the learning depth is the upsell. *(Confirmed from the installed extension's own store name/description, v1.5.11.)*
- **Both reference tools are installed and in active use** on this machine (InterSub 4.46.0 in Firefox *and* Brave, last-updated 2026-05; `lingosive.com` IndexedDB present in Brave + Chrome) → the user already depends on this category every day, so the problem is real and recurring, not hypothetical.
- **Direct user requirements**: English on top (learning language), Chinese below; bring-your-own **Gemini** key; exactly Netflix + YouTube + HBO Max; Firefox + Brave; adjustable size/opacity/color/position; instant word translation **and** pronunciation; native subtitle when available, AI translation when not.

## Proposed Solution

An **open-source Manifest V3 browser extension (Firefox + Brave)** that overlays **dual subtitles** — **English on top, Chinese below** — on Netflix, YouTube, and HBO Max. The Chinese line uses the title's **native/official subtitle track when one exists**, and falls back to **Gemini** machine translation of the English when it doesn't. The user **pastes their own Gemini API key** (the repo is public, so no shared key ships). Subtitle appearance (font size, background opacity, color, on-screen position) is fully adjustable, and the translation provider is a **pluggable abstraction with Gemini implemented first**. A lightweight **English-learning layer** lets the user, **while paused**, hover or click an English word to get an instant **Chinese translation + audio pronunciation (TTS)** — no save, no quota.

We reuse the **proven architecture** already validated by InterSub: a per-platform content-script injector loads a page-context "sniffer" that intercepts the player's network calls (`XHR`/`fetch`) and the DASH/HLS manifest to read native WebVTT/TTML caption tracks — the same approach that makes HBO Max possible despite DRM.

## Key Hypothesis

We believe a **self-owned, bring-your-own-Gemini-key dual-subtitle extension with instant word lookup** will remove the paywall/quota friction Logan hits today and give him a daily English-learning-while-watching loop tuned to his own platforms and languages.
We'll know we're right when **Logan uses TwoSub as his default across all three platforms for several weeks without falling back to InterSub/Lingosive and without ever hitting a usage limit.**

## What We're NOT Building (v1)

- **Saved vocabulary book / spaced-repetition review** — deferred; v1 validates the instant-lookup loop first *(decision Q4)*.
- **App-store distribution** (Firefox AMO / Chrome Web Store), privacy policy, store listing — out of scope; self-install only *(decision Q1)*.
- **Platforms beyond Netflix / YouTube / HBO Max** (Prime, Disney+, Crunchyroll, etc.) — later.
- **Languages beyond English ↔ Chinese** — architecture shouldn't hard-block other pairs, but only EN↔ZH is built/validated in v1.
- **Providers other than Gemini fully implemented** — the provider layer is pluggable, but only Gemini ships in v1.
- **Cloud sync of settings / multi-device accounts** — local settings only.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Dual subtitles render correctly | ≥ 90% of a manual test set per platform (Netflix/YouTube high-confidence; HBO Max best-effort) | Hand-tested title checklist |
| Native-track-first correctness on HBO Max & Netflix | Uses the official Chinese track when present; AI only when absent | Spot-check titles known to have/lack ZH subs |
| Word-lookup responsiveness | Popup appears < ~600 ms after click (cached translations near-instant) | Manual / console timing |
| Daily-driver adoption | TwoSub is Logan's default tool for ≥ 3 weeks across all 3 platforms | Self-report |
| Cost control | $0 fixed cost; only Logan's pay-as-you-go Gemini usage; no per-lookup wall | By design |

## Open Questions

- [ ] **HBO Max durability** — will manifest-sniffing survive HBO's ongoing rebrands / DRM changes (the platform broke other extensions repeatedly in 2023–2025)? Must be tested live and treated as fragile.
- [ ] **Gemini real-time latency/cost** — line-by-line translation during fast dialogue may need batching + a translation cache to stay responsive and cheap. (SRS to specify.)
- [ ] **Pronunciation quality** — is the browser's built-in Web Speech TTS voice good enough for English words, or do we need a dictionary-audio source as a later upgrade?
- [ ] **Per-word interaction** — hover/click lookup requires the overlay to render subtitles as **per-word selectable tokens**; confirm the rendering approach supports this on all three players.
- [ ] **Brave specifics** — Brave Shields / CSP differences vs vanilla Chromium need testing (Brave is Chromium-based, so the Chrome MV3 build should apply).

---

## Users & Context

**Primary User**
- **Who**: Logan — an intermediate English learner and a technical user (comfortable self-installing an unpacked extension and managing his own Gemini API key).
- **Current behavior**: Watches Netflix/YouTube/HBO Max daily, currently using InterSub + Lingosive, hitting free-tier word-lookup quotas and paywalled AI features.
- **Trigger**: Sits down to watch a show and wants to *both* enjoy it *and* pick up vocabulary — without a paywall interrupting him or having to switch tools.
- **Success state**: Watches with EN/ZH dual subtitles; pauses and taps an unknown English word for instant meaning + pronunciation; never hits a limit; same experience in Firefox and Brave.

**Job to Be Done**
When I sit down to watch Netflix / YouTube / HBO Max in English, I want bilingual subtitles plus instant word meaning and pronunciation, so I can enjoy the show and improve my English without paywalls or quota limits.

**Non-Users**
Non-technical users who need a one-click store install with zero setup (BYO-key + unpacked install excludes them); anyone wanting language pairs other than English↔Chinese in v1.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Dual-subtitle overlay (English top / Chinese bottom) on **Netflix, YouTube, HBO Max** | The core value |
| Must | **Native second-language track when available; Gemini AI translation fallback** | Content quality + directly answers the HBO requirement |
| Must | **Bring-your-own Gemini API key** in settings | Enables translation/lookup; public repo can't ship a key |
| Must | Appearance customization: **font size, background opacity, color, position** | Explicit user requirement |
| Must | **On-the-spot word lookup**: hover-while-paused / click an English word → Chinese translation + **TTS pronunciation** | The learning loop |
| Must | Works in **Firefox + Brave** (MV3) | Explicit user requirement |
| Should | **Pluggable provider abstraction** (Gemini first, others later) | Future-proofing, explicit user wish |
| Should | Per-platform enable/disable + quick on/off toggle | Usability |
| Should | **Translation caching** | Cuts Gemini cost + latency for repeated/real-time lines |
| Could | Choose which language sits on top / pairs beyond EN↔ZH | Flexibility |
| Could | Keyboard shortcuts (toggle subs, replay current line) | Power use |
| Won't (v1) | Saved vocabulary book / spaced-repetition review | Deferred (Q4) |
| Won't (v1) | App-store publishing | Deferred (Q1) |
| Won't (v1) | Prime / Disney+ / Crunchyroll and other platforms | Later |

### MVP Scope

All **three platforms** ship together in v1 *(decision Q2)*: dual subtitles with native-track-first + Gemini fallback, full appearance customization, BYO Gemini key, and the on-the-spot word-lookup + pronunciation loop. **HBO Max is included but explicitly best-effort / fragile** — per the user's own research, any HBO Max dual-subtitle support must be treated as "works but brittle, verify live."

### User Flow

Install unpacked (Firefox `about:debugging` / Brave load-unpacked) → open settings, **paste Gemini API key**, set appearance (size / opacity / color / position) and language pair → open a title on Netflix / YouTube / HBO Max → **dual subtitles appear** (EN top, ZH bottom; native ZH track if present, else Gemini) → **pause**, hover or click an unknown English word → popup shows **Chinese meaning + a speaker icon** → click the speaker to **hear the pronunciation** → resume.

---

## Feasibility

**Verdict**: **MEDIUM** — Netflix + YouTube are **HIGH** confidence (open WebVTT/TTML and timedtext caption tracks; proven by InterSub *and* Lingosive). **HBO Max is the MEDIUM/fragile component** (DRM-wrapped DASH, CSP/CORS, a history of breaking extensions across the Max↔HBO Max rebrands) — feasible via manifest-sniffing exactly as InterSub does today, but brittle and must be tested live. Cross-browser MV3 (Firefox + Brave/Chromium) is well-trodden.

> Architecture (per-platform sniffer design, overlay rendering, Gemini integration, caching, settings storage), data model, API contracts, technology choices, and detailed technical risks belong in the SRS. Run `/prp-srs docs/prd/twosub.prd.md` to produce that next.

---

## Product Milestones

> All four milestones constitute the **single v1 release** (per the "all three platforms together" decision). They are sequenced to retire risk in order — friendly platforms and the core loop first, fragile HBO Max once the engine is solid — not staged as separate public releases.

| # | Milestone | User-Visible Value | Status | Depends | SRS | Plan |
|---|-----------|--------------------|--------|---------|-----|------|
| 1 | Core dual-sub engine + customization (Netflix + YouTube) | Bilingual subtitles (EN top / ZH bottom) on Netflix & YouTube, with native-track-first + Gemini fallback, and adjustable size/opacity/color/position | in-progress | - | `docs/srs/twosub-dual-subtitle-mvp.srs.md` | `docs/plans/twosub-m1-foundation-dual-subtitles.plan.md` |
| 2 | Instant word lookup + pronunciation | While paused, hover/click an English word → Chinese meaning + audio pronunciation | pending | 1 | - | - |
| 3 | HBO Max support | Same dual-subtitle experience on HBO Max (native track via manifest sniff, Gemini fallback) — best-effort | pending | 1 | - | - |
| 4 | Cross-browser hardening + open-source release | Verified Firefox + Brave parity; README/setup; pushed to a public GitHub repo | pending | 1,2,3 | - | - |

### Milestone Details

**Milestone 1: Core dual-sub engine + customization (Netflix + YouTube)**
- **User can now**: Watch Netflix & YouTube with English-on-top / Chinese-below subtitles, styled exactly how he wants, using his own Gemini key (native ZH track when the title has one, Gemini translation when it doesn't).
- **Success signal**: Dual subs render correctly on ≥90% of a Netflix/YouTube test set; appearance controls visibly work.
- **Out of scope for this milestone**: Word lookup, HBO Max.

**Milestone 2: Instant word lookup + pronunciation**
- **User can now**: Pause and tap/hover any English word to instantly see its Chinese meaning and hear it pronounced.
- **Success signal**: Lookup popup < ~600 ms; pronunciation audible; no quota wall.
- **Out of scope for this milestone**: Saving words, review scheduling.

**Milestone 3: HBO Max support**
- **User can now**: Get the same dual-subtitle experience on HBO Max (native track first, Gemini fallback).
- **Success signal**: Works on current HBO Max titles in live testing; degrades gracefully (AI fallback) when native ZH is absent.
- **Out of scope for this milestone**: Guaranteeing durability across future HBO rebrands (tracked as a known risk).

**Milestone 4: Cross-browser hardening + open-source release**
- **User can now**: Install and run the same build on both Firefox and Brave; the project lives on public GitHub with setup docs.
- **Success signal**: Feature parity confirmed on both browsers; repo pushed with a working README + Gemini-key setup guide.
- **Out of scope for this milestone**: Store submission.

> Technical phases/parallelism live in the SRS; implementation tasks live in the Plan. This PRD only sequences product value.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Distribution | Personal + **public GitHub**, no store | Private-only; publish to AMO/Web Store | Matches "push to GitHub"; lowest scope/risk; no store-review/privacy overhead *(Q1)* |
| Platforms in v1 | **All three** (Netflix, YouTube, HBO Max) | Phase friendly-first | User decision *(Q2)* |
| Chinese line source | **Native track first, Gemini AI fallback** | Always AI-translate | Official translation quality; matches "沒提供才用 AI" *(Q3)* |
| "原聲音軌" clarification | It means **subtitle-track availability**, not audio | — | If no native Chinese **subtitle** track exists, AI-translate the English; HBO audio is irrelevant to the dual-sub line |
| Learning depth v1 | **On-the-spot lookup only** (translate + TTS) | + vocab book; full SRS review | Smallest MVP to validate the learning loop *(Q4)* |
| Gemini key handling | **Bring-your-own key** in settings | Bundle a shared key; self-hosted proxy | Public repo can't ship a key; no server to operate (assumption, user did not object) |
| Pronunciation source | **Browser Web Speech TTS** (v1) | Dictionary audio; cloud TTS | Free, no extra key; upgrade later if voice quality is insufficient (assumption) |
| Subtitle capture approach | Reuse **InterSub-style per-platform manifest/caption sniffing** | Build from scratch | Proven, and full InterSub source is available locally as reference |

---

## Research Summary

**Market Context**
- Crowded category: Trancy, Language Reactor, **InterSub**, **Lingosive**, Read Frog (the last three are installed on this machine). All offer dual subtitles + word learning; the *learning depth* (unlimited lookup, AI subs, vocab/SRS) is consistently the paid upsell.
- **Differentiation for a personal build**: open-source, **bring-your-own Gemini key** (no subscription, no per-query quota), exactly the user's platforms/languages, identical on Firefox + Brave.

**Technical Context** (from local source analysis)
- **InterSub 4.46.0** (Firefox `acc@intersub.cc.xpi`; same build in Brave): MV3; per-platform **subtitle sniffers** — a content-script injector loads a page-context script that monkey-patches `XMLHttpRequest`/`fetch`/`DOMParser`. **HBO Max**: intercepts `/playback/v1/playbackInfo`, parses the **DASH MPD**, and extracts **native WebVTT tracks** per language (prefers SDH/full over forced/CC) → it reads native tracks when present; AI translation is the *fallback*. Dedicated sniffers for Netflix, Prime, Crunchyroll, bilibili, etc.; **YouTube** uses YouTube's own open caption system (no sniffer needed — the friendliest platform). Logs telemetry to an InterSub log server (we will **not** replicate telemetry).
- **Lingosive 1.5.11** (Chrome `cdkjlj…`, *"Immersive AI Dual Subtitles"*): MV3; React/TSX content scripts per platform (`HboContent` matches `play.max.com` + `play.hbomax.com`), plus a generic web translator and a "LanguageLab" learning web app. Confirms the AI-dual-subtitle + word-learning product shape.
- **Read Frog 1.34.1** (open-source "Translate & Learn", also installed): a useful **open-source reference for the learning UX**.
- **Implication**: the architecture the user wants is proven and locally documented; HBO Max is the only fragile piece and is gated behind native-track-first + AI fallback.

---

*Generated: 2026-06-15*
*Status: DRAFT - needs validation*
*Source Linear Issue: N/A — standalone*
