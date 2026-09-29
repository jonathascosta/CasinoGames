/**
 * @casinogames/ui — the shared table kit. DOM + CSS chrome components, and a
 * PixiJS layer (loaded on demand) for the dice and card animations.
 * Import '@casinogames/ui/theme.css' once per page.
 */
export { Disposer, append, h, svg, type AttributeValue, type Child, type Props } from './dom/h.ts';
export { icon, type IconName } from './dom/icons.ts';
export {
  formatCents,
  formatChip,
  formatCount,
  formatPercent,
  formatPoints,
} from './format/format.ts';
export { Bankroll, type BankrollOptions } from './bankroll/bankroll.ts';
export {
  DEFAULT_SETTINGS,
  createSettingsStore,
  parseSettings,
  type Settings,
} from './settings/settings.ts';
export { createStore, type Listener, type Store } from './state/store.ts';
export {
  STORAGE_NAMESPACE,
  createMemoryBackend,
  createSafeStorage,
  detectLocalStorage,
  type KeyValueBackend,
  type SafeStorage,
} from './storage/storage.ts';
export { BetSpot, type BetRejection, type BetSpotOptions } from './bet-spot/BetSpot.ts';
export { ChipRail, type ChipRailOptions } from './chips/ChipRail.ts';
export { CHIP_DENOMINATIONS, breakIntoChips, chipTone, createChip } from './chips/chips.ts';
