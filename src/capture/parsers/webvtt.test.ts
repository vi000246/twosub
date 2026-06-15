import { describe, it, expect } from 'vitest';
import { parseWebVtt } from './webvtt';

describe('parseWebVtt', () => {
  it('parses cues with ms timings and strips tags + cue settings', () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:02.500
Hello <c>world</c>

2
00:00:03.000 --> 00:00:04.000 align:start position:50%
Second line`;
    const cues = parseWebVtt(vtt, 'en');
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ startMs: 1000, endMs: 2500, text: 'Hello world', lang: 'en' });
    expect(cues[1]).toMatchObject({ startMs: 3000, endMs: 4000, text: 'Second line' });
  });

  it('handles MM:SS.mmm and comma decimals', () => {
    const cues = parseWebVtt('WEBVTT\n\n00:01,000 --> 00:02,000\nHi', 'en');
    expect(cues[0]).toMatchObject({ startMs: 1000, endMs: 2000 });
  });

  it('skips the header and empty cues', () => {
    expect(parseWebVtt('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n   ', 'en')).toHaveLength(0);
  });
});
