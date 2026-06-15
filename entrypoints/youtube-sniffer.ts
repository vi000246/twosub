import { CUES_EVENT, type CuesDetail } from '../src/sniff/events';
import { pickCaptionTracks } from '../src/capture/youtube';
import { parseYtJson3 } from '../src/capture/parsers/ytjson3';
import type { Cue, TrackMeta } from '../src/types/cue';

// YouTube MAIN world. `ytInitialPlayerResponse` is set after document_start (so we poll).
// Timedtext now requires a `pot` (Proof-of-Origin Token); we harvest it from YouTube's own
// requests and append it (same as InterSub), then fetch the en/zh tracks as json3.
export default defineUnlistedScript(() => {
  console.log('[TwoSub] youtube sniffer injected');
  let lastVideo = '';
  let loggedPr = false;
  let pot = '';
  let potc = '1';
  let potClient = 'WEB';
  let pendingTracks: TrackMeta[] | null = null;

  setInterval(() => {
    const pr = (window as any).ytInitialPlayerResponse;
    if (pr) void handlePr(pr);
  }, 1000);
  window.addEventListener('yt-navigate-finish', () => {
    const pr = (window as any).ytInitialPlayerResponse;
    if (pr) void handlePr(pr);
  });
  patchFetch();
  patchXhr();

  // Harvest the pot token from any YouTube request URL that carries one.
  function harvest(urlStr: string) {
    try {
      const u = new URL(urlStr, location.href);
      const p = u.searchParams.get('pot');
      if (p && p !== pot) {
        pot = p;
        potc = u.searchParams.get('potc') ?? '1';
        potClient = u.searchParams.get('c') ?? 'WEB';
        console.log('[TwoSub] youtube: harvested pot token');
        if (pendingTracks) void fetchTracks(pendingTracks);
      }
    } catch {
      /* ignore */
    }
  }

  function patchFetch() {
    const orig = window.fetch;
    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      const url = String((args[0] as Request)?.url ?? args[0]);
      if (url.includes('pot=')) harvest(url);
      const res = await orig(...args);
      if (url.includes('/youtubei/v1/player')) {
        res
          .clone()
          .json()
          .then(handlePr)
          .catch(() => {});
      }
      return res;
    };
  }

  function patchXhr() {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...a: any[]) {
      try {
        if (String(a[1]).includes('pot=')) harvest(String(a[1]));
      } catch {
        /* ignore */
      }
      return (origOpen as (...x: any[]) => void).apply(this, a);
    };
  }

  async function handlePr(pr: any) {
    if (!loggedPr) {
      loggedPr = true;
      console.log(
        '[TwoSub] youtube: playerResponse keys=',
        Object.keys(pr || {}).slice(0, 15).join(','),
      );
    }
    const vid: string = pr?.videoDetails?.videoId ?? '';
    if (!vid || vid === lastVideo) return;
    lastVideo = vid;

    const all = pickCaptionTracks(pr);
    const enZh = all.filter((t) => /^(en|zh)/i.test(t.lang));
    const wanted = enZh.length ? enZh : all.slice(0, 2);
    console.log(
      '[TwoSub] youtube: video',
      vid,
      '; caption tracks =',
      all.length,
      '(using ' + wanted.length + ')',
      '; pot=',
      pot ? 'yes' : 'no',
    );
    if (!wanted.length) return;
    pendingTracks = wanted;
    if (pot) void fetchTracks(wanted);
    else console.log('[TwoSub] youtube: waiting for pot token (start playback)');
  }

  async function fetchTracks(tracks: TrackMeta[]) {
    if (!pot) return;
    const cues: Cue[] = [];
    const used: TrackMeta[] = [];
    for (const t of tracks) {
      if (!t.url) continue;
      try {
        const u = new URL(t.url, location.href);
        u.searchParams.set('fmt', 'json3');
        u.searchParams.set('pot', pot);
        u.searchParams.set('potc', potc);
        u.searchParams.set('c', potClient);
        const text = await (await fetch(u.toString())).text();
        const parsed = parseYtJson3(text, t.lang);
        if (parsed.length) {
          cues.push(...parsed);
          used.push(t);
        }
      } catch {
        /* skip failed track */
      }
    }
    if (cues.length) {
      pendingTracks = null;
      console.log(
        '[TwoSub] youtube sniffer: captured',
        cues.length,
        'cues; langs:',
        used.map((t) => t.lang).join(','),
      );
      const detail: CuesDetail = { platform: 'youtube', tracks: used, cues };
      window.dispatchEvent(new CustomEvent(CUES_EVENT, { detail }));
    } else {
      console.warn('[TwoSub] youtube: fetched tracks but parsed 0 cues (will retry on next pot)');
    }
  }
});
