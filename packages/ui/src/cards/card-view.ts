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
  /**
   * Slides a card, face down, from the shoe to the end of `hand`. `card` is
   * null when its face must stay unknown until reveal(): nothing of it is
   * drawn or put on the page before then.
   */
  deal(card: Card | null, hand: string, duration: number): Promise<void>;
  /**
   * Turns a face-down card over, painting its face first if it was dealt
   * without one. Throws if the card was dealt with a different face.
   */
  reveal(hand: string, index: number, card: Card, duration: number): Promise<void>;
  /** Sweeps every card off the table. */
  clear(duration: number): Promise<void>;
  /** Plays the shuffle animation on the shoe. */
  shuffle(duration: number): Promise<void>;
  setShoe(shoe: ShoeDisplay): void;
  destroy(): void;
}

/**
 * The distance between neighbouring cards of a hand centred at `centre`, for
 * a table `width` wide and cards `cardWidth` wide: two thirds of a card, less
 * once a long hand would reach the table's left edge or the shoe in its
 * top-right corner, and never under a fifth of a card.
 */
export function handStep(centre: number, width: number, cardWidth: number, count: number): number {
  const natural = cardWidth * 0.66;
  if (count < 2 || width <= 0 || cardWidth <= 0) return natural;
  const room = Math.min(centre - cardWidth * 0.2, width - cardWidth * 1.8 - centre) - cardWidth / 2;
  return Math.max(cardWidth * 0.2, Math.min(natural, (2 * room) / (count - 1)));
}
