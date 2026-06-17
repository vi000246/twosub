import type { TrackMeta } from '../types/cue';

export interface HboTrack {
  lang: string;
  kind: TrackMeta['kind'];
  label?: string;
  segmentUrls: string[];
  timingShiftMs: number;
}

// Parse a DASH MPD into text (subtitle) tracks with resolved WebVTT segment URLs.
// Regex-based (node-testable); mirrors the fields InterSub / HBO-Max-Dual-Subtitles read from
// HBO's MPD (Period > AdaptationSet[text] > Representation[text/vtt] > SegmentTemplate + Timeline).
// HBO media templates use the full DASH identifier set ($Number$ / $Time$ / $Bandwidth$ /
// $RepresentationID$, with optional %0Nd padding) — substitute them ALL or the URLs 404.
export function parseDashTextTracks(mpd: string, manifestUrl: string): HboTrack[] {
  const periodTag = /<Period\b[^>]*>/.exec(mpd)?.[0] ?? '';
  const periodStartSec = parseIsoDuration(attrOf(periodTag, 'start'));
  // Document base = the MPD/Period-level <BaseURL> (whatever sits BEFORE the first AdaptationSet).
  // Using the first BaseURL anywhere wrongly picks the audio track's dir (e.g. `a/47680d/`) and
  // pollutes the text URLs — the real text path is just `<manifest>/t/<hash>/tN/`.
  const adIdx = mpd.search(/<AdaptationSet\b/);
  const base = resolveUrl(firstBaseUrl(adIdx >= 0 ? mpd.slice(0, adIdx) : mpd), manifestUrl);

  const tracks: HboTrack[] = [];
  for (const m of mpd.matchAll(/<AdaptationSet\b([^>]*)>([\s\S]*?)<\/AdaptationSet>/g)) {
    const attrs = m[1];
    const inner = m[2];
    const isText =
      /contentType\s*=\s*"text"/.test(attrs) || /mimeType\s*=\s*"text\/vtt"/.test(attrs + inner);
    if (!isText) continue;

    const lang = attrOf(attrs, 'lang') || attrOf(inner, 'lang') || 'und';
    const label = (/<Label\b[^>]*>([\s\S]*?)<\/Label>/.exec(inner)?.[1] ?? '').trim() || undefined;

    // Prefer the WebVTT representation; capture its id + bandwidth for template substitution.
    const repTag =
      /<Representation\b[^>]*mimeType\s*=\s*"text\/vtt"[^>]*>/.exec(inner)?.[0] ??
      /<Representation\b[^>]*>/.exec(inner)?.[0] ??
      '';
    const repId = attrOf(repTag, 'id');
    const bandwidth = attrOf(repTag, 'bandwidth');

    const st = /<SegmentTemplate\b([^>]*?)\/?>/.exec(inner)?.[1];
    if (!st) continue;
    const media = attrOf(st, 'media');
    if (!media) continue;

    const startNumber = toInt(attrOf(st, 'startNumber'), 1);
    const timescale = toInt(attrOf(st, 'timescale'), 1);
    const pto = toInt(attrOf(st, 'presentationTimeOffset'), 0);
    const adBase = resolveUrl(firstBaseUrl(inner), base);

    const segmentUrls: string[] = [];
    for (const { number, time } of expandTimeline(inner, startNumber)) {
      const seg = fillTemplate(media, {
        RepresentationID: repId,
        Bandwidth: bandwidth,
        Number: number,
        Time: time,
      });
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

// DASH media-template substitution: $$ → $, plus $RepresentationID$, $Bandwidth$, $Number$, $Time$,
// each with optional %0Nd zero-padding (e.g. $Number%04d$). Mirrors the DASH-IF identifier rules.
function fillTemplate(
  media: string,
  vals: { RepresentationID: string; Bandwidth: string; Number: number; Time: number },
): string {
  return media.replace(
    /\$(RepresentationID|Bandwidth|Number|Time)?(?:%0(\d+)d)?\$/g,
    (_full, id?: string, width?: string) => {
      if (!id) return '$'; // $$ escapes a literal '$'
      if (id === 'RepresentationID') return vals.RepresentationID;
      if (id === 'Bandwidth') return vals.Bandwidth || '0';
      const raw = String(id === 'Number' ? vals.Number : vals.Time);
      return width ? raw.padStart(Number(width), '0') : raw;
    },
  );
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

// Expand a SegmentTimeline into {number, time} pairs (number = startNumber + index for $Number$;
// time = cumulative @t/@d for $Time$). `@r` repeats the segment r additional times. No timeline →
// a single segment (covers single-file VTT tracks).
function expandTimeline(
  inner: string,
  startNumber: number,
): Array<{ number: number; time: number }> {
  const tl = /<SegmentTimeline\b[^>]*>([\s\S]*?)<\/SegmentTimeline>/.exec(inner);
  if (!tl) return [{ number: startNumber, time: 0 }];
  const out: Array<{ number: number; time: number }> = [];
  let n = startNumber;
  let t = 0;
  let first = true;
  for (const s of tl[1].matchAll(/<S\b([^>]*?)\/?>/g)) {
    const attrs = s[1];
    const explicitT = attrOf(attrs, 't');
    if (explicitT !== '') t = toInt(explicitT, t);
    else if (first) t = 0;
    const d = toInt(attrOf(attrs, 'd'), 0);
    const reps = 1 + Math.max(0, toInt(attrOf(attrs, 'r'), 0));
    for (let i = 0; i < reps; i++) {
      out.push({ number: n, time: t });
      n += 1;
      t += d;
    }
    first = false;
  }
  return out.length ? out : [{ number: startNumber, time: 0 }];
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
