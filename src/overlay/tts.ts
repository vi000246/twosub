import { sendMsg } from '../core/messaging';

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

// Hardcoded British female voice (no user selection): a en-GB female, else any en-GB non-male.
export function pickVoice(): SpeechSynthesisVoice | null {
  const voices = synthOf()?.getVoices?.() ?? [];
  if (!voices.length) return null;
  const enGB = voices.filter((v) => /^en[-_]?gb/i.test(v.lang));
  return (
    enGB.find((v) => FEMALE.test(v.name)) ??
    enGB.find((v) => !MALE.test(v.name)) ??
    enGB[0] ??
    voices.find((v) => /^en/i.test(v.lang)) ??
    null
  );
}

// Web-Speech fallback in a British female voice.
export function speak(text: string, rate = 0.9): boolean {
  const synth = synthOf();
  if (!synth) return false;
  const Utterance = (
    globalThis as unknown as { SpeechSynthesisUtterance: typeof SpeechSynthesisUtterance }
  ).SpeechSynthesisUtterance;
  synth.cancel();
  const u = new Utterance(text);
  u.rate = rate;
  const voice = pickVoice();
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = 'en-GB';
  }
  synth.speak(u);
  return true;
}

let audioCtx: AudioContext | null = null;
function ctx(): AudioContext | null {
  const AC =
    (globalThis as any).AudioContext ??
    (globalThis as { webkitAudioContext?: any }).webkitAudioContext;
  if (!AC) return null;
  try {
    audioCtx = audioCtx ?? new AC();
    return audioCtx;
  } catch {
    return null;
  }
}

// Decode + play raw mp3 bytes through Web Audio. No <audio>/resource load, so it's NOT subject to
// the streaming site's media-src CSP (which would block a direct Audio(url) on Netflix/HBO).
async function playBytes(b64: string): Promise<boolean> {
  const c = ctx();
  if (!c) return false;
  try {
    if (c.state === 'suspended') await c.resume();
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const buf = await c.decodeAudioData(bytes.buffer);
    synthOf()?.cancel();
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start();
    return true;
  } catch {
    return false;
  }
}

// Pronounce a word: play the dictionary's recorded British audio when available (fetched in the
// background to dodge CORS + page CSP), else fall back to the British-female Web-Speech voice.
export async function pronounce(
  audioUrl: string | undefined,
  word: string,
  rate = 0.9,
): Promise<void> {
  if (audioUrl) {
    try {
      const res = await sendMsg('FETCH_AUDIO', { url: audioUrl });
      if (res.b64 && (await playBytes(res.b64))) return;
    } catch {
      /* fall through to speech */
    }
  }
  speak(word, rate);
}
