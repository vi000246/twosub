import { CUES_EVENT, type CuesDetail } from '../src/sniff/events';
import { parseDashTextTracks } from '../src/capture/hbo';
import { parseWebVtt } from '../src/capture/parsers/webvtt';
import type { Cue, TrackMeta } from '../src/types/cue';

// Runs in HBO Max's MAIN world. HBO has no open subtitle API: it ships subtitles inside the
// DRM-wrapped DASH manifest. We intercept /playback/v1/playbackInfo to get the MPD URL, parse
// it for WebVTT text tracks, fetch + concatenate the segments, and emit normalized cues.
// Best-effort + fragile (per the PRD) — segment timing + the native-hide selector need live calibration.
export default defineUnlistedScript(() => {
  let lastManifest = '';

  patchFetch();
  patchXhr();

  function onPlaybackInfo(text: string) {
    let info: any;
    try {
      info = JSON.parse(text);
    } catch {
      return;
    }
    const manifestUrl: string | undefined = info?.manifest?.url ?? info?.manifests?.[0]?.url;
    if (!manifestUrl || manifestUrl === lastManifest) return;
    lastManifest = manifestUrl;
    void loadAndEmit(manifestUrl);
  }

  async function loadAndEmit(manifestUrl: string) {
    let mpd: string;
    try {
      mpd = await (await fetch(manifestUrl)).text();
    } catch {
      return;
    }
    const dashTracks = parseDashTextTracks(mpd, manifestUrl);
    if (!dashTracks.length) return;

    const tracks: TrackMeta[] = [];
    const cues: Cue[] = [];
    for (const t of dashTracks) {
      tracks.push({ lang: t.lang, kind: t.kind, label: t.label });
      const seen = new Set<string>();
      for (const url of t.segmentUrls) {
        let vtt: string;
        try {
          vtt = await (await fetch(url)).text();
        } catch {
          continue; // one segment failed; keep going
        }
        for (const c of parseWebVtt(vtt, t.lang)) {
          if (seen.has(c.id)) continue; // de-dupe boundary cues across segments
          seen.add(c.id);
          cues.push({ ...c, startMs: c.startMs + t.timingShiftMs, endMs: c.endMs + t.timingShiftMs });
        }
      }
    }
    if (cues.length) {
      const detail: CuesDetail = { platform: 'hboMax', tracks, cues };
      window.dispatchEvent(new CustomEvent(CUES_EVENT, { detail }));
    }
  }

  function patchFetch() {
    const orig = window.fetch;
    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      const res = await orig(...args);
      try {
        const url = String((args[0] as Request)?.url ?? args[0]);
        if (url.includes('/playback/v1/playbackInfo')) {
          res.clone().text().then(onPlaybackInfo).catch(() => {});
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
        if (String(args[1]).includes('/playback/v1/playbackInfo')) {
          this.addEventListener('load', () => {
            try {
              if (typeof this.responseText === 'string') onPlaybackInfo(this.responseText);
            } catch {
              /* ignore */
            }
          });
        }
      } catch {
        /* ignore */
      }
      return (origOpen as (...a: any[]) => void).apply(this, args);
    };
  }
});
