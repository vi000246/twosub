import { describe, it, expect } from 'vitest';
import { pickCaptionTracks, ytFmtUrl } from './youtube';

describe('pickCaptionTracks', () => {
  it('extracts baseUrl + languageCode and flags asr', () => {
    const pr = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            { baseUrl: 'https://x/en', languageCode: 'en', name: { simpleText: 'English' } },
            { baseUrl: 'https://x/asr', languageCode: 'en', kind: 'asr' },
          ],
        },
      },
    };
    const t = pickCaptionTracks(pr);
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({
      lang: 'en',
      kind: 'native',
      url: 'https://x/en',
      label: 'English',
    });
    expect(t[1].kind).toBe('asr');
  });

  it('returns [] when there are no captions', () => {
    expect(pickCaptionTracks({})).toEqual([]);
  });
});

describe('ytFmtUrl', () => {
  it('adds fmt and optional tlang', () => {
    const u = ytFmtUrl('https://www.youtube.com/api/timedtext?v=1', 'json3', 'zh-TW');
    expect(u).toContain('fmt=json3');
    expect(u).toContain('tlang=zh-TW');
  });
});
