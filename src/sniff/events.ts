// Page(MAIN) ↔ content(ISOLATED) contract. MUST stay free of extension-API imports
// so it can be bundled into the injected MAIN-world sniffer scripts.
import type { Cue, TrackMeta } from '../types/cue';

export const CUES_EVENT = 'twosub:cues';
export const CMD_EVENT = 'twosub:command';

export interface CuesDetail {
  platform: string;
  tracks: TrackMeta[];
  cues: Cue[];
  videoId?: string; // SPA platforms (YouTube): lets the session reset cues on video change
}

export interface CommandDetail {
  selectTrack?: string; // lang to switch to
}
