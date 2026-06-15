// Pronounce a word/phrase via the Web Speech API. Returns false when TTS is unavailable
// (e.g. no voice installed) so callers can degrade gracefully.
export function ttsAvailable(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    'speechSynthesis' in globalThis &&
    typeof (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance !==
      'undefined'
  );
}

export function speak(text: string, rate = 0.9, lang = 'en-US'): boolean {
  if (!ttsAvailable()) return false;
  const synth = (globalThis as unknown as { speechSynthesis: SpeechSynthesis }).speechSynthesis;
  const Utterance = (globalThis as unknown as { SpeechSynthesisUtterance: typeof SpeechSynthesisUtterance })
    .SpeechSynthesisUtterance;
  synth.cancel();
  const u = new Utterance(text);
  u.rate = rate;
  u.lang = lang;
  synth.speak(u);
  return true;
}
