import { describe, it, expect, vi, afterEach } from 'vitest';
import { GeminiProvider } from './gemini';

function mockGemini(text: string, status = 200) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status }),
  );
}

describe('GeminiProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('translateBatch parses a JSON array and orders by index', async () => {
    vi.stubGlobal('fetch', mockGemini('[{"i":2,"t":"二"},{"i":1,"t":"一"}]'));
    const out = await new GeminiProvider('k', 'gemini-2.5-flash').translateBatch(
      ['one', 'two'],
      'en',
      'zh',
    );
    expect(out).toEqual(['一', '二']);
  });

  it('strips ```json fences', async () => {
    vi.stubGlobal('fetch', mockGemini('```json\n[{"i":1,"t":"你好"}]\n```'));
    expect(await new GeminiProvider('k', 'm').translateBatch(['hi'], 'en', 'zh')).toEqual(['你好']);
  });

  it('falls back to newline split when JSON shape is off', async () => {
    vi.stubGlobal('fetch', mockGemini('1. 你好\n2. 再見'));
    expect(await new GeminiProvider('k', 'm').translateBatch(['hi', 'bye'], 'en', 'zh')).toEqual([
      '你好',
      '再見',
    ]);
  });

  it('maps HTTP 429 to PROVIDER_RATE_LIMITED', async () => {
    vi.stubGlobal('fetch', mockGemini('', 429));
    await expect(
      new GeminiProvider('k', 'm').translateBatch(['hi'], 'en', 'zh'),
    ).rejects.toMatchObject({ code: 'PROVIDER_RATE_LIMITED' });
  });

  it('throws PROVIDER_NO_KEY when the key is empty', async () => {
    await expect(
      new GeminiProvider('', 'm').translateBatch(['hi'], 'en', 'zh'),
    ).rejects.toMatchObject({ code: 'PROVIDER_NO_KEY' });
  });

  it('lookupWord returns a structured meaning', async () => {
    vi.stubGlobal('fetch', mockGemini('{"meaning":"蘋果","lemma":"apple","pos":"noun"}'));
    expect(
      await new GeminiProvider('k', 'm').lookupWord('apples', 'I ate apples', 'en', 'zh'),
    ).toEqual({ meaning: '蘋果', lemma: 'apple', pos: 'noun' });
  });
});
