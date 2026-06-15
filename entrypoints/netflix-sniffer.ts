import { CUES_EVENT, type CuesDetail } from '../src/sniff/events';
import { pickTextTracks, type NfTrack } from '../src/capture/netflix';
import { parseWebVtt } from '../src/capture/parsers/webvtt';
import { parseTtml } from '../src/capture/parsers/ttml';
import type { Cue, TrackMeta } from '../src/types/cue';

// Runs in Netflix's MAIN world. Netflix parses its manifest (with `timedtexttracks`)
// internally via JSON.parse, so we hook that + fetch to discover native text tracks,
// fetch + parse them in-page, and hand normalized cues to the content script.
export default defineUnlistedScript(() => {
  console.log('[TwoSub] netflix sniffer injected');
  let lastSig = '';

  patchJsonParse();
  patchFetch();

  function onManifest(obj: any) {
    try {
      const tracks = pickTextTracks(obj);
      if (!tracks.length) return;
      const sig = tracks.map((t) => t.lang + t.url).join('|');
      if (sig === lastSig) return; // de-dupe repeated manifests
      lastSig = sig;
      void loadAndEmit(tracks);
    } catch {
      /* not a manifest we understand */
    }
  }

  async function loadAndEmit(nf: NfTrack[]) {
    const cues: Cue[] = [];
    const tracks: TrackMeta[] = [];
    for (const t of nf) {
      tracks.push({ lang: t.lang, kind: t.kind, label: t.label, url: t.url });
      try {
        const text = await (await fetch(t.url)).text();
        cues.push(...(t.format === 'webvtt' ? parseWebVtt(text, t.lang) : parseTtml(text, t.lang)));
      } catch {
        /* one track failed; keep the rest */
      }
    }
    if (cues.length) {
      console.log(
        '[TwoSub] netflix sniffer: captured',
        cues.length,
        'cues; langs:',
        tracks.map((t) => t.lang).join(','),
      );
      const detail: CuesDetail = { platform: 'netflix', tracks, cues };
      window.dispatchEvent(new CustomEvent(CUES_EVENT, { detail }));
    }
  }

  function patchJsonParse() {
    const orig = JSON.parse;
    JSON.parse = function (text: string, reviver?: (key: string, value: any) => any) {
      const out = orig(text, reviver as any);
      if (out && typeof out === 'object' && 'timedtexttracks' in out) onManifest(out);
      return out;
    };
  }

  function patchFetch() {
    const orig = window.fetch;
    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      const res = await orig(...args);
      try {
        const url = String((args[0] as Request)?.url ?? args[0]);
        if (url.includes('manifest'))
          res
            .clone()
            .json()
            .then(onManifest)
            .catch(() => {});
      } catch {
        /* ignore */
      }
      return res;
    };
  }
});
