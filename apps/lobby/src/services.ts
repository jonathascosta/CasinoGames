import {
  Bankroll,
  STORAGE_NAMESPACE,
  SoundEngine,
  applySettings,
  createSafeStorage,
  createSettingsStore,
  detectLocalStorage,
  discardStaleVersions,
  motion,
  type SafeStorage,
  type Settings,
  type Store,
} from '@casinogames/ui';

/** Page-wide state shared by the lobby and every table. */
export interface Services {
  readonly storage: SafeStorage;
  readonly settings: Store<Settings>;
  readonly bankroll: Bankroll;
  readonly sound: SoundEngine;
}

export const STARTING_BALANCE = 1_000_00;

export function createServices(): Services {
  // Data from older storage schemas (such as v1, keyed by the games' old ids)
  // is dropped, not migrated.
  const backend = detectLocalStorage();
  discardStaleVersions(backend);
  const storage = createSafeStorage(STORAGE_NAMESPACE, backend);
  const settings = createSettingsStore(storage);
  const bankroll = new Bankroll({ storage, initial: STARTING_BALANCE });
  const sound = new SoundEngine();
  sound.unlockOnFirstGesture();
  applySettings(settings, { motion, sound });
  return { storage, settings, bankroll, sound };
}
