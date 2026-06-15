import { CUES_EVENT, type CuesDetail } from '../src/sniff/events';
import { pickCaptionTracks, ytFmtUrl } from '../src/capture/youtube';
import { parseYtJson3 } from '../src/capture/parsers/ytjson3';
import type { Cue } from '../src/types/cue';

// Runs in YouTube's MAIN world. Reads caption tracks from ytInitialPlayerResponse and
// from intercepted /youtubei/v1/player responses (SPA navigation), fetches json3 cues,
// and emits them to the content script.
export default defineUnlistedScript(() => {
  console.log('[TwoSub] youtube sniffer injected');
  let lastVideo = '';

  tryFromGlobal();
  window.addEventListener('yt-navigate-finish', () => tryFromGlobal());
  patchFetch();

  function tryFromGlobal() {
    const pr = (window as any).ytInitialPlayerResponse;
    if (pr) void handle(pr);
  }

  function patchFetch() {
    const orig = window.fetch;
    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      const res = await orig(...args);
      try {
        const url = String((args[0] as Request)?.url ?? args[0]);
        if (url.includes('/youtubei/v1/player'))
          res
            .clone()
            .json()
            .then(handle)
            .catch(() => {});
      } catch {
        /* ignore */
      }
      return res;
    };
  }

  async function handle(pr: any) {
    const vid: string = pr?.videoDetails?.videoId ?? '';
    const tracks = pickCaptionTracks(pr);
    if (!tracks.length) return;
    if (vid && vid === lastVideo) return; // de-dupe repeated player responses
    lastVideo = vid;

    const cues: Cue[] = [];
    for (const t of tracks) {
      if (!t.url) continue;
      try {
        const text = await (await fetch(ytFmtUrl(t.url, 'json3'))).text();
        cues.push(...parseYtJson3(text, t.lang));
      } catch {
        /* skip failed track */
      }
    }
    if (cues.length) {
      console.log(
        '[TwoSub] youtube sniffer: captured',
        cues.length,
        'cues; langs:',
        tracks.map((t) => t.lang).join(','),
      );
      const detail: CuesDetail = { platform: 'youtube', tracks, cues };
      window.dispatchEvent(new CustomEvent(CUES_EVENT, { detail }));
    }
  }
});
