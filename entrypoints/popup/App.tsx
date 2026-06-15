import { useEffect, useState, type CSSProperties } from 'react';
import { browser } from 'wxt/browser';
import { getSettings, setSettings } from '../../src/core/settings';
import type { Settings } from '../../src/types/settings';

export function App() {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    void getSettings().then(setS);
  }, []);
  if (!s) return <div style={{ padding: 12, width: 240 }}>Loading…</div>;

  const save = (next: Settings) => {
    setS(next);
    void setSettings(next);
  };

  return (
    <div style={{ width: 260, padding: 12, fontFamily: 'system-ui, sans-serif', color: '#111' }}>
      <label style={{ ...row, fontWeight: 600 }}>
        TwoSub
        <input
          type="checkbox"
          checked={s.enabled}
          onChange={(e) => save({ ...s, enabled: e.target.checked })}
        />
      </label>
      <hr />
      {(['netflix', 'youtube', 'hboMax'] as const).map((p) => (
        <label key={p} style={row}>
          {{ netflix: 'Netflix', youtube: 'YouTube', hboMax: 'HBO Max' }[p]}
          <input
            type="checkbox"
            checked={s.platforms[p]}
            disabled={!s.enabled}
            onChange={(e) => save({ ...s, platforms: { ...s.platforms, [p]: e.target.checked } })}
          />
        </label>
      ))}
      <p style={{ fontSize: 12, margin: '10px 0', color: s.provider.apiKey ? '#2a7d2a' : '#c33' }}>
        {s.provider.apiKey ? '✓ Gemini key set' : '⚠ No Gemini key — open settings'}
      </p>
      <button style={btn} onClick={() => void browser.runtime.openOptionsPage()}>
        Open settings
      </button>
    </div>
  );
}

const row: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  margin: '6px 0',
  fontSize: 14,
};
const btn: CSSProperties = { width: '100%', padding: 8, cursor: 'pointer' };
