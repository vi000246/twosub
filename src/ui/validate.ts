import type { Settings } from '../types/settings';

export function clamp(n: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

// Normalize user-entered settings to safe ranges before persisting.
export function validateSettings(s: Settings): Settings {
  return {
    ...s,
    appearance: {
      ...s.appearance,
      fontSizePx: Math.round(clamp(s.appearance.fontSizePx, 14, 60, 26)),
      bgOpacity: clamp(s.appearance.bgOpacity, 0, 1, 0.55),
      textColor: /^#[0-9a-fA-F]{3,8}$/.test(s.appearance.textColor)
        ? s.appearance.textColor
        : '#ffffff',
      offsetY: Math.round(clamp(s.appearance.offsetY, -300, 300, 0)),
    },
    provider: { ...s.provider, model: s.provider.model.trim() || 'gemini-2.5-flash' },
  };
}
