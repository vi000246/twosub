import { describe, it, expect, vi, afterEach } from 'vitest';
import { speak, ttsAvailable } from './tts';

afterEach(() => vi.unstubAllGlobals());

describe('tts', () => {
  it('returns false when speechSynthesis is unavailable', () => {
    expect(ttsAvailable()).toBe(false);
    expect(speak('hi')).toBe(false);
  });

  it('speaks via speechSynthesis when available', () => {
    const spoken: Array<{ text: string; rate: number; lang: string }> = [];
    vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak: (u: any) => spoken.push(u) });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        rate = 1;
        lang = '';
        constructor(public text: string) {}
      },
    );
    expect(speak('hello', 0.8, 'en-US')).toBe(true);
    expect(spoken[0]).toMatchObject({ text: 'hello', rate: 0.8, lang: 'en-US' });
  });
});
