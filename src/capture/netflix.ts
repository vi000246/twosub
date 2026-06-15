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
    const urls = dl[profile].downloadUrls ?? dl[profile].urls ?? {};
    const url = Object.values(urls)[0] as string | undefined;
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
