import type { TrackMeta } from '../types/cue';

// Profile preference: WebVTT first (easiest to parse), then TTML/DFXP.
const PROFILE_PREF = ['webvtt-lssdh-ios8', 'webvtt', 'dfxp-ls-sdh', 'simplesdh', 'dfxp'];

export interface NfTrack {
  lang: string;
  kind: TrackMeta['kind'];
  url: string;
  format: 'webvtt' | 'ttml';
  label?: string;
}

// Pure: pick downloadable text tracks from a Netflix manifest's `timedtexttracks`.
export function pickTextTracks(manifest: any): NfTrack[] {
  const tt: any[] = manifest?.timedtexttracks ?? [];
  const out: NfTrack[] = [];
  for (const t of tt) {
    if (!t || t.isNoneTrack) continue;
    const dl = t.ttDownloadables ?? {};
    const profile = PROFILE_PREF.find((p) => dl[p]?.downloadUrls || dl[p]?.urls);
    if (!profile) continue;
    const url = firstUrl(dl[profile].downloadUrls ?? dl[profile].urls);
    if (!url) continue;
    out.push({
      lang: t.language ?? t.bcp47 ?? 'und',
      kind: t.isForcedNarrative ? 'forced' : t.rawTrackType === 'closedcaptions' ? 'cc' : 'native',
      url,
      format: profile.startsWith('webvtt') ? 'webvtt' : 'ttml',
      label: t.languageDescription,
    });
  }
  return out;
}

// Netflix's downloadUrls / urls can be a string map ({cdn: "url"}), an object map
// ({cdn: {url: "..."}}), or an array of objects ([{cdnId, url}]) — dig out the first URL string.
function firstUrl(container: any): string | undefined {
  if (!container) return undefined;
  const first = Array.isArray(container) ? container[0] : Object.values(container)[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object') {
    if (typeof first.url === 'string') return first.url;
    if (typeof first.downloadUrl === 'string') return first.downloadUrl;
    return Object.values(first).find((v) => typeof v === 'string' && /^https?:/i.test(v)) as
      | string
      | undefined;
  }
  return undefined;
}
