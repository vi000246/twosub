import type { TrackMeta } from '../types/cue';

export interface TrackSelection {
  learningLang: string;
  nativeLang: string;
  hasNativeTrack: boolean;
  needsTranslation: boolean;
}

// Native-first decision (SRS AC-2): if the title carries a track in the user's native
// language, pair it directly; otherwise the native line must be AI-translated.
export function selectTracks(
  tracks: TrackMeta[],
  learningLang = 'en',
  nativeLang = 'zh',
): TrackSelection {
  const has = (lang: string) => tracks.some((t) => t.lang.toLowerCase().startsWith(lang));
  const hasNativeTrack = has(nativeLang);
  return { learningLang, nativeLang, hasNativeTrack, needsTranslation: !hasNativeTrack };
}
