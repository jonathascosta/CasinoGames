import { createStore, type Store } from '../state/store.ts';
import type { SafeStorage } from '../storage/storage.ts';

export interface Settings {
  /** Skip animations: every duration token and tween becomes instant. */
  readonly turbo: boolean;
  readonly sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = { turbo: false, sound: true };

const KEY = 'settings';

export function parseSettings(value: unknown): Settings | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { turbo, sound } = value as Record<string, unknown>;
  if (typeof turbo !== 'boolean' || typeof sound !== 'boolean') return undefined;
  return { turbo, sound };
}

/** Settings loaded from storage (validated) and saved on every change. */
export function createSettingsStore(storage: SafeStorage): Store<Settings> {
  const store = createStore(
    storage.read(KEY, parseSettings, DEFAULT_SETTINGS),
    (a, b) => a.turbo === b.turbo && a.sound === b.sound,
  );
  store.subscribe((settings) => storage.write(KEY, settings));
  return store;
}
