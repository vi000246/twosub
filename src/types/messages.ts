import type { Settings } from './settings';

export interface CueText {
  id: string;
  text: string;
}

// content ↔ background contract (mirrors SRS › API Contracts). `v` bumps on breaking change.
export type Msg =
  | { v: 1; type: 'TRANSLATE_CUES'; payload: { cues: CueText[]; src: 'en'; tgt: 'zh' } }
  | { v: 1; type: 'LOOKUP_WORD'; payload: { word: string; sentence: string; src: 'en'; tgt: 'zh' } } // M2
  | { v: 1; type: 'GET_SETTINGS'; payload: Record<string, never> };

export interface MsgResult {
  TRANSLATE_CUES: { translations: CueText[] };
  LOOKUP_WORD: { meaning: string; lemma?: string; pos?: string };
  GET_SETTINGS: Settings;
}
