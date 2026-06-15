import type { TrackMeta } from '../types/cue';

interface YtCaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string };
}

// Pure: extract caption tracks from a YouTube player response.
export function pickCaptionTracks(playerResponse: any): TrackMeta[] {
  const tracks: YtCaptionTrack[] =
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  return tracks
    .filter((t) => t.baseUrl && t.languageCode)
    .map((t) => ({
      lang: t.languageCode as string,
      kind: t.kind === 'asr' ? 'asr' : 'native',
      label: t.name?.simpleText,
      url: t.baseUrl as string,
    }));
}

// Build a timedtext URL with a format (json3) and optional YouTube auto-translate target.
export function ytFmtUrl(baseUrl: string, fmt = 'json3', tlang?: string): string {
  const u = new URL(baseUrl, 'https://www.youtube.com');
  u.searchParams.set('fmt', fmt);
  if (tlang) u.searchParams.set('tlang', tlang);
  return u.toString();
}
