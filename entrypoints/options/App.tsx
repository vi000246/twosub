import { useEffect, useState, type CSSProperties } from 'react';
import { getSettings, setSettings } from '../../src/core/settings';
import { validateSettings } from '../../src/ui/validate';
import type { Settings } from '../../src/types/settings';

const PLATFORMS: Array<{ key: keyof Settings['platforms']; label: string; disabled?: boolean }> = [
  { key: 'netflix', label: 'Netflix' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'hboMax', label: 'HBO Max (best-effort)' },
];

export function App() {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    void getSettings().then(setS);
  }, []);
  if (!s) return <p style={{ padding: 16 }}>Loading…</p>;

  const update = (next: Settings) => {
    const v = validateSettings(next);
    setS(v);
    void setSettings(v);
  };
  const ap = (patch: Partial<Settings['appearance']>) =>
    update({ ...s, appearance: { ...s.appearance, ...patch } });

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 20 }}>TwoSub Settings</h1>

      <section style={card}>
        <h2 style={h2}>Translation (Gemini)</h2>
        <label style={row}>
          API key
          <input
            type="password"
            value={s.provider.apiKey}
            placeholder="AIza…"
            style={input}
            onChange={(e) => update({ ...s, provider: { ...s.provider, apiKey: e.target.value } })}
          />
        </label>
        <label style={row}>
          Model
          <select
            value={s.provider.model}
            style={input}
            onChange={(e) => update({ ...s, provider: { ...s.provider, model: e.target.value } })}
          >
            <option value="gemini-2.5-flash">gemini-2.5-flash (balanced)</option>
            <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (cheapest)</option>
            <option value="gemini-2.5-pro">gemini-2.5-pro (quality)</option>
          </select>
        </label>
        <p style={hint}>
          Stored locally, only ever sent to Google. Get a key at aistudio.google.com. Needed only
          when a title has no native Chinese subtitle.
        </p>
      </section>

      <section style={card}>
        <h2 style={h2}>Appearance</h2>
        <label style={row}>
          Font size — {s.appearance.fontSizePx}px
          <input
            type="range"
            min={14}
            max={60}
            value={s.appearance.fontSizePx}
            onChange={(e) => ap({ fontSizePx: Number(e.target.value) })}
          />
        </label>
        <label style={row}>
          Background — {Math.round(s.appearance.bgOpacity * 100)}%
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(s.appearance.bgOpacity * 100)}
            onChange={(e) => ap({ bgOpacity: Number(e.target.value) / 100 })}
          />
        </label>
        <label style={row}>
          Text color
          <input
            type="color"
            value={s.appearance.textColor}
            onChange={(e) => ap({ textColor: e.target.value })}
          />
        </label>
        <label style={row}>
          Position
          <select
            value={s.appearance.position}
            style={input}
            onChange={(e) => ap({ position: e.target.value as Settings['appearance']['position'] })}
          >
            <option value="bottom">Bottom</option>
            <option value="top">Top</option>
            <option value="custom">Custom offset</option>
          </select>
        </label>
        {s.appearance.position === 'custom' && (
          <label style={row}>
            Offset Y — {s.appearance.offsetY}px
            <input
              type="range"
              min={-200}
              max={200}
              value={s.appearance.offsetY}
              onChange={(e) => ap({ offsetY: Number(e.target.value) })}
            />
          </label>
        )}
        <label style={row}>
          English on top
          <input
            type="checkbox"
            checked={s.languages.learningOnTop}
            onChange={(e) =>
              update({ ...s, languages: { ...s.languages, learningOnTop: e.target.checked } })
            }
          />
        </label>
      </section>

      <section style={card}>
        <h2 style={h2}>Platforms</h2>
        {PLATFORMS.map((p) => (
          <label key={p.key} style={row}>
            {p.label}
            <input
              type="checkbox"
              checked={s.platforms[p.key]}
              disabled={p.disabled}
              onChange={(e) =>
                update({ ...s, platforms: { ...s.platforms, [p.key]: e.target.checked } })
              }
            />
          </label>
        ))}
      </section>
    </div>
  );
}

const wrap: CSSProperties = {
  fontFamily: 'system-ui, sans-serif',
  maxWidth: 560,
  margin: '0 auto',
  padding: 24,
  color: '#111',
};
const card: CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 16,
  margin: '16px 0',
};
const h2: CSSProperties = { fontSize: 15, margin: '0 0 12px' };
const row: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  margin: '8px 0',
  fontSize: 14,
};
const input: CSSProperties = { flex: '0 0 260px' };
const hint: CSSProperties = { fontSize: 12, color: '#666', margin: '8px 0 0' };
