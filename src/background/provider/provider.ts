export type ProviderErrorCode = 'PROVIDER_NO_KEY' | 'PROVIDER_RATE_LIMITED' | 'PROVIDER_ERROR';

export class ProviderError extends Error {
  constructor(
    public code: ProviderErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ProviderError';
  }
}

export interface WordMeaning {
  meaning: string;
  lemma?: string;
  pos?: string;
}

// Pluggable translation backend. GeminiProvider is the only v1 implementation.
export interface TranslationProvider {
  translateBatch(lines: string[], src: string, tgt: string): Promise<string[]>;
  lookupWord(word: string, sentence: string, src: string, tgt: string): Promise<WordMeaning>; // M2
}
