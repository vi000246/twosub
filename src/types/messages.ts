import type { Settings } from './settings';

export interface CueText {
  id: string;
  text: string;
}

export interface DictResult {
  phonetic?: string;
  meanings: Array<{ pos: string; defs: Array<{ def: string; example?: string }> }>;
  error?: string;
}

// content ↔ background contract (mirrors SRS › API Contracts). `v` bumps on breaking change.
export type Msg =
  | { v: 1; type: 'TRANSLATE_CUES'; payload: { cues: CueText[]; src: 'en'; tgt: 'zh' } }
  | { v: 1; type: 'LOOKUP_WORD'; payload: { word: string; sentence: string; src: 'en'; tgt: 'zh' } } // M2
  | { v: 1; type: 'DICT_LOOKUP'; payload: { word: string } }
  | { v: 1; type: 'GET_SETTINGS'; payload: Record<string, never> };

export interface MsgResult {
  TRANSLATE_CUES: { translations: CueText[]; error?: string };
  LOOKUP_WORD: { meaning: string; lemma?: string; pos?: string; error?: string };
  DICT_LOOKUP: DictResult;
  GET_SETTINGS: Settings;
}
