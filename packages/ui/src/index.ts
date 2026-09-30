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
export { SoundEngine, type SoundName, type SoundOptions } from './audio/SoundEngine.ts';
export { BankrollDisplay, type BankrollDisplayOptions } from './bankroll/BankrollDisplay.ts';
export {
  Toggle,
  applySettings,
  createSoundToggle,
  createTurboToggle,
  type ToggleOptions,
} from './controls/Toggle.ts';
export {
  Motion,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  motion,
  prefersReducedMotion,
  tween,
  wait,
  type Easing,
  type MotionLevel,
} from './motion/motion.ts';
export {
  DiceRoller,
  type DicePickOptions,
  type DiceRollerOptions,
  type RollOptions,
} from './dice/DiceRoller.ts';
export type { DiceView, DieSpot, ThrowOptions } from './dice/dice-view.ts';
export { CardDealer, type CardDealerOptions } from './cards/CardDealer.ts';
export type { CardView, HandLayout, ShoeDisplay } from './cards/card-view.ts';
export { renderMarkdown, isSafeHref, type MarkdownOptions } from './markdown/markdown.ts';
export { createInfoModal, type InfoModalOptions } from './modal/InfoModal.ts';
export { Modal, type ModalOptions } from './modal/Modal.ts';
export { createPaytable, createPaytableModal } from './modal/PaytableModal.ts';
export { RtpPanel, type RtpPanelOptions } from './rtp/RtpPanel.ts';
export { ProgressiveMeter, type ProgressiveMeterOptions } from './jackpot/ProgressiveMeter.ts';
export {
  jackpotKey,
  parseJackpotState,
  readJackpotState,
  storedMeterAmount,
  writeJackpotState,
} from './jackpot/jackpot-storage.ts';
export {
  RtpTracker,
  liveRtp,
  nextCheckpoint,
  parseStats,
  type BetTally,
  type RtpSample,
  type RtpStats,
  type RtpTrackerOptions,
} from './rtp/RtpTracker.ts';
export { renderSparkline, type SparklineOptions } from './rtp/sparkline.ts';
export { AutoPlay, type AutoPlayOptions } from './autoplay/AutoPlay.ts';
export {
  AutoPlayController,
  type AutoPlayControllerOptions,
  type AutoPlayState,
  type AutoPlayStopReason,
} from './autoplay/AutoPlayController.ts';
export { replayEvents, type EventHandlers } from './replay/replay.ts';
