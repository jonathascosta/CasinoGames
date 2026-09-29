import { randomInt, shuffleInPlace, type Rng } from '../rng/rng.ts';
import { RANK_SETS, SUITS, isRank, type Card, type Rank } from './card.ts';

/**
 * Where a game's cards come from. Games depend on this interface rather than
 * on {@link Shoe}: tests can script exact cards, and a live table could feed
 * it from a card reader.
 */
export interface CardSource {
  /**
   * Called once before each round. Reshuffles if the cut card came out in an
   * earlier round (or the source was never shuffled); returns true if it did.
   */
  beginRound(rng: Rng): boolean;
  /** Deals the next card. */
  draw(rng: Rng): Card;
  /** Cards left to deal; Infinity for an infinite shoe. */
  remaining(): number;
  /** Cards in a full source; Infinity for an infinite shoe. */
  size(): number;
  /** Shuffles performed so far, so callers can notice a mid-round reshuffle. */
  shuffleCount(): number;
}

export interface ShoeOptions {
  /**
   * Number of decks, or `Infinity` for an infinite shoe: every card is drawn
   * independently and uniformly from one deck's composition (sampling with
   * replacement), which is what Monte Carlo tests use.
   */
  readonly decks: number;
  /** Ranks in each deck; every rank comes in all four suits. Default A–K. */
  readonly ranks?: readonly Rank[];
  /**
   * Fraction of the shoe dealt before the cut card comes out. The default,
   * 0.75, places the cut card with 25% of the cards remaining.
   */
  readonly penetration?: number;
}

export const DEFAULT_PENETRATION = 0.75;

export class ShoeExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShoeExhaustedError';
  }
}

/**
 * A dealing shoe of N decks with a cut card.
 *
 * - Shuffles with Fisher–Yates using the Rng passed to beginRound/draw.
 * - The cut card never interrupts a round: once it is out, the current round
 *   finishes and the next beginRound() reshuffles everything.
 * - If a round empties the shoe, the discards from earlier rounds (never the
 *   cards in play) are shuffled into a new stack, as a dealer would.
 */
export class Shoe implements CardSource {
  readonly decks: number;
  readonly ranks: readonly Rank[];
  readonly penetration: number;
  readonly infinite: boolean;

  /** Every card, in dealing order; the first #position have been dealt. */
  #cards: Card[];
  #position = 0;
  /** Index of the first card dealt in the current round. */
  #roundStart = 0;
  /** The cut card sits in front of this index. */
  #cutIndex = 0;
  #shuffled = false;
  #shuffles = 0;

  constructor(options: ShoeOptions) {
    const { decks, ranks = RANK_SETS.aceToKing, penetration = DEFAULT_PENETRATION } = options;
    if (!(decks === Infinity || (Number.isInteger(decks) && decks >= 1))) {
      throw new RangeError(`decks must be a positive integer or Infinity, got ${decks}`);
    }
    if (ranks.length === 0 || !ranks.every(isRank) || new Set(ranks).size !== ranks.length) {
      throw new RangeError('ranks must be a non-empty list of distinct ranks (1–13)');
    }
    if (!(penetration > 0 && penetration <= 1)) {
      throw new RangeError(`penetration must be in (0, 1], got ${penetration}`);
    }
    this.decks = decks;
    this.ranks = [...ranks];
    this.penetration = penetration;
    this.infinite = decks === Infinity;
    this.#cards = buildComposition(this.infinite ? 1 : decks, this.ranks);
  }

  size(): number {
    return this.infinite ? Infinity : this.#cards.length;
  }

  remaining(): number {
    return this.infinite ? Infinity : this.#cards.length - this.#position;
  }

  shuffleCount(): number {
    return this.#shuffles;
  }

  /** True once the cut card has come out; the next round will reshuffle. */
  isCutCardOut(): boolean {
    return !this.infinite && this.#shuffled && this.#position >= this.#cutIndex;
  }

  needsShuffle(): boolean {
    return !this.infinite && (!this.#shuffled || this.isCutCardOut());
  }

  /** Gathers every card and shuffles a fresh shoe. Call between rounds. */
  shuffle(rng: Rng): void {
    if (this.infinite) return;
    shuffleInPlace(rng, this.#cards);
    this.#position = 0;
    this.#roundStart = 0;
    this.#cutIndex = this.#cards.length - Math.round(this.#cards.length * (1 - this.penetration));
    this.#shuffled = true;
    this.#shuffles++;
  }

  beginRound(rng: Rng): boolean {
    const reshuffle = this.needsShuffle();
    if (reshuffle) this.shuffle(rng);
    this.#roundStart = this.#position;
    return reshuffle;
  }

  draw(rng: Rng): Card {
    if (this.infinite) return this.#cards[randomInt(rng, this.#cards.length)]!;
    if (!this.#shuffled) this.shuffle(rng);
    if (this.#position === this.#cards.length) this.#reshuffleDiscards(rng);
    return this.#cards[this.#position++]!;
  }

  #reshuffleDiscards(rng: Rng): void {
    const inPlay = this.#cards.slice(this.#roundStart, this.#position);
    const discards = this.#cards.slice(0, this.#roundStart);
    if (discards.length === 0) {
      throw new ShoeExhaustedError(
        `A single round needed more than the ${this.#cards.length} cards in the shoe`,
      );
    }
    shuffleInPlace(rng, discards);
    this.#cards = [...inPlay, ...discards];
    this.#roundStart = 0;
    this.#position = inPlay.length;
    // The stack is short and uneven: force a full reshuffle before next round.
    this.#cutIndex = this.#position;
    this.#shuffles++;
  }
}

function buildComposition(decks: number, ranks: readonly Rank[]): Card[] {
  const cards: Card[] = [];
  for (let deck = 0; deck < decks; deck++) {
    for (const suit of SUITS) {
      for (const rank of ranks) cards.push({ rank, suit });
    }
  }
  return cards;
}
