import type { Settings } from './settings';

export interface CueText {
  id: string;
  text: string;
}

export interface DictResult {
  phonetic?: string;
  audio?: string; // British (-uk.mp3) pronunciation recording from dictionaryapi.dev, when available
  meanings: Array<{ pos: string; defs: Array<{ def: string; example?: string }> }>;
  error?: string;
}

// content ↔ background contract (mirrors SRS › API Contracts). `v` bumps on breaking change.
export type Msg =
  | { v: 1; type: 'TRANSLATE_CUES'; payload: { cues: CueText[]; src: 'en'; tgt: 'zh' } }
  | { v: 1; type: 'LOOKUP_WORD'; payload: { word: string; sentence: string; src: 'en'; tgt: 'zh' } } // M2
  | { v: 1; type: 'DICT_LOOKUP'; payload: { word: string } }
  | { v: 1; type: 'FETCH_AUDIO'; payload: { url: string } }
  | { v: 1; type: 'GET_SETTINGS'; payload: Record<string, never> };

export interface MsgResult {
  TRANSLATE_CUES: { translations: CueText[]; error?: string };
  LOOKUP_WORD: { meaning: string; lemma?: string; pos?: string; error?: string };
  DICT_LOOKUP: DictResult;
  FETCH_AUDIO: { b64?: string; error?: string }; // pronunciation mp3 as base64 (fetched in bg)
  GET_SETTINGS: Settings;
}
