import { storage } from 'wxt/utils/storage';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, type Settings } from '../types/settings';

export interface Stored {
  schemaVersion: number;
  settings: Settings;
}

export const storedItem = storage.defineItem<Stored>('local:twosub', {
  fallback: { schemaVersion: SCHEMA_VERSION, settings: DEFAULT_SETTINGS },
});

// Deep-merge DEFAULT_SETTINGS under stored values so new fields backfill on upgrade
// without wiping user choices.
export function migrate(raw: Partial<Stored> | null | undefined): Stored {
  const settings = deepMerge(DEFAULT_SETTINGS, raw?.settings ?? {}) as Settings;
  return { schemaVersion: SCHEMA_VERSION, settings };
}

export async function getSettings(): Promise<Settings> {
  return migrate(await storedItem.getValue()).settings;
}

export async function setSettings(next: Settings): Promise<void> {
  await storedItem.setValue({ schemaVersion: SCHEMA_VERSION, settings: next });
}

export function watchSettings(cb: (s: Settings) => void): () => void {
  return storedItem.watch((v) => cb(migrate(v).settings));
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function deepMerge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : (over as T);
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(over)) {
    const bv = (base as Record<string, unknown>)[k];
    out[k] = isObj(bv) ? deepMerge(bv, over[k]) : over[k];
  }
  return out as T;
}
