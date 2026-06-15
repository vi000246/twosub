import type { Settings } from '../types/settings';

export interface CssVars {
  '--ts-font-size': string;
  '--ts-bg': string;
  '--ts-color': string;
  '--ts-offset-y': string;
}

// Map appearance settings to the CSS custom properties the overlay reads.
export function settingsToCssVars(a: Settings['appearance']): CssVars {
  return {
    '--ts-font-size': `${a.fontSizePx}px`,
    '--ts-bg': `rgba(0, 0, 0, ${clamp01(a.bgOpacity)})`,
    '--ts-color': a.textColor,
    '--ts-offset-y': `${a.position === 'custom' ? a.offsetY : 0}px`,
  };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
