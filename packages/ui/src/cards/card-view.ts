import type { Card } from '@casinogames/engine';

/** Where a hand sits on the table, as fractions of the stage size. */
export interface HandLayout {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Shown under the hand, e.g. "Dealer". */
  readonly label?: string;
}

export interface ShoeDisplay {
  readonly remaining: number;
  readonly size: number;
  readonly cutCardOut: boolean;
}

/**
 * What the CardDealer needs from a renderer. Durations are already adjusted
 * to the motion level (0 means instant).
 */
export interface CardView {
  /** Slides a card, face down, from the shoe to the end of `hand`. */
  deal(card: Card, hand: string, duration: number): Promise<void>;
  /** Turns a face-down card over. */
  reveal(hand: string, index: number, card: Card, duration: number): Promise<void>;
  /** Sweeps every card off the table. */
  clear(duration: number): Promise<void>;
  /** Plays the shuffle animation on the shoe. */
  shuffle(duration: number): Promise<void>;
  setShoe(shoe: ShoeDisplay): void;
  destroy(): void;
}
