---
linear_issue: null
---
# Plan: TwoSub M1 — Foundation + Netflix/YouTube Dual Subtitles + Customization

> **For agentic workers:** `/prp-implement` routes by `Metadata.Type` (feature → `implementing-features`). Mode B = each task writes a locking test first, implements, runs green, commits. Steps use `- [ ]`.

## Summary
Stand up the entire TwoSub extension skeleton (WXT + TS + React, MV3, Firefox + Chromium/Brave) and deliver the first runnable slice: **dual subtitles (English top / Chinese bottom) on Netflix and YouTube**, native-track-first with **Gemini** fallback, a **bring-your-own Gemini key**, and full appearance customization (size / opacity / color / position). Word lookup (M2), HBO Max (M3), and cross-browser hardening + GitHub release (M4) are explicitly out of scope here but their seams are built in.

## User Story
As an English learner watching Netflix/YouTube, I want bilingual subtitles I can style, so I can study while I watch without paywalls or quotas.

## Problem → Solution
Empty repo, no extension → a working MV3 extension that overlays customizable EN/ZH dual subtitles on Netflix + YouTube using native tracks (or Gemini when no native Chinese track exists), keyed by the user's own Gemini key.

## Metadata
- **Module**: twosub
- **Parent Plan**: N/A
- **Source PRD**: `docs/prd/twosub.prd.md`
- **Source Feature SRS**: `docs/srs/twosub-dual-subtitle-mvp.srs.md`
- **Source Module Spec**: `docs/spec/twosub.spec.md`
- **Source Linear Issue**: N/A
- **Type**: feature
- **Size**: L
- **Complexity**: Large
- **Rigor**: balanced
- **Mode**: B — 任務先測
- **TDD**: on (task-level; pure logic unit-tested, browser/DRM parts manual/E2E)
- **Commit cadence**: per-task
- **Estimated Files**: ~30

---

## UX Design

### Before
```
┌─────────────────────────────────────┐
│  Netflix / YouTube player            │
│                                      │
│        (single native subtitle)      │
│        I'll call you tomorrow        │
└─────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────┐
│  Netflix / YouTube player            │
│                                      │
│        I'll  call  you  tomorrow     │  ← English (learning), tokenized spans
│        我明天會打給你                  │  ← Chinese (native track or Gemini)
└─────────────────────────────────────┘
   ▸ size / opacity / color / position all user-adjustable (live)
   ▸ popup: global on/off + per-platform toggles + "Open settings"
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Subtitle area | One native line | Two lines, EN top / ZH bottom | Native subs hidden; our Shadow-DOM overlay |
| Toolbar popup | — | Global + per-platform toggle, status | Quick enable/disable |
| Options page | — | Key, model, appearance, languages, platforms | Persisted to `storage.local` |
| Word spans | Plain text | Rendered as per-word `<span>` | Hover/click wired in **M2**, not here |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `docs/srs/twosub-dual-subtitle-mvp.srs.md` | all | FRs + the 12 acceptance criteria this plan must satisfy (M1 covers AC-1,2,3,5,9,10,11 partially; AC-6,7,8 are M2) |
| P0 | `docs/spec/twosub.spec.md` | all | Architecture, component contracts, data model, API contracts, decisions |
| P1 | `docs/prd/twosub.prd.md` | "Product Milestones" | M1 scope boundary |
| P2 (reference) | `/tmp/twosub-ref/intersub/hbo-max-subtitle-sniffer-injector.js` | all | Proven MAIN-world injector idiom (reimplement, don't copy) |
| P2 (reference) | `/tmp/twosub-ref/intersub/netflix-subtitle-sniffer.js` | skim | How Netflix `timedtexttracks` capture works |

> The reference XPI is unpacked at `/tmp/twosub-ref/intersub/` (may be cleared — all patterns needed are inlined below, so no dependency at implement time).

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| WXT framework | https://wxt.dev/ | `defineBackground` / `defineContentScript` / `defineUnlistedScript`; `injectScript()` for MAIN-world; `storage` API; builds Firefox + Chrome from one codebase; Vitest via `WxtVitest` plugin |
| WXT MAIN-world injection | https://wxt.dev/guide/essentials/scripting.html | Use `injectScript('/sniffer.js', {keepInDom:true})` from an ISOLATED content script to run code in the page's MAIN world (portable across Firefox/Chrome) |
| Gemini generateContent | https://ai.google.dev/gemini-api/docs | `POST .../v1beta/models/{model}:generateContent`, header `x-goog-api-key`; `generationConfig.responseMimeType:"application/json"` for structured output; default model `gemini-2.5-flash` |
| Netflix timedtext | InterSub `netflix-subtitle-sniffer.js` (analyzed) | Player manifest carries `timedtexttracks[]` with downloadable WebVTT (`webvtt-lssdh-*`) or DFXP/TTML URLs per language |
| YouTube captions | YouTube `ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks[]` | Each has `baseUrl` + `languageCode`; append `&fmt=json3` for JSON cues; `&tlang=zh-TW` for YT auto-translate |

```
KEY_INSIGHT: WXT's injectScript runs a web-accessible script in the page MAIN world — the
             portable equivalent of InterSub's manual <script src=runtime.getURL> injector.
APPLIES_TO: Task 8 (injector), Task 9/10 (sniffers).
GOTCHA: The injected script runs in the PAGE world (no extension APIs). It must talk to the
        content script via window CustomEvents only — never import extension modules.

KEY_INSIGHT: Background fetch to Gemini needs host permission for generativelanguage.googleapis.com.
APPLIES_TO: Task 1 manifest, Task 4 GeminiProvider.
GOTCHA: Subtitle-track fetches happen in the PAGE (sniffer) using the page's own origin — no
        extra host permission needed for netflix/youtube track URLs. Only Gemini needs a host perm.
        → Resolves SRS open question: use specific host_permissions, NOT <all_urls>.
```

---

## Patterns to Mirror

Greenfield — these snippets **establish** the conventions. Follow them exactly across tasks.

### PROJECT_STRUCTURE
```
twosub/
  wxt.config.ts            # manifest + build config
  package.json             # scripts: dev, dev:firefox, build, build:firefox, compile, test
  tsconfig.json
  entrypoints/
    background.ts          # defineBackground → registers message handlers
    netflix.content.ts     # defineContentScript matches *.netflix.com → injects sniffer, mounts overlay
    youtube.content.ts     # defineContentScript matches *.youtube.com
    netflix-sniffer.ts     # defineUnlistedScript (MAIN world, injected) — built to /netflix-sniffer.js
    youtube-sniffer.ts     # defineUnlistedScript
    options/{index.html,main.tsx,App.tsx}
    popup/{index.html,main.tsx,App.tsx}
  src/
    types/{messages.ts,cue.ts,settings.ts}
    core/{settings.ts,messaging.ts,lru.ts}
    background/{orchestrator.ts, provider/{provider.ts,gemini.ts}}
    capture/{adapter.ts, parsers/{webvtt.ts,ttml.ts,ytjson3.ts}}
    overlay/{overlay.ts,sync.ts,style.ts}
    sniff/{events.ts}      # shared CustomEvent name + payload types (page↔content)
```

### TYPES  (src/types/cue.ts, settings.ts)
```ts
// cue.ts
export interface Cue { id: string; startMs: number; endMs: number; text: string; lang: string }
export interface TrackMeta { lang: string; kind: 'native' | 'cc' | 'forced'; url?: string }
export type Platform = 'netflix' | 'youtube' | 'hboMax';

// settings.ts  (mirror docs/spec/twosub.spec.md › Data Model exactly)
export const SCHEMA_VERSION = 1;
export interface Settings {
  enabled: boolean;
  platforms: Record<Platform, boolean>;
  languages: { learning: 'en'; native: 'zh'; learningOnTop: boolean };
  appearance: { fontSizePx: number; bgOpacity: number; textColor: string; position: 'bottom'|'top'|'custom'; offsetY: number };
  provider: { name: 'gemini'; apiKey: string; model: string };
  lookup: { source: 'gemini'; ttsEnabled: boolean; ttsRate: number }; // populated now, used in M2
}
export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  platforms: { netflix: true, youtube: true, hboMax: false },
  languages: { learning: 'en', native: 'zh', learningOnTop: true },
  appearance: { fontSizePx: 26, bgOpacity: 0.55, textColor: '#ffffff', position: 'bottom', offsetY: 0 },
  provider: { name: 'gemini', apiKey: '', model: 'gemini-2.5-flash' },
  lookup: { source: 'gemini', ttsEnabled: true, ttsRate: 0.9 },
};
```

### MESSAGE_ENVELOPE  (src/types/messages.ts + src/core/messaging.ts)
```ts
// messages.ts — content ↔ background contract (mirror SRS › API Contracts)
export type Msg =
  | { v: 1; type: 'TRANSLATE_CUES'; payload: { cues: { id: string; text: string }[]; src: 'en'; tgt: 'zh' } }
  | { v: 1; type: 'LOOKUP_WORD';    payload: { word: string; sentence: string; src: 'en'; tgt: 'zh' } } // M2
  | { v: 1; type: 'GET_SETTINGS';   payload: Record<string, never> };
export type MsgResult = {
  TRANSLATE_CUES: { translations: { id: string; text: string }[] };
  LOOKUP_WORD: { meaning: string; lemma?: string; pos?: string };
  GET_SETTINGS: import('./settings').Settings;
};

// messaging.ts — typed wrappers over browser.runtime
import { browser } from 'wxt/browser';
export function sendMsg<T extends Msg['type']>(type: T, payload: Extract<Msg,{type:T}>['payload']): Promise<MsgResult[T]> {
  return browser.runtime.sendMessage({ v: 1, type, payload });
}
export function onMsg(handler: (m: Msg) => Promise<unknown> | unknown) {
  browser.runtime.onMessage.addListener((m: Msg) => Promise.resolve(handler(m)));
}
```

### SNIFF_EVENTS  (src/sniff/events.ts — page ↔ content, MAIN-world safe; NO extension imports)
```ts
export const CUES_EVENT = 'twosub:cues';
export const CMD_EVENT  = 'twosub:command';
export interface CuesDetail { platform: string; tracks: { lang: string; kind: string }[]; cues: import('../types/cue').Cue[] }
```

### INJECTOR  (src/capture/inject.ts) — reimplements InterSub's idiom via WXT
```ts
// Called from an ISOLATED content script. Runs the built sniffer in the page MAIN world.
import { injectScript } from 'wxt/utils/inject-script';
export async function injectSniffer(path: `/${string}.js`) {
  await injectScript(path, { keepInDom: true });
}
// Reference idiom (InterSub hbo-max-subtitle-sniffer-injector.js): de-dupe via a data-ref marker,
// append <script src=runtime.getURL(path)> to document.documentElement at document_start.
```

### SNIFFER_MONKEYPATCH  (entrypoints/*-sniffer.ts — runs in PAGE MAIN world)
```ts
// Generic shape: patch fetch/XHR/JSON to capture the player's subtitle manifest, then emit cues.
// MUST NOT import extension APIs. Communicates ONLY via window CustomEvent(CUES_EVENT).
export default defineUnlistedScript(() => {
  const origFetch = window.fetch;
  window.fetch = async (input, init) => {
    const res = await origFetch(input, init);
    try { maybeCaptureFromUrl(String((input as Request).url ?? input), res.clone()); } catch {}
    return res;
  };
  // ...XHR patch (open/send + load listener) mirroring InterSub netflix/hbo sniffers...
  function emit(detail: unknown) { window.dispatchEvent(new CustomEvent('twosub:cues', { detail })); }
});
```

### GEMINI_CALL  (src/background/provider/gemini.ts)
```ts
const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
async function call(model: string, key: string, prompt: string) {
  const r = await fetch(ENDPOINT(model), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
  });
  if (r.status === 429) throw new ProviderError('PROVIDER_RATE_LIMITED');
  if (!r.ok) throw new ProviderError('PROVIDER_ERROR', await r.text());
  const j = await r.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
```

### WXT_BACKGROUND / STORAGE
```ts
// entrypoints/background.ts
export default defineBackground(() => { registerHandlers(); });
// src/core/settings.ts — use WXT storage item
import { storage } from 'wxt/utils/storage';
export const settingsItem = storage.defineItem<Settings>('local:settings', { fallback: DEFAULT_SETTINGS });
```

### TEST_STRUCTURE  (Vitest; colocated `*.test.ts`)
```ts
import { describe, it, expect } from 'vitest';
import { parseWebVtt } from './webvtt';
describe('parseWebVtt', () => {
  it('parses cues with ms timings', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nHello world\n';
    expect(parseWebVtt(vtt, 'en')).toEqual([
      { id: expect.any(String), startMs: 1000, endMs: 2500, text: 'Hello world', lang: 'en' },
    ]);
  });
});
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `package.json`, `wxt.config.ts`, `tsconfig.json`, `.gitignore` | CREATE | WXT scaffold + scripts + manifest |
| `src/types/{cue,settings,messages}.ts` | CREATE | Shared contracts |
| `src/sniff/events.ts` | CREATE | Page↔content event contract |
| `src/core/{settings,messaging,lru}.ts` | CREATE | Storage, typed messaging, cache |
| `src/background/provider/{provider,gemini}.ts` | CREATE | Provider interface + Gemini impl |
| `src/background/orchestrator.ts` | CREATE | native-vs-AI + batch + cache + message handler |
| `entrypoints/background.ts` | CREATE | Register handlers |
| `src/capture/parsers/{webvtt,ttml,ytjson3}.ts` | CREATE | Track text → Cue[] |
| `src/capture/{inject,adapter}.ts` | CREATE | Injector + normalize/track-select |
| `entrypoints/{netflix,youtube}-sniffer.ts` | CREATE | MAIN-world capture |
| `entrypoints/{netflix,youtube}.content.ts` | CREATE | Content entry: inject + mount overlay |
| `src/overlay/{overlay,sync,style}.ts` | CREATE | Shadow-DOM render, sync engine, settings→CSS |
| `entrypoints/options/*`, `entrypoints/popup/*` | CREATE | React settings + toggle UI |
| `tests/fixtures/*` | CREATE | WebVTT/TTML/json3 samples |

## NOT Building (M1)
- Word hover/click lookup, `LOOKUP_WORD` handler, the word popup, and TTS playback → **M2** (types/seams are present but inert).
- HBO Max sniffer / DASH-manifest parsing → **M3**.
- Cross-browser hardening matrix, README, packaging, GitHub push → **M4**.
- Languages other than EN↔ZH; providers other than Gemini.

---

## Step-by-Step Tasks  (Mode B — task-first test, per-task commit)

### Task 1: Scaffold WXT + React + TS project
- **ACTION**: Initialize a WXT project with the React module; add scripts; configure manifest in `wxt.config.ts`.
- **TEST FIRST**: N/A (scaffold) — the validation is a green build.
- **IMPLEMENT**:
  - `pnpm dlx wxt@latest init . --template react-ts` (or manual). Ensure `package.json` scripts:
    ```jsonc
    { "scripts": {
      "dev": "wxt", "dev:firefox": "wxt -b firefox",
      "build": "wxt build", "build:firefox": "wxt build -b firefox",
      "compile": "wxt prepare && tsc --noEmit", "test": "vitest run"
    }}
    ```
  - `wxt.config.ts` manifest (M1 host scope — NOT `<all_urls>`):
    ```ts
    export default defineConfig({
      modules: ['@wxt-dev/module-react'],
      manifest: {
        name: 'TwoSub', version: '0.1.0',
        permissions: ['storage'],
        host_permissions: [
          'https://generativelanguage.googleapis.com/*',
          '*://*.netflix.com/*', '*://*.youtube.com/*',
        ],
        web_accessible_resources: [
          { resources: ['netflix-sniffer.js','youtube-sniffer.js'], matches: ['*://*.netflix.com/*','*://*.youtube.com/*'] },
        ],
      },
    });
    ```
  - `git init` (this project is destined for GitHub); add WXT's `.gitignore` (`.wxt/`, `.output/`, `node_modules/`).
  - Add Vitest: `vitest.config.ts` using `WxtVitest` plugin.
- **MIRROR**: PROJECT_STRUCTURE.
- **GOTCHA**: `pnpm install` / `wxt init` need network + may hit the install permission gate — expect to approve once.
- **VALIDATE**: `pnpm compile` (zero errors) and `pnpm build && pnpm build:firefox` both succeed (empty extension OK).
- **COMMIT**: `chore: scaffold WXT + React + TS extension (MV3, FF+Chromium)`

### Task 2: Shared types + typed messaging
- **ACTION**: Create `src/types/{cue,settings,messages}.ts`, `src/sniff/events.ts`, `src/core/messaging.ts`.
- **TEST FIRST** (`src/core/messaging.test.ts`):
  ```ts
  import { describe, it, expect, vi } from 'vitest';
  // mock wxt/browser runtime.sendMessage to echo; assert sendMsg wraps {v,type,payload}
  it('wraps messages in the v1 envelope', async () => {
    const sent: any[] = [];
    vi.stubGlobal('browser', { runtime: { sendMessage: (m:any)=>{ sent.push(m); return Promise.resolve({translations:[]}); } } });
    const { sendMsg } = await import('./messaging');
    await sendMsg('TRANSLATE_CUES', { cues: [{id:'1',text:'hi'}], src:'en', tgt:'zh' });
    expect(sent[0]).toMatchObject({ v: 1, type: 'TRANSLATE_CUES' });
  });
  ```
  Run `pnpm test` → FAIL (module missing).
- **IMPLEMENT**: Exactly the TYPES, MESSAGE_ENVELOPE, SNIFF_EVENTS snippets above.
- **MIRROR**: TYPES, MESSAGE_ENVELOPE.
- **VALIDATE**: `pnpm test` PASS; `pnpm compile` clean.
- **COMMIT**: `feat: shared Cue/Settings/Msg types + typed runtime messaging`

### Task 3: Settings store (defaults + versioned migration)
- **ACTION**: `src/core/settings.ts` — WXT storage item, `getSettings`, `setSettings`, `migrate`, change subscription.
- **TEST FIRST** (`settings.test.ts`):
  ```ts
  it('returns defaults when empty', async () => { /* stub storage empty */ expect((await getSettings()).provider.model).toBe('gemini-2.5-flash'); });
  it('migrates a v0 record by filling new fields', async () => {
    const v0 = { schemaVersion: 0, settings: { enabled: false } } as any;
    expect(migrate(v0).settings.appearance.fontSizePx).toBe(26); // default backfilled
    expect(migrate(v0).settings.enabled).toBe(false);            // preserved
  });
  ```
  Run → FAIL.
- **IMPLEMENT**: `settingsItem` (WXT_BACKGROUND snippet); `migrate(raw)` merges `DEFAULT_SETTINGS` under stored values keyed by `schemaVersion`; `watchSettings(cb)` via `settingsItem.watch`.
- **MIRROR**: WXT_BACKGROUND/STORAGE; Data Model in Module Spec.
- **GOTCHA**: deep-merge nested objects (appearance/provider) so new fields backfill without wiping user values.
- **VALIDATE**: `pnpm test` PASS.
- **COMMIT**: `feat: versioned settings store with defaults + migration`

### Task 4: Provider interface + GeminiProvider.translateBatch
- **ACTION**: `provider.ts` (interface + `ProviderError`), `gemini.ts` (`translateBatch`, `lookupWord` stub for M2).
- **TEST FIRST** (`gemini.test.ts`): mock `fetch`; assert request shape + JSON parse + error mapping.
  ```ts
  it('maps 429 to PROVIDER_RATE_LIMITED', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 429 }));
    await expect(new GeminiProvider('k','gemini-2.5-flash').translateBatch(['hi'],'en','zh')).rejects.toMatchObject({ code: 'PROVIDER_RATE_LIMITED' });
  });
  it('parses JSON array response into ordered translations', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ candidates:[{content:{parts:[{text:'[{"i":1,"zh":"你好"}]'}]}}] }), { status:200 }));
    expect(await new GeminiProvider('k','m').translateBatch(['hi'],'en','zh')).toEqual(['你好']);
  });
  ```
  Run → FAIL.
- **IMPLEMENT**:
  - `interface TranslationProvider { translateBatch(lines, src, tgt): Promise<string[]>; lookupWord(word, sentence, src, tgt): Promise<{meaning;lemma?;pos?}> }`.
  - `GeminiProvider`: build a numbered prompt ("Translate each line to zh-TW, return JSON array `[{i,zh}]` …"), call `GEMINI_CALL`, parse JSON, sort by `i`, map to lines; on parse failure throw `PROVIDER_ERROR`.
  - `lookupWord`: implement the call but it's unused until M2 (keep tested minimally).
- **MIRROR**: GEMINI_CALL.
- **GOTCHA**: Gemini may wrap JSON in markdown fences — strip ```` ```json ```` fences before `JSON.parse`. If array length ≠ input length, fall back to splitting on newlines.
- **VALIDATE**: `pnpm test` PASS.
- **COMMIT**: `feat: TranslationProvider + GeminiProvider.translateBatch`

### Task 5: LRU cache
- **ACTION**: `src/core/lru.ts` — bounded Map with `get/set`, max-size eviction, key helper `cueKey(text,src,tgt,model)`.
- **TEST FIRST** (`lru.test.ts`): set beyond capacity evicts oldest; get refreshes recency; key is stable.
  Run → FAIL.
- **IMPLEMENT**: classic insertion-order Map LRU (`max` ~2000).
- **VALIDATE**: `pnpm test` PASS.
- **COMMIT**: `feat: bounded LRU cache for translations`

### Task 6: Translation orchestrator + background message handler
- **ACTION**: `src/background/orchestrator.ts` (`registerHandlers`) handling `TRANSLATE_CUES` + `GET_SETTINGS`; wire in `entrypoints/background.ts`.
- **TEST FIRST** (`orchestrator.test.ts`): inject a fake provider; assert (a) cached lines aren't re-requested, (b) only uncached lines go to the provider, (c) results returned in input order, (d) no key → `PROVIDER_NO_KEY` surfaced (not thrown to caller as crash).
  ```ts
  it('only translates uncached lines and preserves order', async () => {
    const calls:string[][]=[]; const fake={translateBatch:(l:string[])=>{calls.push(l);return Promise.resolve(l.map(x=>'zh:'+x));}} as any;
    const orch = makeOrchestrator(fake, /*settings*/{provider:{apiKey:'k',model:'m'}} as any);
    await orch.translate([{id:'1',text:'a'}]); const out = await orch.translate([{id:'1',text:'a'},{id:'2',text:'b'}]);
    expect(calls).toEqual([['a'],['b']]);                    // 'a' served from cache 2nd time
    expect(out).toEqual([{id:'1',text:'zh:a'},{id:'2',text:'zh:b'}]);
  });
  ```
  Run → FAIL.
- **IMPLEMENT**: orchestrator pulls settings (model/key), dedupes via LRU `cueKey`, batches uncached, calls provider, fills cache, returns ordered `{id,text}`. `registerHandlers` maps `onMsg` → orchestrator / settings.
  - **Native-vs-AI note**: the *decision* (use native ZH track vs translate) lives in the **capture adapter** (Task 11) which only calls `TRANSLATE_CUES` when no native ZH track exists. The orchestrator always translates what it's asked. (Documented so AC-2 is traceable.)
- **MIRROR**: MESSAGE_ENVELOPE; Module Spec › Sequence (dual-subtitle render).
- **VALIDATE**: `pnpm test` PASS; load extension, in background console call the handler with a fake message → returns translations (needs a key).
- **COMMIT**: `feat: translation orchestrator (batch+cache) + background handlers`

### Task 7: Subtitle parsers (WebVTT, TTML, YouTube json3)
- **ACTION**: `src/capture/parsers/{webvtt,ttml,ytjson3}.ts` — each `(raw, lang) => Cue[]`.
- **TEST FIRST**: `tests/fixtures/` small samples + colocated tests asserting exact `Cue[]` (timings in ms, text de-tagged).
  - WebVTT: `00:00:01.000 --> 00:00:02.500` → `{startMs:1000,endMs:2500}`.
  - TTML/DFXP: `<p begin="00:00:01" end="00:00:02.5">Hi</p>` → same; handle `begin="1s"` and clock forms.
  - json3: `{events:[{tStartMs:1000,dDurationMs:1500,segs:[{utf8:'Hi'}]}]}` → `{startMs:1000,endMs:2500,text:'Hi'}`.
  Run → FAIL.
- **IMPLEMENT**: three parsers; strip styling tags (`<c>`, `<b>`, `&lrm;`, `\h`), collapse whitespace, drop empty cues, assign stable `id` (hash of `start|text`).
- **MIRROR**: TEST_STRUCTURE.
- **GOTCHA**: WebVTT timestamps may use `,` or `.`; TTML may use tick/frame/clock forms — handle `HH:MM:SS(.ms)` and `Ns` at minimum (document others as M-later).
- **VALIDATE**: `pnpm test` PASS (these are the highest-value unit tests; cover ≥1 edge each).
- **COMMIT**: `feat: WebVTT / TTML / YouTube-json3 subtitle parsers`

### Task 8: MAIN-world injector
- **ACTION**: `src/capture/inject.ts` — `injectSniffer(path)` via WXT `injectScript`.
- **TEST FIRST**: unit-test is thin (WXT util) — assert it calls `injectScript` with the right path (mock the util). Real verification is manual in Task 9.
  Run → FAIL.
- **IMPLEMENT**: INJECTOR snippet.
- **MIRROR**: INJECTOR; reference `/tmp/twosub-ref/intersub/hbo-max-subtitle-sniffer-injector.js`.
- **VALIDATE**: `pnpm test` PASS; manual deferred to Task 9.
- **COMMIT**: `feat: MAIN-world sniffer injector`

### Task 9: Netflix sniffer (MAIN world) — capture native tracks
- **ACTION**: `entrypoints/netflix-sniffer.ts` (`defineUnlistedScript`) — patch `fetch`/`XHR`/`JSON.parse` to capture `timedtexttracks`; fetch the chosen WebVTT/TTML track in-page; parse via Task 7 parsers; `dispatchEvent(CUES_EVENT)`.
- **TEST FIRST**: extract the pure "select track + parse manifest JSON" into a testable `pickTracks(manifestJson)` and unit-test it with a captured Netflix manifest fixture (assert it finds `en` + (maybe) `zh` track URLs). The monkey-patch wiring itself is manual.
  Run → FAIL.
- **IMPLEMENT**: monkey-patch (SNIFFER_MONKEYPATCH); detect Netflix manifest responses; call `pickTracks`; fetch tracks with page `fetch`; emit `{platform:'netflix',tracks,cues}`.
- **MIRROR**: SNIFFER_MONKEYPATCH; `/tmp/twosub-ref/intersub/netflix-subtitle-sniffer.js`.
- **GOTCHA**: emit incrementally as tracks resolve; never block the page's fetch; wrap all hooks in try/catch (a thrown hook breaks Netflix playback).
- **VALIDATE** (manual/E2E — balanced rigor): `pnpm dev`, open a Netflix title, confirm a `twosub:cues` event fires with non-empty `en` cues (DevTools listener). Unit test for `pickTracks` PASS.
- **COMMIT**: `feat: Netflix MAIN-world subtitle sniffer`

### Task 10: YouTube sniffer (MAIN world)
- **ACTION**: `entrypoints/youtube-sniffer.ts` — read `ytInitialPlayerResponse.captions…captionTracks`; fetch `baseUrl&fmt=json3` (and `&tlang=zh-TW` if requesting YT auto-translate); parse json3; emit cues.
- **TEST FIRST**: pure `pickCaptionTracks(playerResponse)` unit-tested with a fixture (finds en baseUrl; detects a native zh track if present).
  Run → FAIL.
- **IMPLEMENT**: read `window.ytInitialPlayerResponse` (and intercept `/youtubei/v1/player` responses for SPA navigations); build track list; fetch json3; emit.
- **MIRROR**: SNIFFER_MONKEYPATCH.
- **GOTCHA**: YouTube is an SPA — re-capture on navigation (`yt-navigate-finish` event / URL change). Auto-captions exist under `kind:'asr'`.
- **VALIDATE** (manual): play a captioned YouTube video → `twosub:cues` fires with en cues. `pickCaptionTracks` test PASS.
- **COMMIT**: `feat: YouTube MAIN-world caption sniffer`

### Task 11: Capture adapter (normalize + native-vs-AI track selection)
- **ACTION**: `src/capture/adapter.ts` — listen for `CUES_EVENT`; choose the learning track (en) and native track (zh if present); decide whether ZH comes from a native track or must be translated; expose `{enCues, zhCues|null, needsTranslation}`.
- **TEST FIRST** (`adapter.test.ts`):
  ```ts
  it('uses native zh track when present, else flags translation', () => {
    expect(selectTracks([{lang:'en'},{lang:'zh'}]).needsTranslation).toBe(false);
    expect(selectTracks([{lang:'en'}]).needsTranslation).toBe(true);
  });
  ```
  Run → FAIL.
- **IMPLEMENT**: `selectTracks(tracks)` + an event subscriber that stores normalized cues into `SessionState` and, when `needsTranslation`, calls `sendMsg('TRANSLATE_CUES', …)` (batched by the sync engine, Task 12).
- **MIRROR**: Module Spec › Decisions (native-first). **This is where AC-2 lives.**
- **VALIDATE**: `pnpm test` PASS.
- **COMMIT**: `feat: capture adapter — native-first track selection`

### Task 12: Sync engine (active cue + prefetch)
- **ACTION**: `src/overlay/sync.ts` — given normalized cues + a `() => video.currentTime` getter, compute the active cue and prefetch translations for the next N cues; expose `onActiveCue(cb)`.
- **TEST FIRST** (`sync.test.ts`):
  ```ts
  it('selects the cue containing the current time', () => {
    const cues=[{id:'1',startMs:0,endMs:1000,text:'a',lang:'en'},{id:'2',startMs:1000,endMs:2000,text:'b',lang:'en'}];
    expect(activeCueAt(cues, 1500)?.id).toBe('2');
    expect(activeCueAt(cues, 2500)).toBeNull();
  });
  ```
  Run → FAIL.
- **IMPLEMENT**: binary-search `activeCueAt`; a `requestAnimationFrame`/`timeupdate` loop calling it; a prefetch window that batches `TRANSLATE_CUES` for upcoming cues.
- **GOTCHA**: keep the hot loop synchronous; translations arrive async and update a `Map<id,zh>` the overlay reads.
- **VALIDATE**: `pnpm test` PASS (pure `activeCueAt`).
- **COMMIT**: `feat: subtitle sync engine with prefetch`

### Task 13: Overlay renderer (Shadow DOM) + settings→CSS
- **ACTION**: `src/overlay/overlay.ts` (Shadow-DOM container, EN tokenized spans on top, ZH below, hide native) + `src/overlay/style.ts` (`settingsToCssVars(appearance)`).
- **TEST FIRST** (`style.test.ts`):
  ```ts
  it('maps appearance to CSS vars', () => {
    expect(settingsToCssVars({fontSizePx:30,bgOpacity:0.5,textColor:'#fff',position:'bottom',offsetY:0}))
      .toMatchObject({ '--ts-font-size':'30px','--ts-bg':'rgba(0,0,0,0.5)','--ts-color':'#fff' });
  });
  ```
  Run → FAIL.
- **IMPLEMENT**: mount a Shadow root over the player; render two lines; tokenize EN into `<span class="ts-w">` per word (interaction wired in M2); apply CSS vars; a rule to hide each platform's native subtitle container (Netflix `.player-timedtext`, YouTube `.ytp-caption-window-container`).
- **MIRROR**: STYLE/TYPES; Module Spec › Components (Overlay).
- **GOTCHA**: re-anchor the overlay on fullscreen + resize; use `position:absolute` within the player element, not the page.
- **VALIDATE**: `pnpm test` PASS (style mapping); manual: overlay shows and restyles live.
- **COMMIT**: `feat: Shadow-DOM dual-subtitle overlay + live styling`

### Task 14: Content-script entry wiring (Netflix + YouTube)
- **ACTION**: `entrypoints/netflix.content.ts` + `entrypoints/youtube.content.ts` — on load, read settings; if enabled for this platform, `injectSniffer` + start adapter + sync + overlay; react to `SETTINGS_CHANGED` and toggles (enable/disable without reload).
- **TEST FIRST**: extract the gate `shouldActivate(settings, platform)` → unit test (global off, or platform off → false). Wiring is manual.
  Run → FAIL.
- **IMPLEMENT**: `defineContentScript({ matches:['*://*.netflix.com/*'], main(){…} })`; mount/unmount overlay on toggle; pass `() => document.querySelector('video')!.currentTime` to sync.
- **GOTCHA**: SPA route changes (both platforms) — re-init on navigation; tear down cleanly to avoid duplicate overlays (the bug InterSub fixed in 4.27).
- **VALIDATE**: `pnpm test` PASS (gate); manual E2E below.
- **COMMIT**: `feat: Netflix + YouTube content entrypoints (inject + overlay + toggles)`

### Task 15: Options page (React)
- **ACTION**: `entrypoints/options/*` — form for Gemini key + model, appearance (size/opacity/color/position sliders+pickers), languages (learningOnTop), platform toggles; persist via settings store; live-preview note.
- **TEST FIRST** (`options.validate.test.ts`): pure `validateSettings(partial)` (clamps fontSize 14–60, opacity 0–1, hex color, model non-empty).
  Run → FAIL.
- **IMPLEMENT**: React form bound to `getSettings`/`setSettings`; on change → validate → persist → `settingsItem.watch` broadcasts to content scripts.
- **MIRROR**: TYPES (Settings).
- **VALIDATE**: `pnpm test` PASS; manual: edit settings, see overlay update live (AC-5).
- **COMMIT**: `feat: options page (key, model, appearance, platforms)`

### Task 16: Popup (React)
- **ACTION**: `entrypoints/popup/*` — global on/off + per-platform toggles + status (key set? current platform?) + "Open settings".
- **TEST FIRST**: reuse `shouldActivate`/settings reducers (already tested) — popup is mostly view; no new pure logic → manual validation.
- **IMPLEMENT**: small React popup reading/writing settings.
- **VALIDATE**: manual — toggling disables overlay/capture without reload (AC-10).
- **COMMIT**: `feat: popup with global + per-platform toggles`

### Task 17: Integration validation + dual-browser build
- **ACTION**: Run the manual acceptance matrix and both browser builds.
- **TEST**: see Manual Validation checklist below.
- **VALIDATE**: `pnpm test` (all green), `pnpm compile`, `pnpm build`, `pnpm build:firefox`.
- **COMMIT**: `chore: M1 integration validation pass`

---

## No Placeholders
All tasks above carry real test code, file paths, and the specific logic/gotcha. No "TBD"/"handle errors"/"similar to Task N".

---

## Testing Strategy

### Unit Tests (Vitest — the testable core)
| Test | Input | Expected | Edge Case? |
|---|---|---|---|
| `parseWebVtt` | VTT string | `Cue[]` ms timings, de-tagged | empty/styling tags |
| `parseTtml` | TTML `<p begin end>` | `Cue[]` | `Ns` vs clock time |
| `parseYtJson3` | json3 events | `Cue[]` | multi-seg `utf8` |
| `migrate` | v0 record | defaults backfilled, user values kept | missing nested obj |
| `GeminiProvider.translateBatch` | mocked fetch | ordered translations; 429→rate-limited | fenced JSON |
| `orchestrator.translate` | cued + fake provider | only uncached translated, order kept | empty list |
| `lru` | over-capacity | oldest evicted | get refreshes recency |
| `selectTracks` | track list | `needsTranslation` correct | en-only, en+zh |
| `activeCueAt` | cues+time | containing cue / null | gap, boundary |
| `settingsToCssVars` | appearance | CSS var map | opacity 0/1 |
| `validateSettings` | partial | clamped/validated | out-of-range |

### Edge Cases Checklist
- [ ] Title with native EN + ZH (AC-1)  — use both native
- [ ] Title with EN only (AC-2) — AI ZH, cached
- [ ] YouTube auto-captions (`asr`) (AC-3)
- [ ] No Gemini key set → overlay shows native EN, ZH line shows "set key" notice (not a crash)
- [ ] Gemini 429 → keep native EN, retry/backoff notice
- [ ] SPA navigation → no duplicate overlays
- [ ] Toggle off mid-playback → overlay + capture stop (AC-10)

---

## Validation Commands

### Static Analysis
```bash
pnpm compile          # wxt prepare && tsc --noEmit
```
EXPECT: Zero type errors

### Unit Tests
```bash
pnpm test             # vitest run
```
EXPECT: All pass

### Build (both targets)
```bash
pnpm build            # Chromium/Brave
pnpm build:firefox    # Firefox
```
EXPECT: Both produce `.output/` artifacts, no errors

### Browser Validation
```bash
pnpm dev              # Chromium (Brave: load .output/chrome-mv3 unpacked)
pnpm dev:firefox      # Firefox
```
EXPECT: Overlay renders on Netflix + YouTube

### Manual Validation (acceptance matrix)
- [ ] **Netflix dual-native** (AC-1): both lines from native tracks, synced
- [ ] **Netflix EN-only → AI ZH** (AC-2): ZH from Gemini, repeat line not re-translated
- [ ] **YouTube** (AC-3): dual lines on a captioned video
- [ ] **Customization live** (AC-5): size/opacity/color/position update instantly + persist
- [ ] **BYO key safety** (AC-9): translation works after key entry; key never appears in page DOM/MAIN world
- [ ] **Toggles** (AC-10): per-platform + global on/off, no reload
- [ ] **Cross-browser** (AC-11): AC-1 + AC-5 pass in both Firefox and Brave

---

## Acceptance Criteria
- [ ] All 17 tasks completed
- [ ] All unit tests pass; `pnpm compile` clean
- [ ] Both browser builds succeed
- [ ] Manual acceptance matrix (AC-1,2,3,5,9,10,11) passes
- [ ] No telemetry: only Gemini + platform-origin requests (AC-12 spot-check)

## Completion Checklist
- [ ] Code follows the established Patterns to Mirror
- [ ] Sniffer hooks are fully try/caught (never break playback)
- [ ] Settings changes propagate live to content scripts
- [ ] No hardcoded key/model (all via settings)
- [ ] Overlay tears down cleanly on toggle/navigation (no duplicates)
- [ ] M2/M3/M4 seams left inert, not half-built
- [ ] Self-contained — no codebase searching needed

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Netflix/YouTube internal shapes differ from fixtures | M | H | Defensive parsing; capture real fixtures during Task 9/10; isolate per platform |
| `pnpm install` / `wxt init` permission gate | H | L | Expect one-time approval (package install is not auto-allowed) |
| MAIN-world `injectScript` blocked by page CSP | M | M | web_accessible_resource + injector idiom (InterSub-proven); detect+notify |
| Gemini structured-output JSON unreliable | M | M | Strip fences; length-mismatch fallback to newline split (Task 4 gotcha) |
| Overlay duplicates on SPA nav | M | M | Clean teardown on navigate (Task 14) |
| Firefox vs Chromium MV3 differences | L | M | WXT abstraction; build+smoke both in Task 17 (full hardening = M4) |

## Notes
- **AC mapping**: M1 satisfies AC-1,2,3,5,9,10,11. AC-6,7,8 (word lookup + TTS) are **M2**; AC-4 (HBO) is **M3**; AC-12 (no-telemetry) is satisfied by construction and spot-checked here.
- Resolves SRS open question on host scope: **specific host_permissions**, not `<all_urls>`.
- Package manager shown as `pnpm`; npm/yarn/bun equivalents are fine — adjust scripts accordingly.
- After M1 implements, run `/prp-plan docs/srs/twosub-dual-subtitle-mvp.srs.md` again (or a milestone-scoped prompt) to generate the **M2 word-lookup** plan against the now-real codebase.
