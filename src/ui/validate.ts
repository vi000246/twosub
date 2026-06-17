import type { Appearance, Settings } from '../types/settings';
import type { Platform } from '../types/cue';

export function clamp(n: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

// Normalize one appearance block to safe ranges.
export function validateAppearance(a: Appearance): Appearance {
  return {
    ...a,
    fontSizePx: Math.round(clamp(a.fontSizePx, 14, 60, 26)),
    bgOpacity: clamp(a.bgOpacity, 0, 1, 0.55),
    textColor: /^#[0-9a-fA-F]{3,8}$/.test(a.textColor) ? a.textColor : '#ffffff',
    offsetY: Math.round(clamp(a.offsetY, -300, 300, 0)),
    fontEn: a.fontEn?.trim() || 'system-ui, sans-serif',
    fontZh: a.fontZh?.trim() || '"PingFang TC", "Microsoft JhengHei", system-ui, sans-serif',
  };
}

// Normalize user-entered settings to safe ranges before persisting.
export function validateSettings(s: Settings): Settings {
  const platformAppearance = { ...s.platformAppearance } as Record<Platform, Appearance | null>;
  for (const k of Object.keys(platformAppearance) as Platform[]) {
    const a = platformAppearance[k];
    platformAppearance[k] = a ? validateAppearance(a) : null;
  }
  return {
    ...s,
    appearance: validateAppearance(s.appearance),
    platformAppearance,
    provider: { ...s.provider, model: s.provider.model.trim() || 'gemini-2.5-flash' },
  };
}
