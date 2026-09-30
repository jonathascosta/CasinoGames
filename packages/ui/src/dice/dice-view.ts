import type { DicePair } from '@casinogames/engine';

export interface ThrowOptions {
  /** 0–1: how hard the dice are thrown (longer holds throw harder). */
  readonly power: number;
  /** Duration in ms, already adjusted to the motion level; 0 means instant. */
  readonly duration: number;
  /** False with reduced motion: settle in place instead of travelling. */
  readonly travel: boolean;
  /** Called at each impact with the table, for sound. */
  readonly onBounce?: (intensity: number) => void;
  /** Dice that stay where they lie (a locked die); only the others are thrown. */
  readonly keep?: readonly [boolean, boolean];
}

/** Where a die rests: its centre, in CSS pixels from the view's top left corner, and its width. */
export interface DieSpot {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

/**
 * What the DiceRoller needs from a renderer. The PixiJS view draws real 3D
 * dice; the DOM view is the fallback when WebGL/Canvas is unavailable (and
 * what the unit tests use).
 */
export interface DiceView {
  /** Shows the dice at rest. */
  show(dice: DicePair): void;
  /** Rattles the dice in the player's hand; 0 puts them down. */
  hold(intensity: number): void;
  /** Tumbles the dice to rest on `dice`; resolves once they settle. */
  throw(dice: DicePair, options: ThrowOptions): Promise<void>;
  /** Where each die rests, for controls laid over the dice. */
  spots(): readonly [DieSpot, DieSpot];
  /** Calls `listener` whenever the dice come to rest somewhere new; returns the unsubscribe. */
  onLayout(listener: () => void): () => void;
  destroy(): void;
}
