import { describe, it, expect } from 'vitest';
import { parseYtJson3 } from './ytjson3';

describe('parseYtJson3', () => {
  it('joins multi-seg utf8 and drops whitespace-only events', () => {
    const data = {
      events: [
        { tStartMs: 1000, dDurationMs: 1500, segs: [{ utf8: 'Hi ' }, { utf8: 'there' }] },
        { tStartMs: 3000, dDurationMs: 1000, segs: [{ utf8: '\n' }] },
        { tStartMs: 5000, segs: [{ utf8: 'No dur' }] },
      ],
    };
    const cues = parseYtJson3(data, 'en');
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ startMs: 1000, endMs: 2500, text: 'Hi there', lang: 'en' });
    expect(cues[1]).toMatchObject({ startMs: 5000, endMs: 5000, text: 'No dur' });
  });

  it('accepts a raw JSON string', () => {
    const raw = JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 500, segs: [{ utf8: 'x' }] }] });
    expect(parseYtJson3(raw, 'en')[0]).toMatchObject({ startMs: 0, endMs: 500, text: 'x' });
  });
});
