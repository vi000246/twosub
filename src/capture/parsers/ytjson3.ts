import type { Cue } from '../../types/cue';
import { cleanText, hash } from './webvtt';

interface Json3 {
  events?: Array<{
    tStartMs?: number;
    dDurationMs?: number;
    segs?: Array<{ utf8?: string }>;
  }>;
}

// Parse YouTube timedtext fmt=json3 into normalized cues.
export function parseYtJson3(raw: string | Json3, lang: string): Cue[] {
  const data: Json3 = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const cues: Cue[] = [];
  for (const ev of data.events ?? []) {
    if (ev.tStartMs == null || !ev.segs) continue;
    const text = cleanText(ev.segs.map((s) => s.utf8 ?? '').join(''));
    if (!text) continue;
    const startMs = ev.tStartMs;
    cues.push({
      id: hash(`${startMs}|${text}`),
      startMs,
      endMs: startMs + (ev.dDurationMs ?? 0),
      text,
      lang,
    });
  }
  return cues;
}
