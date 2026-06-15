export function ttsAvailable(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    'speechSynthesis' in globalThis &&
    typeof (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance !==
      'undefined'
  );
}

function synthOf(): SpeechSynthesis | null {
  return ttsAvailable()
    ? (globalThis as unknown as { speechSynthesis: SpeechSynthesis }).speechSynthesis
    : null;
}

const FEMALE =
  /female|kate|serena|stephanie|martha|fiona|sonia|libby|hazel|amelie|samantha|google uk english female/i;
const MALE = /\bmale\b|daniel|oliver|arthur|george|google uk english male/i;

// Pick a voice: explicit URI if set, else a nice en-GB female, else any en-GB / en.
export function pickVoice(preferredURI = ''): SpeechSynthesisVoice | null {
  const voices = synthOf()?.getVoices?.() ?? [];
  if (!voices.length) return null;
  if (preferredURI) {
    const v = voices.find((x) => x.voiceURI === preferredURI);
    if (v) return v;
  }
  const enGB = voices.filter((v) => /^en[-_]?gb/i.test(v.lang));
  return (
    enGB.find((v) => FEMALE.test(v.name)) ??
    enGB.find((v) => !MALE.test(v.name)) ??
    enGB[0] ??
    voices.find((v) => /^en/i.test(v.lang)) ??
    null
  );
}

export function speak(text: string, rate = 0.9, lang = 'en-GB', voiceURI = ''): boolean {
  const synth = synthOf();
  if (!synth) return false;
  const Utterance = (
    globalThis as unknown as { SpeechSynthesisUtterance: typeof SpeechSynthesisUtterance }
  ).SpeechSynthesisUtterance;
  synth.cancel();
  const u = new Utterance(text);
  u.rate = rate;
  const voice = pickVoice(voiceURI);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = lang;
  }
  synth.speak(u);
  return true;
}

// English voices for the options dropdown.
export function listEnglishVoices(): Array<{ uri: string; label: string }> {
  const voices = synthOf()?.getVoices?.() ?? [];
  return voices
    .filter((v) => /^en/i.test(v.lang))
    .map((v) => ({ uri: v.voiceURI, label: `${v.name} (${v.lang})` }));
}
