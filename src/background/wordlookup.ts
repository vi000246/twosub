import { Lru } from '../core/lru';
import type { TranslationProvider, WordMeaning } from './provider/provider';

export function wordKey(word: string, sentence: string, tgt: string, model: string): string {
  return `${tgt}|${model}|${word.toLowerCase()}|${sentence}`;
}

export interface WordLookup {
  lookup(word: string, sentence: string, src: string, tgt: string): Promise<WordMeaning>;
}

// Contextual single-word lookup, cached by word+sentence so the same word in a different
// sentence is looked up fresh (idioms/phrasal verbs depend on context).
export function makeWordLookup(
  provider: TranslationProvider,
  model: string,
  cache: Lru<WordMeaning> = new Lru<WordMeaning>(2000),
): WordLookup {
  return {
    async lookup(word, sentence, src, tgt) {
      const key = wordKey(word, sentence, tgt, model);
      const hit = cache.get(key);
      if (hit) return hit;
      const r = await provider.lookupWord(word, sentence, src, tgt);
      cache.set(key, r);
      return r;
    },
  };
}
