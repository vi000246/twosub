import type { Cue } from '../../types/cue';
import { cleanText, hash } from './webvtt';

// Parse TTML / DFXP <p begin=... end=...>text</p>. Regex-based so it's unit-testable
// without a DOM; handles clock (HH:MM:SS(.ms)) and offset (Ns/Nms/Nm/Nh) time forms.
export function parseTtml(raw: string, lang: string): Cue[] {
  const cues: Cue[] = [];
  const pRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(raw))) {
    const startMs = ttmlToMs(attr(m[1], 'begin'));
    const endMs = ttmlToMs(attr(m[1], 'end'));
    if (startMs == null || endMs == null) continue;
    const text = cleanText(m[2].replace(/<br\s*\/?>/gi, ' '));
    if (!text) continue;
    cues.push({ id: hash(`${startMs}|${text}`), startMs, endMs, text, lang });
  }
  return cues;
}

function attr(attrs: string, name: string): string | undefined {
  return attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`))?.[1];
}

export function ttmlToMs(t: string | undefined): number | null {
  if (!t) return null;
  const clock = t.match(/^(\d+):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (clock) {
    const ms = clock[4] ? +clock[4].padEnd(3, '0') : 0;
    return ((+clock[1] * 60 + +clock[2]) * 60 + +clock[3]) * 1000 + ms;
  }
  const off = t.match(/^([\d.]+)(h|ms|m|s)$/);
  if (off) {
    const n = parseFloat(off[1]);
    switch (off[2]) {
      case 'h':
        return n * 3_600_000;
      case 'm':
        return n * 60_000;
      case 's':
        return n * 1000;
      case 'ms':
        return n;
    }
  }
  return null;
}
