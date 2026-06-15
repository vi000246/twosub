import { describe, it, expect } from 'vitest';
import { validateSettings, clamp } from './validate';
import { DEFAULT_SETTINGS } from '../types/settings';

describe('validateSettings', () => {
  it('clamps size/opacity, rejects bad color, defaults empty model', () => {
    const out = validateSettings({
      ...DEFAULT_SETTINGS,
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        fontSizePx: 999,
        bgOpacity: 5,
        textColor: 'red',
      },
      provider: { ...DEFAULT_SETTINGS.provider, model: '   ' },
    });
    expect(out.appearance.fontSizePx).toBe(60);
    expect(out.appearance.bgOpacity).toBe(1);
    expect(out.appearance.textColor).toBe('#ffffff');
    expect(out.provider.model).toBe('gemini-2.5-flash');
  });

  it('clamp() falls back on non-finite input', () => {
    expect(clamp(NaN, 0, 10, 5)).toBe(5);
    expect(clamp(7, 0, 10, 5)).toBe(7);
  });
});
