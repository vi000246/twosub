import { describe, it, expect } from 'vitest';
import { shouldActivate } from './activate';
import { DEFAULT_SETTINGS } from '../types/settings';

describe('shouldActivate', () => {
  it('requires both the global toggle and the platform toggle', () => {
    expect(shouldActivate(DEFAULT_SETTINGS, 'netflix')).toBe(true);
    expect(shouldActivate({ ...DEFAULT_SETTINGS, enabled: false }, 'netflix')).toBe(false);
    expect(
      shouldActivate(
        { ...DEFAULT_SETTINGS, platforms: { ...DEFAULT_SETTINGS.platforms, netflix: false } },
        'netflix',
      ),
    ).toBe(false);
  });
});
