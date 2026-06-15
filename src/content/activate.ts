import type { Settings } from '../types/settings';
import type { Platform } from '../types/cue';

// A platform's overlay runs only when both the global toggle and that platform are enabled.
export function shouldActivate(s: Settings, p: Platform): boolean {
  return s.enabled && s.platforms[p];
}
