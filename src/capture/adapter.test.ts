import { describe, it, expect } from 'vitest';
import { selectTracks } from './adapter';

describe('selectTracks', () => {
  it('uses the native track when the title provides one', () => {
    const sel = selectTracks([
      { lang: 'en', kind: 'native' },
      { lang: 'zh-TW', kind: 'native' },
    ]);
    expect(sel.hasNativeTrack).toBe(true);
    expect(sel.needsTranslation).toBe(false);
  });

  it('flags translation when only the learning track exists', () => {
    expect(selectTracks([{ lang: 'en', kind: 'native' }]).needsTranslation).toBe(true);
  });
});
