import type { Cue } from '../../types/cue';

// Parse a WebVTT document into normalized cues (ms timings, de-tagged text).
export function parseWebVtt(raw: string, lang: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = raw.replace(/\r/g, '').split('\n\n');
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const arrowIdx = lines.findIndex((l) => l.includes('-->'));
    if (arrowIdx === -1) continue;
    const [startRaw, endRaw] = lines[arrowIdx].split('-->').map((s) => s.trim().split(/\s+/)[0]);
    const startMs = toMs(startRaw);
    const endMs = toMs(endRaw);
    if (startMs == null || endMs == null) continue;
    const text = cleanText(lines.slice(arrowIdx + 1).join(' '));
    if (!text) continue;
    cues.push({ id: hash(`${startMs}|${text}`), startMs, endMs, text, lang });
  }
  return cues;
}

// HH:MM:SS.mmm or MM:SS.mmm (',' or '.' as decimal separator).
function toMs(ts: string | undefined): number | null {
  if (!ts) return null;
  const m = ts.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/);
  if (!m) return null;
  const h = m[1] ? +m[1] : 0;
  const min = +m[2];
  const s = +m[3];
  const ms = +m[4].padEnd(3, '0');
  return ((h * 60 + min) * 60 + s) * 1000 + ms;
}

// Strip styling tags + bidi marks, collapse whitespace. Shared by all parsers.
export function cleanText(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&lrm;|&rlm;|[‎‏]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Stable, short id from a string (djb2).
export function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
