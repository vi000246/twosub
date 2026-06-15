import { onMsg } from '../core/messaging';
import { getSettings } from '../core/settings';
import { Lru, cueKey } from '../core/lru';
import { GeminiProvider } from './provider/gemini';
import { makeWordLookup } from './wordlookup';
import { ProviderError, type TranslationProvider, type WordMeaning } from './provider/provider';
import type { CueText, Msg } from '../types/messages';

export interface Orchestrator {
  translate(cues: CueText[], src: string, tgt: string): Promise<CueText[]>;
}

// Dedupe via cache, batch only the uncached lines to the provider, preserve input order.
// The native-vs-AI decision lives upstream (capture adapter) — this always translates
// what it's asked to.
export function makeOrchestrator(
  provider: TranslationProvider,
  model: string,
  cache: Lru<string> = new Lru<string>(4000),
): Orchestrator {
  return {
    async translate(cues, src, tgt) {
      const out: (string | null)[] = new Array(cues.length).fill(null);
      const misses: Array<{ idx: number; text: string }> = [];
      cues.forEach((c, idx) => {
        const cached = cache.get(cueKey(c.text, src, tgt, model));
        if (cached !== undefined) out[idx] = cached;
        else misses.push({ idx, text: c.text });
      });

      if (misses.length) {
        const translated = await provider.translateBatch(
          misses.map((m) => m.text),
          src,
          tgt,
        );
        misses.forEach((m, i) => {
          const t = translated[i] ?? '';
          cache.set(cueKey(m.text, src, tgt, model), t);
          out[m.idx] = t;
        });
      }
      return cues.map((c, idx) => ({ id: c.id, text: out[idx] ?? '' }));
    },
  };
}

// Background message handler. Settings are read per call so model/key edits take effect live.
export function registerHandlers(): void {
  const cache = new Lru<string>(4000);
  const wordCache = new Lru<WordMeaning>(2000);
  onMsg(async (msg: Msg): Promise<unknown> => {
    switch (msg.type) {
      case 'GET_SETTINGS':
        return getSettings();
      case 'TRANSLATE_CUES': {
        const s = await getSettings();
        const provider = new GeminiProvider(s.provider.apiKey, s.provider.model);
        const orch = makeOrchestrator(provider, s.provider.model, cache);
        try {
          const translations = await orch.translate(
            msg.payload.cues,
            msg.payload.src,
            msg.payload.tgt,
          );
          return { translations };
        } catch (e) {
          const error = e instanceof ProviderError ? e.code : 'PROVIDER_ERROR';
          // Non-fatal: empty translations + error code; overlay keeps the native English line.
          return { translations: [], error };
        }
      }
      case 'LOOKUP_WORD': {
        const s = await getSettings();
        const provider = new GeminiProvider(s.provider.apiKey, s.provider.model);
        const wl = makeWordLookup(provider, s.provider.model, wordCache);
        try {
          return await wl.lookup(
            msg.payload.word,
            msg.payload.sentence,
            msg.payload.src,
            msg.payload.tgt,
          );
        } catch (e) {
          const error = e instanceof ProviderError ? e.code : 'PROVIDER_ERROR';
          return { meaning: '', error };
        }
      }
      default:
        return undefined;
    }
  });
}
