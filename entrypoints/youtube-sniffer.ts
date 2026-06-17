import { CUES_EVENT, type CuesDetail } from '../src/sniff/events';
import { pickCaptionTracks } from '../src/capture/youtube';
import { parseYtJson3 } from '../src/capture/parsers/ytjson3';
import type { Cue, TrackMeta } from '../src/types/cue';

// YouTube MAIN world. Reads the CURRENT video's player response (survives SPA navigation),
// harvests the `pot` token, and fetches the en/zh tracks as json3.
export default defineUnlistedScript(() => {
  console.log('[TwoSub] youtube sniffer injected');
  let lastVideo = '';
  let curVid = '';
  let curAudioLang = '';
  let loggedPr = false;
  let pot = '';
  let potc = '1';
  let potClient = 'WEB';
  let pendingTracks: TrackMeta[] | null = null;
  let coaxed = false; // did we enable native captions just to harvest a pot for this video?

  // #movie_player.getPlayerResponse() always reflects the CURRENT video (updates on SPA nav),
  // unlike window.ytInitialPlayerResponse which is frozen to the initial page load.
  function currentPr(): any {
    const mp = document.querySelector('#movie_player') as any;
    const fromPlayer =
      mp && typeof mp.getPlayerResponse === 'function' ? mp.getPlayerResponse() : null;
    return fromPlayer ?? (window as any).ytInitialPlayerResponse;
  }

  setInterval(() => {
    const pr = currentPr();
    if (pr) void handlePr(pr);
  }, 1000);
  window.addEventListener('yt-navigate-finish', () => {
    const pr = currentPr();
    if (pr) void handlePr(pr);
  });
  patchFetch();
  patchXhr();

  function emit(tracks: TrackMeta[], cues: Cue[], videoId: string) {
    const detail: CuesDetail = {
      platform: 'youtube',
      tracks,
      cues,
      videoId,
      audioLang: curAudioLang || undefined,
    };
    window.dispatchEvent(new CustomEvent(CUES_EVENT, { detail }));
  }

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

  function pickBest(tracks: TrackMeta[], prefixes: string[]): TrackMeta | undefined {
    for (const p of prefixes) {
      const m = tracks.filter((t) => t.lang.toLowerCase().startsWith(p));
      if (m.length) return m.find((t) => t.kind !== 'asr') ?? m[0];
    }
    return undefined;
  }

  async function handlePr(raw: any) {
    const pr = raw?.videoDetails ? raw : (raw?.playerResponse ?? raw); // unwrap wrapped responses
    if (!loggedPr) {
      loggedPr = true;
      console.log(
        '[TwoSub] youtube: playerResponse keys=',
        Object.keys(pr || {})
          .slice(0, 15)
          .join(','),
      );
    }
    const vid: string = pr?.videoDetails?.videoId ?? '';
    if (!vid || vid === lastVideo) return;
    lastVideo = vid;
    curVid = vid;
    // The auto-speech-recognition caption track's languageCode reflects the spoken AUDIO language.
    curAudioLang =
      (pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []).find(
        (t: any) => t.kind === 'asr',
      )?.languageCode ?? '';
    emit([], [], vid); // immediately clear the previous video's subtitles on navigation

    const all = pickCaptionTracks(pr);
    const best = [
      pickBest(all, ['en']),
      pickBest(all, ['zh-hant', 'zh-tw', 'zh-hk', 'zh', 'zh-hans', 'zh-cn']),
    ].filter((t): t is TrackMeta => !!t);
    const wanted = best.length ? best : all.slice(0, 2);
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
    coaxed = false; // fresh video → try a clean self-fetch before coaxing captions for a pot
    pendingTracks = wanted;
    void fetchTracks(wanted); // many videos serve timedtext without a pot at all
  }

  async function fetchTracks(tracks: TrackMeta[]) {
    const vid = curVid;
    const cues: Cue[] = [];
    const used: TrackMeta[] = [];
    for (const t of tracks) {
      if (!t.url) continue;
      try {
        const u = new URL(t.url, location.href);
        u.searchParams.set('fmt', 'json3');
        if (pot) {
          u.searchParams.set('pot', pot);
          u.searchParams.set('potc', potc);
          u.searchParams.set('c', potClient);
        }
        const res = await fetch(u.toString());
        const text = await res.text();
        const parsed = parseYtJson3(text, t.lang);
        console.log(
          `[TwoSub] youtube fetch ${t.lang}: status=${res.status} bytes=${text.length} cues=${parsed.length} pot=${pot ? 'y' : 'n'}`,
        );
        if (parsed.length) {
          cues.push(...parsed);
          used.push(t);
        }
      } catch (e) {
        console.warn('[TwoSub] youtube track fetch threw:', t.lang, String(e));
      }
    }
    if (vid !== curVid) return; // navigated again while fetching — drop the stale result

    // No native Chinese track? Get a free, perfectly-aligned Chinese line from YouTube's OWN
    // auto-translate (&tlang=) of the English track — no Gemini/API key needed.
    const enSrc = used.find((t) => /^en/i.test(t.lang) && t.url);
    if (cues.length && enSrc?.url && !used.some((t) => /^zh/i.test(t.lang))) {
      try {
        const u = new URL(enSrc.url, location.href);
        u.searchParams.set('fmt', 'json3');
        u.searchParams.set('tlang', 'zh-Hant');
        if (pot) {
          u.searchParams.set('pot', pot);
          u.searchParams.set('potc', potc);
          u.searchParams.set('c', potClient);
        }
        const zh = parseYtJson3(await (await fetch(u.toString())).text(), 'zh-Hant');
        if (zh.length) {
          cues.push(...zh);
          used.push({ lang: 'zh-Hant', kind: 'native', url: enSrc.url });
          console.log('[TwoSub] youtube: +', zh.length, 'zh-Hant cues via tlang auto-translate');
        }
      } catch (e) {
        console.warn('[TwoSub] youtube: tlang fetch threw', String(e));
      }
    }

    if (cues.length) {
      pendingTracks = null;
      if (coaxed) {
        setCaptions(false); // we only needed the pot — restore the viewer's captions-off state
        coaxed = false;
      }
      console.log(
        '[TwoSub] youtube sniffer: captured',
        cues.length,
        'cues; langs:',
        used.map((t) => t.lang).join(','),
      );
      emit(used, cues, vid);
    } else if (!coaxed) {
      // 0 cues (no pot, or a pot harvested from a non-timedtext request that's invalid here) →
      // turn native captions ON like the user would, so YouTube issues a pot-bearing timedtext
      // request we harvest; harvest() then refetches and we switch captions back off.
      coaxed = true;
      console.warn('[TwoSub] youtube: 0 cues → coaxing native captions on to harvest a valid pot');
      setCaptions(true);
    } else {
      console.warn('[TwoSub] youtube: still 0 cues after coax (pot=' + (pot ? 'y' : 'n') + ')');
    }
  }

  // Turn YouTube's own captions on/off by clicking its CC button — exactly what a user does, so
  // it reliably makes the player fetch a pot-bearing timedtext request. Used only to harvest the
  // pot; our overlay hides the native rendering and we switch it back off once we have cues.
  function setCaptions(on: boolean) {
    try {
      const btn = document.querySelector('.ytp-subtitles-button') as HTMLElement | null;
      if (!btn) {
        console.warn('[TwoSub] youtube: CC button not found (controls not ready?)');
        return;
      }
      const pressed = btn.getAttribute('aria-pressed') === 'true';
      if (on !== pressed) {
        btn.click();
        console.log(`[TwoSub] youtube: ${on ? 'enabled' : 'disabled'} native captions (coax)`);
      } else if (on) {
        // Already on but we still have no pot — re-toggle to force a fresh timedtext request.
        btn.click();
        btn.click();
      }
    } catch (e) {
      console.warn('[TwoSub] youtube: setCaptions threw', String(e));
    }
  }
});
