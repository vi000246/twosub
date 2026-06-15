import { describe, it, expect } from 'vitest';
import { parseDashTextTracks } from './hbo';

const MPD = `<MPD>
  <BaseURL>https://cdn.hbo/base/</BaseURL>
  <Period start="PT0S">
    <AdaptationSet contentType="text" lang="en">
      <Label>English</Label>
      <Representation id="t1" mimeType="text/vtt">
        <SegmentTemplate media="sub_$Number$.vtt" startNumber="1" timescale="1000" presentationTimeOffset="0">
          <SegmentTimeline><S t="0" d="5000" r="2"/></SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
    <AdaptationSet contentType="text" lang="en">
      <Label>English (Forced)</Label>
      <Representation id="t2" mimeType="text/vtt">
        <SegmentTemplate media="forced_$Number$.vtt" startNumber="1" timescale="1000">
          <SegmentTimeline><S t="0" d="5000"/></SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

describe('parseDashTextTracks', () => {
  it('builds resolved segment URLs from SegmentTemplate + SegmentTimeline (r=2 → 3 segments)', () => {
    const tracks = parseDashTextTracks(MPD, 'https://cdn.hbo/manifest.mpd');
    const en = tracks.find((t) => t.lang === 'en');
    expect(en).toBeDefined();
    expect(en!.segmentUrls).toEqual([
      'https://cdn.hbo/base/sub_1.vtt',
      'https://cdn.hbo/base/sub_2.vtt',
      'https://cdn.hbo/base/sub_3.vtt',
    ]);
    expect(en!.timingShiftMs).toBe(0);
  });

  it('keeps one track per language, preferring non-forced', () => {
    const tracks = parseDashTextTracks(MPD, 'https://cdn.hbo/manifest.mpd');
    expect(tracks.filter((t) => t.lang === 'en')).toHaveLength(1);
    expect(tracks.find((t) => t.lang === 'en')!.kind).toBe('native');
  });

  it('zero-pads $Number%04d$ and applies presentationTimeOffset shift', () => {
    const mpd = `<MPD><Period start="PT10S">
      <AdaptationSet mimeType="text/vtt" lang="zh">
        <SegmentTemplate media="z_$Number%04d$.vtt" startNumber="5" timescale="1000" presentationTimeOffset="2000">
          <SegmentTimeline><S t="0" d="1000"/></SegmentTimeline>
        </SegmentTemplate>
      </AdaptationSet></Period></MPD>`;
    const t = parseDashTextTracks(mpd, 'https://cdn.hbo/x/manifest.mpd');
    expect(t[0].segmentUrls).toEqual(['https://cdn.hbo/x/z_0005.vtt']);
    expect(t[0].timingShiftMs).toBe(10000 - 2000); // periodStart 10s - pto 2000/1000 s
  });
});
