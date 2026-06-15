import { CUES_EVENT, type CuesDetail } from '../src/sniff/events';
import { pickCaptionTracks, ytFmtUrl } from '../src/capture/youtube';
import { parseYtJson3 } from '../src/capture/parsers/ytjson3';
import type { Cue } from '../src/types/cue';

// Runs in YouTube's MAIN world. `ytInitialPlayerResponse` is injected by YouTube AFTER
// document_start, so reading it once at startup misses it — we POLL for it, and also catch
// SPA navigations via the player API + yt-navigate-finish. Fetches json3 caption tracks.
export default defineUnlistedScript(() => {
  console.log('[TwoSub] youtube sniffer injected');
  let lastVideo = '';
  let loggedPr = false;

  setInterval(() => {
    const pr = (window as any).ytInitialPlayerResponse;
    if (pr) void handle(pr);
  }, 1000);

  window.addEventListener('yt-navigate-finish', () => {
    const pr = (window as any).ytInitialPlayerResponse;
    if (pr) void handle(pr);
  });

  patchFetch();

  function patchFetch() {
    const orig = window.fetch;
    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      const res = await orig(...args);
      try {
        const url = String((args[0] as Request)?.url ?? args[0]);
        if (url.includes('/youtubei/v1/player')) {
          res
            .clone()
            .json()
            .then(handle)
            .catch(() => {});
        }
      } catch {
        /* ignore */
      }
      return res;
    };
  }

  async function handle(pr: any) {
    if (!loggedPr) {
      loggedPr = true;
      console.log(
        '[TwoSub] youtube: ytInitialPlayerResponse seen; keys=',
        Object.keys(pr || {}).slice(0, 15).join(','),
      );
    }
    const vid: string = pr?.videoDetails?.videoId ?? '';
    if (!vid || vid === lastVideo) return; // not a watch page, or already handled
    lastVideo = vid;

    const tracks = pickCaptionTracks(pr);
    console.log('[TwoSub] youtube: video', vid, '; caption tracks =', tracks.length);
    if (!tracks.length) return;

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
