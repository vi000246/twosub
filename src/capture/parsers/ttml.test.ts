import { describe, it, expect } from 'vitest';
import { parseTtml, ttmlToMs } from './ttml';

describe('parseTtml', () => {
  it('parses <p begin end> with clock times and <br/>', () => {
    const ttml = `<tt><body><div>
      <p begin="00:00:01.000" end="00:00:02.500">Hi<br/>there</p>
      <p begin="00:00:03" end="00:00:04">Next</p>
    </div></body></tt>`;
    const cues = parseTtml(ttml, 'en');
    expect(cues[0]).toMatchObject({ startMs: 1000, endMs: 2500, text: 'Hi there' });
    expect(cues[1]).toMatchObject({ startMs: 3000, endMs: 4000, text: 'Next' });
  });

  it('ttmlToMs handles clock and offset forms', () => {
    expect(ttmlToMs('00:00:02')).toBe(2000);
    expect(ttmlToMs('1.5s')).toBe(1500);
    expect(ttmlToMs('250ms')).toBe(250);
    expect(ttmlToMs('bogus')).toBeNull();
  });
});
