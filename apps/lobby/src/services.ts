import {
  Bankroll,
  SoundEngine,
  applySettings,
  createSafeStorage,
  createSettingsStore,
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
  const storage = createSafeStorage();
  const settings = createSettingsStore(storage);
  const bankroll = new Bankroll({ storage, initial: STARTING_BALANCE });
  const sound = new SoundEngine();
  sound.unlockOnFirstGesture();
  applySettings(settings, { motion, sound });
  return { storage, settings, bankroll, sound };
}
