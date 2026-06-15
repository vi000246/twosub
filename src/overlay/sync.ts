import type { Cue } from '../types/cue';

// Binary-search the cue active at time `t` (ms). Returns null in gaps / past the end.
// Assumes `cues` is sorted by startMs and roughly non-overlapping (the capture adapter sorts).
export function activeCueAt(cues: Cue[], t: number): Cue | null {
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = cues[mid];
    if (t < c.startMs) hi = mid - 1;
    else if (t >= c.endMs) lo = mid + 1;
    else return c;
  }
  return null;
}

// The next `count` cues that haven't finished before `t` — used to prefetch translations.
export function upcomingCues(cues: Cue[], t: number, count: number): Cue[] {
  const out: Cue[] = [];
  for (const c of cues) {
    if (c.endMs < t) continue;
    out.push(c);
    if (out.length >= count) break;
  }
  return out;
}
