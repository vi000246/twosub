import { describe, it, expect, vi } from 'vitest';
import { makeOrchestrator } from './orchestrator';
import type { TranslationProvider } from './provider/provider';

function fakeProvider(calls: string[][]): TranslationProvider {
  return {
    translateBatch: vi.fn(async (lines: string[]) => {
      calls.push(lines);
      return lines.map((l) => 'zh:' + l);
    }),
    lookupWord: vi.fn(),
  } as unknown as TranslationProvider;
}

describe('makeOrchestrator', () => {
  it('translates only uncached lines and preserves input order', async () => {
    const calls: string[][] = [];
    const orch = makeOrchestrator(fakeProvider(calls), 'm');
    await orch.translate([{ id: '1', text: 'a' }], 'en', 'zh');
    const out = await orch.translate(
      [
        { id: '1', text: 'a' },
        { id: '2', text: 'b' },
      ],
      'en',
      'zh',
    );
    expect(calls).toEqual([['a'], ['b']]); // 'a' came from cache the second time
    expect(out).toEqual([
      { id: '1', text: 'zh:a' },
      { id: '2', text: 'zh:b' },
    ]);
  });

  it('returns an empty list unchanged', async () => {
    const orch = makeOrchestrator(fakeProvider([]), 'm');
    expect(await orch.translate([], 'en', 'zh')).toEqual([]);
  });
});
