import { useEffect, useState, type CSSProperties } from 'react';
import { getSettings, setSettings } from '../../src/core/settings';
import { validateSettings } from '../../src/ui/validate';
import type { Settings } from '../../src/types/settings';
import { listEnglishVoices, speak } from '../../src/overlay/tts';

const PLATFORMS: Array<{ key: keyof Settings['platforms']; label: string; disabled?: boolean }> = [
  { key: 'netflix', label: 'Netflix' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'hboMax', label: 'HBO Max (best-effort)' },
];

const EN_FONTS = [
  { label: 'System default', value: 'system-ui, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica Neue', value: '"Helvetica Neue", Helvetica, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Georgia (serif)', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Times (serif)', value: '"Times New Roman", Times, serif' },
  { label: 'Courier (mono)', value: '"Courier New", Courier, monospace' },
];
const ZH_FONTS = [
  { label: '系統預設', value: 'system-ui, sans-serif' },
  { label: '黑體（蘋方／微軟正黑）', value: '"PingFang TC", "Microsoft JhengHei", "Heiti TC", sans-serif' },
  { label: '蘋方 PingFang', value: '"PingFang TC", sans-serif' },
  { label: '微軟正黑體', value: '"Microsoft JhengHei", sans-serif' },
  { label: '思源黑體 Noto Sans', value: '"Noto Sans TC", "Noto Sans CJK TC", sans-serif' },
  { label: '宋體／明體（serif）', value: '"Songti TC", "PMingLiU", serif' },
  { label: '楷體 Kai', value: '"Kaiti TC", "DFKai-SB", "BiauKai", serif' },
  { label: '圓體 Yuan', value: '"Yuanti TC", "Yuanti SC", sans-serif' },
];

export function App() {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    void getSettings().then(setS);
  }, []);
  const [voices, setVoices] = useState<Array<{ uri: string; label: string }>>([]);
  useEffect(() => {
    const load = () => setVoices(listEnglishVoices());
    load();
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.addEventListener('voiceschanged', load);
      return () => speechSynthesis.removeEventListener('voiceschanged', load);
    }
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
        <label style={row}>
          English font
          <select
            value={s.appearance.fontEn}
            style={input}
            onChange={(e) => ap({ fontEn: e.target.value })}
          >
            {EN_FONTS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label style={row}>
          Chinese font
          <select
            value={s.appearance.fontZh}
            style={input}
            onChange={(e) => ap({ fontZh: e.target.value })}
          >
            {ZH_FONTS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section style={card}>
        <h2 style={h2}>Pronunciation (word audio)</h2>
        <label style={row}>
          Voice
          <select
            value={s.lookup.voiceURI}
            style={input}
            onChange={(e) => update({ ...s, lookup: { ...s.lookup, voiceURI: e.target.value } })}
          >
            <option value="">Auto (British female)</option>
            {voices.map((v) => (
              <option key={v.uri} value={v.uri}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <button
          style={{ cursor: 'pointer', padding: '6px 10px' }}
          onClick={() =>
            speak('Hello, this is a test.', s.lookup.ttsRate, 'en-GB', s.lookup.voiceURI)
          }
        >
          ▶ Test voice
        </button>
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
