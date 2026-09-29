import { describe, expect, it } from 'vitest';
import { createMemoryBackend, createSafeStorage } from '../storage/storage.ts';
import { DEFAULT_SETTINGS, createSettingsStore, parseSettings } from './settings.ts';

describe('settings', () => {
  it('defaults, persists changes and reloads them', () => {
    const backend = createMemoryBackend();
    const first = createSettingsStore(createSafeStorage('t', backend));
    expect(first.get()).toEqual(DEFAULT_SETTINGS);
    first.update((settings) => ({ ...settings, turbo: true }));
    const second = createSettingsStore(createSafeStorage('t', backend));
    expect(second.get()).toEqual({ turbo: true, sound: true });
  });

  it('rejects malformed stored settings', () => {
    expect(parseSettings({ turbo: 'yes', sound: true })).toBeUndefined();
    expect(parseSettings(null)).toBeUndefined();
    expect(parseSettings({ turbo: false, sound: false, extra: 1 })).toEqual({
      turbo: false,
      sound: false,
    });
  });
});
