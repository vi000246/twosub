import { describe, it, expect } from 'vitest';
import { pickTextTracks } from './netflix';

describe('pickTextTracks', () => {
  it('prefers webvtt and extracts a download url + kind', () => {
    const manifest = {
      timedtexttracks: [
        {
          language: 'en',
          languageDescription: 'English',
          rawTrackType: 'subtitles',
          ttDownloadables: { 'webvtt-lssdh-ios8': { downloadUrls: { cdn1: 'https://n/en.vtt' } } },
        },
        {
          language: 'zh-Hant',
          rawTrackType: 'subtitles',
          ttDownloadables: { 'dfxp-ls-sdh': { downloadUrls: { cdn1: 'https://n/zh.xml' } } },
        },
      ],
    };
    const t = pickTextTracks(manifest);
    expect(t[0]).toMatchObject({ lang: 'en', url: 'https://n/en.vtt', format: 'webvtt', kind: 'native' });
    expect(t[1]).toMatchObject({ lang: 'zh-Hant', url: 'https://n/zh.xml', format: 'ttml' });
  });

  it('skips tracks without downloadables', () => {
    expect(pickTextTracks({ timedtexttracks: [{ language: 'en' }] })).toEqual([]);
  });
});
