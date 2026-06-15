import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { getSettings, setSettings, migrate } from './settings';
import { DEFAULT_SETTINGS } from '../types/settings';

describe('settings', () => {
  beforeEach(() => fakeBrowser.reset());

  it('returns defaults when storage is empty', async () => {
    expect((await getSettings()).provider.model).toBe('gemini-2.5-flash');
  });

  it('migrate() backfills new fields and preserves user values', () => {
    const m = migrate({ schemaVersion: 0, settings: { enabled: false } as never });
    expect(m.settings.enabled).toBe(false);
    expect(m.settings.appearance.fontSizePx).toBe(DEFAULT_SETTINGS.appearance.fontSizePx);
    expect(m.schemaVersion).toBe(1);
  });

  it('persists and reads back the API key', async () => {
    await setSettings({
      ...DEFAULT_SETTINGS,
      provider: { ...DEFAULT_SETTINGS.provider, apiKey: 'k' },
    });
    expect((await getSettings()).provider.apiKey).toBe('k');
  });
});
