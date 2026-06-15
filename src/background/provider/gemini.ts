import { ProviderError, type TranslationProvider, type WordMeaning } from './provider';

const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const TGT_LABEL: Record<string, string> = { zh: 'Traditional Chinese (zh-TW)' };

export class GeminiProvider implements TranslationProvider {
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async translateBatch(lines: string[], src: string, tgt: string): Promise<string[]> {
    if (lines.length === 0) return [];
    const tgtLabel = TGT_LABEL[tgt] ?? tgt;
    const numbered = lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
    const prompt =
      `Translate each numbered ${src} subtitle line into ${tgtLabel}. ` +
      `Return ONLY a JSON array like [{"i":1,"t":"..."}] with exactly one entry per input line, ` +
      `preserving the numbering.\n\n${numbered}`;
    const text = await this.call(prompt);

    const arr = parseJsonArray(text);
    if (arr && arr.length === lines.length) {
      return arr
        .slice()
        .sort((a, b) => (a.i ?? 0) - (b.i ?? 0))
        .map((x) => String(x.t ?? ''));
    }
    // Fallback: newline split, strip "N." numbering.
    const fallback = text
      .split('\n')
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter((l) => l !== '');
    if (fallback.length === lines.length) return fallback;
    throw new ProviderError('PROVIDER_ERROR', 'Unexpected translation response shape');
  }

  async lookupWord(word: string, sentence: string, src: string, tgt: string): Promise<WordMeaning> {
    const tgtLabel = TGT_LABEL[tgt] ?? tgt;
    const prompt =
      `In the ${src} sentence "${sentence}", give the meaning of "${word}" in ${tgtLabel}. ` +
      `Return ONLY JSON {"meaning":"...","lemma":"...","pos":"..."}.`;
    const obj = parseJsonObject(await this.call(prompt));
    if (!obj || typeof obj.meaning !== 'string') {
      throw new ProviderError('PROVIDER_ERROR', 'Unexpected lookup response shape');
    }
    return { meaning: obj.meaning, lemma: str(obj.lemma), pos: str(obj.pos) };
  }

  private async call(prompt: string): Promise<string> {
    if (!this.apiKey) throw new ProviderError('PROVIDER_NO_KEY');
    let res: Response;
    try {
      res = await fetch(ENDPOINT(this.model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
      });
    } catch (e) {
      throw new ProviderError('PROVIDER_ERROR', `Network error: ${String(e)}`);
    }
    if (res.status === 429) throw new ProviderError('PROVIDER_RATE_LIMITED');
    if (!res.ok) throw new ProviderError('PROVIDER_ERROR', `HTTP ${res.status}`);
    const json: any = await res.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
}

function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}
function parseJsonArray(s: string): Array<{ i?: number; t?: string }> | null {
  try {
    const v = JSON.parse(stripFences(s));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}
function parseJsonObject(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(stripFences(s));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}
function str(x: unknown): string | undefined {
  return typeof x === 'string' && x ? x : undefined;
}
