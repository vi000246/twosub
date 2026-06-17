import type { Appearance } from '../types/settings';

export interface CssVars {
  '--ts-font-size': string;
  '--ts-bg': string;
  '--ts-color': string;
  '--ts-offset-y': string;
  '--ts-font-en': string;
  '--ts-font-zh': string;
}

// Map appearance settings to the CSS custom properties the overlay reads.
export function settingsToCssVars(a: Appearance): CssVars {
  return {
    '--ts-font-size': `${a.fontSizePx}px`,
    '--ts-bg': `rgba(0, 0, 0, ${clamp01(a.bgOpacity)})`,
    '--ts-color': a.textColor,
    '--ts-offset-y': `${a.position === 'custom' ? a.offsetY : 0}px`,
    '--ts-font-en': a.fontEn,
    '--ts-font-zh': a.fontZh,
  };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
