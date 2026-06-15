// Normalized subtitle currency shared between capture, sync, and overlay.
export interface Cue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  lang: string;
}

// Metadata about a subtitle track discovered by a sniffer.
export interface TrackMeta {
  lang: string;
  kind: 'native' | 'cc' | 'forced' | 'asr';
  label?: string;
  url?: string;
}

export type Platform = 'netflix' | 'youtube' | 'hboMax';
