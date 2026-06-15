import { describe, it, expect, vi } from 'vitest';
import { makeWordLookup } from './wordlookup';
import type { TranslationProvider } from './provider/provider';

function fakeProvider(calls: string[]): TranslationProvider {
  return {
    translateBatch: vi.fn(),
    lookupWord: vi.fn(async (word: string) => {
      calls.push(word);
      return { meaning: 'M:' + word };
    }),
  } as unknown as TranslationProvider;
}

describe('makeWordLookup', () => {
  it('caches by word+sentence so a repeat skips the provider', async () => {
    const calls: string[] = [];
    const wl = makeWordLookup(fakeProvider(calls), 'm');
    const a = await wl.lookup('run', 'I run', 'en', 'zh');
    const b = await wl.lookup('run', 'I run', 'en', 'zh');
    expect(a).toEqual({ meaning: 'M:run' });
    expect(b).toEqual({ meaning: 'M:run' });
    expect(calls).toEqual(['run']); // second served from cache
  });

  it('treats a different sentence as a different lookup', async () => {
    const calls: string[] = [];
    const wl = makeWordLookup(fakeProvider(calls), 'm');
    await wl.lookup('run', 'I run', 'en', 'zh');
    await wl.lookup('run', 'they run', 'en', 'zh');
    expect(calls).toEqual(['run', 'run']);
  });
});
