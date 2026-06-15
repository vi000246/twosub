import type { TrackMeta } from '../types/cue';

export interface HboTrack {
  lang: string;
  kind: TrackMeta['kind'];
  label?: string;
  segmentUrls: string[];
  timingShiftMs: number;
}

// Parse a DASH MPD into text (subtitle) tracks with resolved WebVTT segment URLs.
// Regex-based (node-testable); mirrors the fields InterSub reads from HBO's MPD. Best-effort —
// HBO's manifest shape is relatively flat (Period > AdaptationSet[text] > Representation > SegmentTemplate).
export function parseDashTextTracks(mpd: string, manifestUrl: string): HboTrack[] {
  const periodTag = /<Period\b[^>]*>/.exec(mpd)?.[0] ?? '';
  const periodStartSec = parseIsoDuration(attrOf(periodTag, 'start'));
  const base = resolveUrl(firstBaseUrl(mpd), manifestUrl);

  const tracks: HboTrack[] = [];
  for (const m of mpd.matchAll(/<AdaptationSet\b([^>]*)>([\s\S]*?)<\/AdaptationSet>/g)) {
    const attrs = m[1];
    const inner = m[2];
    const isText =
      /contentType\s*=\s*"text"/.test(attrs) || /mimeType\s*=\s*"text\/vtt"/.test(attrs + inner);
    if (!isText) continue;

    const lang = attrOf(attrs, 'lang') || attrOf(inner, 'lang') || 'und';
    const label = (/<Label\b[^>]*>([\s\S]*?)<\/Label>/.exec(inner)?.[1] ?? '').trim() || undefined;

    const st = /<SegmentTemplate\b([^>]*?)\/?>/.exec(inner)?.[1];
    if (!st) continue;
    const media = attrOf(st, 'media');
    if (!media) continue;

    const startNumber = toInt(attrOf(st, 'startNumber'), 1);
    const timescale = toInt(attrOf(st, 'timescale'), 1);
    const pto = toInt(attrOf(st, 'presentationTimeOffset'), 0);
    const repId = attrOf(/<Representation\b[^>]*>/.exec(inner)?.[0] ?? '', 'id');
    const adBase = resolveUrl(firstBaseUrl(inner), base);
    const count = countSegments(inner);

    const segmentUrls: string[] = [];
    for (let i = 0; i < count; i++) {
      const n = startNumber + i;
      const seg = media
        .replace(/\$RepresentationID\$/g, repId)
        .replace(/\$Number(?:%0(\d+)d)?\$/g, (_full, w?: string) =>
          w ? String(n).padStart(Number(w), '0') : String(n),
        );
      segmentUrls.push(resolveUrl(seg, adBase));
    }

    tracks.push({
      lang,
      kind: classifyKind(lang, label),
      label,
      segmentUrls,
      timingShiftMs: Math.round((periodStartSec - pto / timescale) * 1000),
    });
  }
  return onePerLang(tracks);
}

function classifyKind(lang: string, label?: string): TrackMeta['kind'] {
  const l = `${lang} ${label ?? ''}`.toLowerCase();
  if (l.includes('forced')) return 'forced';
  if (l.includes('sdh') || l.includes('cc')) return 'cc';
  return 'native';
}

// Keep one track per language, preferring full/SDH over forced.
function onePerLang(tracks: HboTrack[]): HboTrack[] {
  const best = new Map<string, HboTrack>();
  for (const t of tracks) {
    const cur = best.get(t.lang);
    if (!cur || score(t) > score(cur)) best.set(t.lang, t);
  }
  return [...best.values()];
}
function score(t: HboTrack): number {
  const l = (t.label ?? '').toLowerCase();
  if (t.kind === 'forced') return 0;
  if (l.includes('sdh') || l.includes('full')) return 3;
  return 2;
}

function countSegments(inner: string): number {
  const tl = /<SegmentTimeline\b[^>]*>([\s\S]*?)<\/SegmentTimeline>/.exec(inner);
  if (!tl) return 1;
  let count = 0;
  for (const s of tl[1].matchAll(/<S\b([^>]*?)\/?>/g)) {
    count += 1 + toInt(attrOf(s[1], 'r'), 0);
  }
  return count || 1;
}

function parseIsoDuration(d: string): number {
  const m = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(d);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function attrOf(s: string, name: string): string {
  return new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(s)?.[1] ?? '';
}
function firstBaseUrl(s: string): string {
  return (/<BaseURL>\s*([^<]*?)\s*<\/BaseURL>/.exec(s)?.[1] ?? '').trim();
}
function resolveUrl(rel: string, base: string): string {
  if (!rel) return base;
  try {
    return new URL(rel, base).toString();
  } catch {
    return rel;
  }
}
function toInt(s: string, fallback: number): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}
