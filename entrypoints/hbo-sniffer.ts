import { CUES_EVENT, type CuesDetail } from '../src/sniff/events';
import { parseDashTextTracks } from '../src/capture/hbo';
import { parseWebVtt } from '../src/capture/parsers/webvtt';
import type { Cue, TrackMeta } from '../src/types/cue';

// Runs in HBO Max's MAIN world. HBO has no open subtitle API — it ships subtitles as WebVTT
// segments referenced from a DASH manifest. We capture them two ways, strongest first:
//
//   Layer 2 (primary, proven): passively sniff the player's OWN `*.vtt` segment XHRs as it
//     fetches them (Lingosive's approach) — no manifest parsing, no URL reconstruction, so it
//     survives manifest-shape and template changes. Requires the user's native subtitles on.
//   Layer 1 (enrichment): intercept /playback/v1/playbackInfo → MPD → parse text tracks and
//     self-fetch their segments. Gives the full language list + per-track timing shift even for
//     tracks the player isn't currently rendering. Best-effort (the fragile path).
//
// Both feed one accumulator that re-emits the full, de-duped cue set on every new segment.
export default defineUnlistedScript(() => {
  console.log('[TwoSub] hbo sniffer injected');

  // trackBase ("…/<dir>" with the "/<seg>.vtt" filename stripped) → accumulated track.
  interface Acc {
    lang: string;
    kind: TrackMeta['kind'];
    label?: string;
    shiftMs: number;
    langLocked: boolean; // lang came from the MPD (trustworthy) vs. a text heuristic
    cues: Map<string, Cue>;
  }
  const tracksByBase = new Map<string, Acc>();
  // Hints from the MPD, keyed by the same trackBase, used to label the player's live segments.
  const mpdHints = new Map<
    string,
    { lang: string; kind: TrackMeta['kind']; label?: string; shiftMs: number }
  >();
  let currentVideoId = ''; // the playing title's manifestationId — changes on episode/title switch
  // The fallback MPD's segment FILENAMES 404, but its per-track directory (e.g. `t4` = en-US) is
  // valid. Since every language shares the same segment filenames under its own `tN/` dir, we get
  // the (unrendered) English line by swapping the dir on a REAL captured URL — see deriveEnglish().
  let enDerive: { dir: string; lang: string; kind: TrackMeta['kind']; shiftMs: number } | null =
    null;
  const enFetched = new Set<string>();
  let loggedRealUrl = false; // log the first real captured segment URL once (diagnostics)

  patchFetch();
  patchXhr();

  // ---- emit ---------------------------------------------------------------
  let emitScheduled = false;
  function scheduleEmit() {
    if (emitScheduled) return;
    emitScheduled = true;
    queueMicrotask(() => {
      emitScheduled = false;
      emit();
    });
  }
  function emit() {
    const tracks: TrackMeta[] = [];
    const cues: Cue[] = [];
    for (const a of tracksByBase.values()) {
      if (!a.cues.size) continue;
      tracks.push({ lang: a.lang, kind: a.kind, label: a.label });
      for (const c of a.cues.values()) cues.push(c);
    }
    if (!cues.length) return;
    console.log(
      '[TwoSub] hbo sniffer: emitting',
      cues.length,
      'cues;',
      tracks.map((t) => `${t.lang}(${t.kind})`).join(','),
    );
    const detail: CuesDetail = {
      platform: 'hboMax',
      tracks,
      cues,
      videoId: currentVideoId || undefined,
    };
    window.dispatchEvent(new CustomEvent(CUES_EVENT, { detail }));
  }

  function accFor(base: string): Acc {
    let a = tracksByBase.get(base);
    if (!a) {
      const hint = mpdHints.get(base);
      a = {
        lang: hint?.lang ?? 'und',
        kind: hint?.kind ?? 'native',
        label: hint?.label,
        shiftMs: hint?.shiftMs ?? 0,
        langLocked: !!hint,
        cues: new Map(),
      };
      tracksByBase.set(base, a);
    }
    return a;
  }

  function addCues(base: string, vtt: string, langGuessSource: string) {
    const a = accFor(base);
    // If the MPD didn't tell us the language, infer it from the text (CJK → Chinese, else English).
    if (!a.langLocked) {
      const guessed = guessLang(langGuessSource);
      if (guessed) a.lang = guessed;
    }
    let added = 0;
    for (const c of parseWebVtt(vtt, a.lang)) {
      const shifted = a.shiftMs
        ? { ...c, startMs: c.startMs + a.shiftMs, endMs: c.endMs + a.shiftMs }
        : c;
      if (a.cues.has(shifted.id)) continue;
      a.cues.set(shifted.id, shifted);
      added++;
    }
    if (added) scheduleEmit();
  }

  // ---- Layer 2: live VTT segment sniff (the workhorse) --------------------
  function isVttSegment(url: string): boolean {
    return /\.vtt(\?|$)/i.test(url) && !url.includes('empty-dash-subs');
  }
  function onVttSegment(url: string, text: string) {
    if (typeof text !== 'string' || !text.includes('-->')) return;
    if (!loggedRealUrl) {
      loggedRealUrl = true;
      console.log('[TwoSub] hbo: real captured VTT url =', url);
    }
    const base = trackBaseOf(url);
    addCues(base, text, text);
    void deriveEnglish(url); // also pull the matching English segment for the second line
  }

  // Fetch the English line for a segment the player just loaded in another language, by swapping
  // the track directory on the REAL (working) URL — the fallback MPD's own filenames 404.
  async function deriveEnglish(realUrl: string) {
    if (!enDerive) return;
    const base = trackBaseOf(realUrl);
    const slash = base.lastIndexOf('/');
    const dir = base.slice(slash + 1);
    if (dir === enDerive.dir) return; // this IS the English track (player is rendering English)
    const enBase = base.slice(0, slash + 1) + enDerive.dir;
    const enUrl = enBase + realUrl.slice(base.length); // reuse the real filename + query
    if (enFetched.has(enUrl)) return;
    enFetched.add(enUrl);
    try {
      const res = await fetch(enUrl);
      if (!res.ok) {
        console.warn('[TwoSub] hbo: derive English', res.status, enUrl);
        return;
      }
      const a = accFor(enBase);
      a.lang = enDerive.lang;
      a.kind = enDerive.kind;
      a.shiftMs = enDerive.shiftMs;
      a.langLocked = true;
      addCues(enBase, await res.text(), '');
    } catch (e) {
      console.warn('[TwoSub] hbo: derive English threw', String(e));
    }
  }

  // ---- Layer 1: playbackInfo → MPD → self-fetched segments ----------------
  function onPlaybackInfo(text: string) {
    let info: any;
    try {
      info = JSON.parse(text);
    } catch {
      return;
    }
    // Log the shape once so a changed response is diagnosable from the console.
    console.log(
      '[TwoSub] hbo: playbackInfo intercepted; keys=',
      Object.keys(info ?? {}).join(','),
      '| videos[].textTracks=',
      JSON.stringify(
        (info?.videos ?? []).map((v: any) => ({ type: v?.type, tt: (v?.textTracks ?? []).length })),
      ),
    );
    const manifestUrl: string | undefined =
      info?.manifest?.url ?? info?.manifests?.[0]?.url ?? deepFindMpd(info);
    if (!manifestUrl) {
      console.warn(
        '[TwoSub] hbo: no manifest URL in playbackInfo (Layer 2 segment-sniff still active)',
      );
      return;
    }
    // Identify the title by its stable manifestationId (CDN host varies for the same video); on a
    // switch (next episode / new title) reset everything so the previous video's cues don't linger.
    const mainVideo =
      (info?.videos ?? []).find((v: any) => v?.type === 'main') ?? info?.videos?.[0];
    const videoId = String(
      mainVideo?.manifestationId ?? /\/([0-9a-f-]{36})\//.exec(manifestUrl)?.[1] ?? manifestUrl,
    );
    if (videoId === currentVideoId) return;
    currentVideoId = videoId;
    tracksByBase.clear();
    mpdHints.clear();
    enFetched.clear();
    enDerive = null;
    loggedRealUrl = false;
    // Tell the session to drop the old video's cues immediately (before new ones arrive).
    window.dispatchEvent(
      new CustomEvent(CUES_EVENT, {
        detail: { platform: 'hboMax', tracks: [], cues: [], videoId } as CuesDetail,
      }),
    );
    console.log('[TwoSub] hbo: new video', videoId, '→ manifest', manifestUrl);
    void loadManifest(manifestUrl);
  }

  async function loadManifest(manifestUrl: string) {
    let mpd: string;
    try {
      mpd = await (await fetch(manifestUrl)).text();
    } catch (e) {
      console.warn('[TwoSub] hbo: manifest fetch failed', String(e));
      return;
    }
    const dashTracks = parseDashTextTracks(mpd, manifestUrl);
    console.log(
      '[TwoSub] hbo: DASH text tracks',
      dashTracks.length,
      dashTracks.map((t) => `${t.lang}(${t.kind})×${t.segmentUrls.length}`).join(','),
    );
    // Register MPD hints so Layer 2 can label/shift the player's own segments correctly.
    for (const t of dashTracks) {
      if (!t.segmentUrls.length) continue;
      mpdHints.set(trackBaseOf(t.segmentUrls[0]), {
        lang: t.lang,
        kind: t.kind,
        label: t.label,
        shiftMs: t.timingShiftMs,
      });
    }
    // The fallback MPD's segment URLs 404 — don't self-fetch them. Instead remember the English
    // track's directory so deriveEnglish() can rebuild its URLs from the player's REAL captured
    // segments (which share the same filenames under each language's own `tN/` dir).
    const enTrack = dashTracks.find((t) => t.lang.toLowerCase().startsWith('en'));
    if (enTrack?.segmentUrls.length) {
      const b = trackBaseOf(enTrack.segmentUrls[0]);
      enDerive = {
        dir: b.slice(b.lastIndexOf('/') + 1),
        lang: enTrack.lang,
        kind: enTrack.kind,
        shiftMs: enTrack.timingShiftMs,
      };
      console.log('[TwoSub] hbo: will derive English from track dir', enDerive.dir);
    } else {
      console.warn('[TwoSub] hbo: no English text track in manifest — English line unavailable');
    }
    // Auto-load: self-fetch the English + Traditional-Chinese tracks so dual subtitles work even
    // when the viewer never turns native subtitles on. The fallback MPD only declares 1 segment per
    // track, so we probe sequential numbers (1.vtt, 2.vtt, …) until they run out.
    void autoLoadTracks(dashTracks);
  }

  async function autoLoadTracks(dashTracks: ReturnType<typeof parseDashTextTracks>) {
    const lc = (t: { lang: string }) => t.lang.toLowerCase();
    const has = (t: { segmentUrls: string[] }) => t.segmentUrls.length > 0;
    // Exactly ONE English + ONE Traditional-Chinese track (merging two zh variants of different
    // timing would garble the line). Prefer zh-Hant-TW, then any zh-Hant/HK, then any zh.
    const en = dashTracks.find((t) => lc(t).startsWith('en') && has(t));
    const zh =
      dashTracks.find((t) => /^zh-(hant-tw|tw)/.test(lc(t)) && has(t)) ??
      dashTracks.find((t) => /^zh-(hant|hk)/.test(lc(t)) && has(t)) ??
      dashTracks.find((t) => lc(t).startsWith('zh') && has(t));
    for (const t of [en, zh]) {
      if (!t) continue;
      const m = t.segmentUrls[0].match(/^(.*\/)(\d+)(\.vtt(?:\?.*)?)$/i);
      if (!m) continue;
      const [, dir, startStr, suffix] = m;
      const base = dir.replace(/\/$/, '');
      const a = accFor(base);
      a.lang = t.lang;
      a.kind = t.kind;
      a.label = t.label;
      a.shiftMs = t.timingShiftMs;
      a.langLocked = true;
      const before = a.cues.size;
      let misses = 0;
      let n = parseInt(startStr, 10);
      for (let fetched = 0; fetched < 600 && misses < 3; fetched++, n++) {
        try {
          const r = await fetch(`${dir}${n}${suffix}`);
          if (!r.ok) {
            misses++;
            continue;
          }
          misses = 0;
          addCues(base, await r.text(), '');
        } catch {
          misses++;
        }
      }
      console.log(`[TwoSub] hbo auto-load ${t.lang}: +${a.cues.size - before} cues (${base})`);
    }
  }

  // ---- network patches ----------------------------------------------------
  function patchFetch() {
    const orig = window.fetch;
    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      const res = await orig(...args);
      try {
        const url = String((args[0] as Request)?.url ?? args[0]);
        if (isPlaybackInfo(url)) {
          res
            .clone()
            .text()
            .then(onPlaybackInfo)
            .catch(() => {});
        }
      } catch {
        /* ignore */
      }
      return res;
    };
  }

  function patchXhr() {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: any[]) {
      try {
        (this as any)._tsUrl = String(args[1] ?? '');
      } catch {
        /* ignore */
      }
      return (origOpen as (...a: any[]) => void).apply(this, args);
    };
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...args: any[]) {
      this.addEventListener('load', () => {
        try {
          const url: string = (this as any)._tsUrl ?? this.responseURL ?? '';
          if (this.status < 200 || this.status >= 300) return;
          if (!isPlaybackInfo(url) && !isVttSegment(url)) return;
          const body = xhrText(this);
          if (body == null) return;
          if (isPlaybackInfo(url)) onPlaybackInfo(body);
          else onVttSegment(url, body);
        } catch {
          /* ignore */
        }
      });
      return (origSend as (...a: any[]) => void).apply(this, args);
    };
  }
});

// Read an XHR body as text regardless of responseType (the player may fetch VTT as text or
// arraybuffer). `.responseText` throws for non-text types, so fall back to `.response`.
function xhrText(xhr: XMLHttpRequest): string | null {
  try {
    if (typeof xhr.responseText === 'string' && xhr.responseText) return xhr.responseText;
  } catch {
    /* responseType isn't '' | 'text' */
  }
  const r = xhr.response;
  if (typeof r === 'string') return r;
  if (r instanceof ArrayBuffer) {
    try {
      return new TextDecoder().decode(r);
    } catch {
      /* ignore */
    }
  }
  return null;
}

// Match HBO's playback endpoint loosely: any path ending in playbackInfo (survives a version bump
// from /playback/v1/ to /v2/ etc.), mirroring the reference extensions' `.endsWith('playbackInfo')`.
function isPlaybackInfo(url: string): boolean {
  try {
    return new URL(url, location.href).pathname.endsWith('playbackInfo');
  } catch {
    return url.includes('playbackInfo');
  }
}

// Strip the "/<segment>.vtt[?query]" filename → the track's directory, used as its accumulator key.
function trackBaseOf(url: string): string {
  return url.replace(/\/[^/]+\.vtt(\?.*)?$/i, '');
}

// Cheap language guess for an unlabeled track: predominantly-CJK text → Traditional Chinese
// (HBO Asia ships zh-Hant), otherwise English. Good enough to route the EN/ZH dual-sub pipeline.
function guessLang(text: string): string | null {
  const cjk = (text.match(/[㐀-鿿豈-﫿]/g) ?? []).length;
  const letters = (text.match(/[A-Za-z㐀-鿿豈-﫿]/g) ?? []).length;
  if (letters < 4) return null;
  return cjk / letters > 0.2 ? 'zh-Hant' : 'en';
}

// Some playbackInfo variants nest the MPD URL; find the first ".mpd" string anywhere in the object.
function deepFindMpd(obj: any, depth = 0): string | undefined {
  if (depth > 4 || obj == null) return undefined;
  if (typeof obj === 'string') return obj.includes('.mpd') ? obj : undefined;
  if (typeof obj !== 'object') return undefined;
  for (const v of Object.values(obj)) {
    const hit = deepFindMpd(v, depth + 1);
    if (hit) return hit;
  }
  return undefined;
}
