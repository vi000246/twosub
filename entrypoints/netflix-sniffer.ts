import { CUES_EVENT, type CuesDetail } from '../src/sniff/events';
import { pickTextTracks, type NfTrack } from '../src/capture/netflix';
import { parseWebVtt } from '../src/capture/parsers/webvtt';
import { parseTtml } from '../src/capture/parsers/ttml';
import type { Cue, TrackMeta } from '../src/types/cue';

// Runs in Netflix's MAIN world. Netflix parses its manifest (which carries the subtitle list
// under `.result.timedtexttracks`) via JSON.parse, delivered over XHR — so we hook both
// JSON.parse and XHR responseText, then fetch + parse the native WebVTT/TTML tracks.
export default defineUnlistedScript(() => {
  console.log('[TwoSub] netflix sniffer injected');
  let lastSig = '';
  let nfAudioLang = '';

  patchJsonParse();
  patchXhr();

  // The subtitle list lives at `.timedtexttracks` (top level) OR nested under `.result`.
  function extractManifest(obj: any): any | null {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj.timedtexttracks)) return obj;
    if (obj.result && Array.isArray(obj.result.timedtexttracks)) return obj.result;
    return null;
  }

  function onManifest(m: any) {
    try {
      const tracks = pickTextTracks(m);
      if (!tracks.length) return;
      const sig = tracks.map((t) => t.lang + t.url).join('|');
      if (sig === lastSig) return;
      lastSig = sig;
      // Original-language audio (best-effort proxy for what the viewer is hearing): if the title's
      // native audio isn't English, we render a Chinese-only single subtitle instead of dual.
      const at: any[] = m.audio_tracks ?? m.audioTracks ?? [];
      nfAudioLang = String(
        at.find((t) => t.isNative)?.language ??
          at.find((t) => t.isNative)?.bcp47 ??
          at[0]?.language ??
          '',
      );
      if (at.length)
        console.log(
          '[TwoSub] netflix audio:',
          nfAudioLang || '?',
          '/',
          at.map((t) => t.language ?? t.bcp47).join(','),
        );
      console.log(
        '[TwoSub] netflix raw tracks:',
        (m.timedtexttracks ?? [])
          .map(
            (t: any) =>
              `${t.language ?? '?'}[${Object.keys(t.ttDownloadables ?? {}).join('/')}]${t.isNoneTrack ? '(none)' : ''}`,
          )
          .join(', '),
      );
      console.log(
        '[TwoSub] netflix: manifest found,',
        tracks.length,
        'usable tracks:',
        tracks.map((t) => t.lang + '/' + t.format).join(','),
      );
      void loadAndEmit(tracks);
    } catch {
      /* not a manifest we understand */
    }
  }

  async function loadAndEmit(nf: NfTrack[]) {
    const fetched: Array<{ meta: TrackMeta; cues: Cue[] }> = [];
    for (const t of nf) {
      try {
        const res = await fetch(t.url);
        const text = await res.text();
        const parsed = t.format === 'webvtt' ? parseWebVtt(text, t.lang) : parseTtml(text, t.lang);
        console.log('[TwoSub] netflix track:', t.lang, t.format, res.status, 'cues', parsed.length);
        fetched.push({
          meta: { lang: t.lang, kind: t.kind, label: t.label, url: t.url },
          cues: parsed,
        });
      } catch (e) {
        console.warn('[TwoSub] netflix track failed:', t.lang, String(e));
      }
    }
    // Netflix lists SEVERAL tracks per language (regular / SDH / forced / CDN-duplicates), all with
    // the SAME lang string — keep only the FULLEST (most cues) per language so the session never
    // merges differently-timed variants into one garbled, flickering line.
    const best = new Map<string, { meta: TrackMeta; cues: Cue[] }>();
    for (const f of fetched) {
      const cur = best.get(f.meta.lang);
      if (!cur || f.cues.length > cur.cues.length) best.set(f.meta.lang, f);
    }
    const tracks: TrackMeta[] = [];
    const cues: Cue[] = [];
    for (const f of best.values()) {
      tracks.push(f.meta);
      cues.push(...f.cues);
    }
    if (cues.length) {
      console.log(
        '[TwoSub] netflix sniffer: captured',
        cues.length,
        'cues from',
        tracks.length,
        'tracks (1/lang):',
        [...best.values()].map((f) => `${f.meta.lang}:${f.cues.length}`).join(','),
      );
      const detail: CuesDetail = {
        platform: 'netflix',
        tracks,
        cues,
        audioLang: nfAudioLang || undefined,
      };
      window.dispatchEvent(new CustomEvent(CUES_EVENT, { detail }));
    }
  }

  function patchJsonParse() {
    const orig = JSON.parse;
    JSON.parse = function (text: string, reviver?: (k: string, v: any) => any) {
      const out = orig(text, reviver as any);
      const m = extractManifest(out);
      if (m) onManifest(m);
      return out;
    };
  }

  function patchXhr() {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...a: any[]) {
      this.addEventListener('load', () => {
        try {
          const rt = this.responseText;
          if (typeof rt === 'string' && rt.includes('timedtexttracks')) {
            const m = extractManifest(JSON.parse(rt));
            if (m) onManifest(m);
          }
        } catch {
          /* not JSON / not readable */
        }
      });
      return (origOpen as (...x: any[]) => void).apply(this, a);
    };
  }
});
