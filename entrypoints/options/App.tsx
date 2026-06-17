import { useEffect, useState, type CSSProperties } from 'react';
import { getSettings, setSettings } from '../../src/core/settings';
import { validateSettings } from '../../src/ui/validate';
import type { Settings } from '../../src/types/settings';
import { speak } from '../../src/overlay/tts';

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
  {
    label: '黑體（蘋方／微軟正黑）',
    value: '"PingFang TC", "Microsoft JhengHei", "Heiti TC", sans-serif',
  },
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
  const [target, setTarget] = useState<'default' | keyof Settings['platforms']>('default');
  if (!s) return <p style={{ padding: 16 }}>Loading…</p>;

  const update = (next: Settings) => {
    const v = validateSettings(next);
    setS(v);
    void setSettings(v);
  };

  // Appearance editing is scoped to the dropdown target: 'default' edits the base look applied to
  // every platform; a platform target edits that platform's override (null until enabled).
  const platformTarget = target === 'default' ? null : target;
  const isDefault = platformTarget === null;
  const override = platformTarget ? s.platformAppearance[platformTarget] : null;
  const usingCustom = isDefault || override !== null;
  const view = override ?? s.appearance; // what the editor currently shows
  const ap = (patch: Partial<Settings['appearance']>) => {
    if (platformTarget === null) {
      update({ ...s, appearance: { ...s.appearance, ...patch } });
    } else {
      const base = s.platformAppearance[platformTarget] ?? s.appearance;
      update({
        ...s,
        platformAppearance: { ...s.platformAppearance, [platformTarget]: { ...base, ...patch } },
      });
    }
  };
  const setOverride = (on: boolean) => {
    if (platformTarget === null) return;
    update({
      ...s,
      platformAppearance: {
        ...s.platformAppearance,
        [platformTarget]: on ? { ...s.appearance } : null,
      },
    });
  };

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
        <h2 style={h2}>Appearance · 字幕外觀</h2>
        <label style={row}>
          調整對象 (Platform)
          <select
            value={target}
            style={input}
            onChange={(e) => setTarget(e.target.value as typeof target)}
          >
            <option value="default">預設（套用所有平台）</option>
            <option value="netflix">Netflix</option>
            <option value="youtube">YouTube</option>
            <option value="hboMax">HBO Max</option>
          </select>
        </label>
        {!isDefault && (
          <label style={row}>
            為此平台單獨設定（覆蓋預設）
            <input
              type="checkbox"
              checked={override !== null}
              onChange={(e) => setOverride(e.target.checked)}
            />
          </label>
        )}
        {!isDefault && override === null && (
          <p style={hint}>
            此平台目前沿用「預設」外觀。勾選上方即可單獨調整字體、位置、背景與顏色。
          </p>
        )}

        <fieldset
          disabled={!usingCustom}
          style={{ border: 'none', padding: 0, margin: 0, opacity: usingCustom ? 1 : 0.45 }}
        >
          <label style={row}>
            Font size — {view.fontSizePx}px
            <input
              type="range"
              min={14}
              max={60}
              value={view.fontSizePx}
              onChange={(e) => ap({ fontSizePx: Number(e.target.value) })}
            />
          </label>
          <label style={row}>
            Background — {Math.round(view.bgOpacity * 100)}%
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(view.bgOpacity * 100)}
              onChange={(e) => ap({ bgOpacity: Number(e.target.value) / 100 })}
            />
          </label>
          <label style={row}>
            Text color
            <input
              type="color"
              value={view.textColor}
              onChange={(e) => ap({ textColor: e.target.value })}
            />
          </label>
          <label style={row}>
            Position
            <select
              value={view.position}
              style={input}
              onChange={(e) =>
                ap({ position: e.target.value as Settings['appearance']['position'] })
              }
            >
              <option value="bottom">Bottom（自動避開控制列）</option>
              <option value="top">Top</option>
              <option value="custom">Custom offset（手動微調）</option>
            </select>
          </label>
          {view.position === 'custom' && (
            <label style={row}>
              Offset Y — {view.offsetY}px
              <input
                type="range"
                min={-200}
                max={200}
                value={view.offsetY}
                onChange={(e) => ap({ offsetY: Number(e.target.value) })}
              />
            </label>
          )}
          <label style={row}>
            English font
            <select
              value={view.fontEn}
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
              value={view.fontZh}
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
        </fieldset>

        <label style={row}>
          English on top（所有平台）
          <input
            type="checkbox"
            checked={s.languages.learningOnTop}
            onChange={(e) =>
              update({ ...s, languages: { ...s.languages, learningOnTop: e.target.checked } })
            }
          />
        </label>
        <label style={row}>
          外語發音時只顯示中文（隱藏英文行）
          <input
            type="checkbox"
            checked={s.languages.foreignAudioChineseOnly}
            onChange={(e) =>
              update({
                ...s,
                languages: { ...s.languages, foreignAudioChineseOnly: e.target.checked },
              })
            }
          />
        </label>
      </section>

      <section style={card}>
        <h2 style={h2}>Pronunciation · 發音</h2>
        <p style={hint}>
          優先播放字典的英式錄音（dictionaryapi.dev），查無錄音時改用系統英式女聲。
        </p>
        <button
          style={{ cursor: 'pointer', padding: '6px 10px' }}
          onClick={() => speak('Hello, this is a test.', s.lookup.ttsRate)}
        >
          ▶ 測試語音
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
