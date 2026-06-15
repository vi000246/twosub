import type { Platform } from './cue';

export const SCHEMA_VERSION = 1;

export interface Settings {
  enabled: boolean;
  platforms: Record<Platform, boolean>;
  languages: { learning: 'en'; native: 'zh'; learningOnTop: boolean };
  appearance: {
    fontSizePx: number;
    bgOpacity: number; // 0..1
    textColor: string; // hex
    position: 'bottom' | 'top' | 'custom';
    offsetY: number; // px, when position = custom
    fontEn: string; // CSS font-family for the English line
    fontZh: string; // CSS font-family for the Chinese line
  };
  provider: { name: 'gemini'; apiKey: string; model: string };
  // populated now, consumed in M2 (word lookup + TTS)
  lookup: { source: 'gemini'; ttsEnabled: boolean; ttsRate: number; voiceURI: string };
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  platforms: { netflix: true, youtube: true, hboMax: true },
  languages: { learning: 'en', native: 'zh', learningOnTop: true },
  appearance: {
    fontSizePx: 26,
    bgOpacity: 0.55,
    textColor: '#ffffff',
    position: 'bottom',
    offsetY: 0,
    fontEn: 'system-ui, sans-serif',
    fontZh: '"PingFang TC", "Microsoft JhengHei", system-ui, sans-serif',
  },
  provider: { name: 'gemini', apiKey: '', model: 'gemini-2.5-flash' },
  lookup: { source: 'gemini', ttsEnabled: true, ttsRate: 0.9, voiceURI: '' },
};
