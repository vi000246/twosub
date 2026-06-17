import type { Platform } from './cue';

export const SCHEMA_VERSION = 1;

export interface Appearance {
  fontSizePx: number;
  bgOpacity: number; // 0..1
  textColor: string; // hex
  position: 'bottom' | 'top' | 'custom';
  offsetY: number; // px, when position = custom
  fontEn: string; // CSS font-family for the English line
  fontZh: string; // CSS font-family for the Chinese line
}

export interface Settings {
  enabled: boolean;
  platforms: Record<Platform, boolean>;
  languages: {
    learning: 'en';
    native: 'zh';
    learningOnTop: boolean;
    // When the title's audio isn't English, hide the English line and show only Chinese. Off by
    // default — the audio heuristic detects the ORIGINAL language, not what the viewer selected.
    foreignAudioChineseOnly: boolean;
  };
  // The default look, applied to every platform unless that platform has its own override below.
  appearance: Appearance;
  // Per-platform overrides; null = inherit `appearance`. Lets the user tune each player separately.
  platformAppearance: Record<Platform, Appearance | null>;
  provider: { name: 'gemini'; apiKey: string; model: string };
  // populated now, consumed in M2 (word lookup + TTS)
  lookup: { source: 'gemini'; ttsEnabled: boolean; ttsRate: number };
}

export const DEFAULT_APPEARANCE: Appearance = {
  fontSizePx: 26,
  bgOpacity: 0.55,
  textColor: '#ffffff',
  position: 'bottom',
  offsetY: 0,
  fontEn: 'system-ui, sans-serif',
  fontZh: '"PingFang TC", "Microsoft JhengHei", system-ui, sans-serif',
};

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  platforms: { netflix: true, youtube: true, hboMax: true },
  languages: { learning: 'en', native: 'zh', learningOnTop: true, foreignAudioChineseOnly: false },
  appearance: { ...DEFAULT_APPEARANCE },
  platformAppearance: { netflix: null, youtube: null, hboMax: null },
  provider: { name: 'gemini', apiKey: '', model: 'gemini-2.5-flash' },
  lookup: { source: 'gemini', ttsEnabled: true, ttsRate: 0.9 },
};

// The look to actually render for a platform: its override merged over the default, so a stored
// override that predates a newly-added field still backfills that field from the default.
export function effectiveAppearance(s: Settings, platform: Platform): Appearance {
  const o = s.platformAppearance?.[platform];
  return o ? { ...s.appearance, ...o } : s.appearance;
}
