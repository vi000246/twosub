import { describe, it, expect } from 'vitest';
import { activeCueAt, upcomingCues } from './sync';
import type { Cue } from '../types/cue';

const cues: Cue[] = [
  { id: '1', startMs: 0, endMs: 1000, text: 'a', lang: 'en' },
  { id: '2', startMs: 1000, endMs: 2000, text: 'b', lang: 'en' },
  { id: '3', startMs: 3000, endMs: 4000, text: 'c', lang: 'en' },
];

describe('activeCueAt', () => {
  it('finds the cue containing the time', () => {
    expect(activeCueAt(cues, 1500)?.id).toBe('2');
    expect(activeCueAt(cues, 0)?.id).toBe('1');
    expect(activeCueAt(cues, 3999)?.id).toBe('3');
  });
  it('returns null in a gap and past the end', () => {
    expect(activeCueAt(cues, 2500)).toBeNull();
    expect(activeCueAt(cues, 9999)).toBeNull();
  });
});

describe('upcomingCues', () => {
  it('returns the next N cues from time t', () => {
    expect(upcomingCues(cues, 1200, 2).map((c) => c.id)).toEqual(['2', '3']);
  });
});
