import type { Rank, Suit } from '../cards/card.ts';
import type { CardSource } from '../cards/shoe.ts';
import { randomInt } from '../rng/rng.ts';

/**
 * An infinite card source that draws only the rank: one draw of
 * randomInt(ranks.length) per card, dealt in a fixed cosmetic suit. The rank
 * probabilities are those of an infinite shoe, but exact enumeration branches
 * once per rank instead of once per card of a deck (6 paths per card for
 * ace–six rather than 24). Only valid for games whose rules ignore suits.
 */
export function createUniformRankSource(ranks: readonly Rank[], suit: Suit = 'spades'): CardSource {
  if (ranks.length === 0 || new Set(ranks).size !== ranks.length) {
    throw new RangeError('ranks must be a non-empty list of distinct ranks');
  }
  return {
    beginRound: () => false,
    draw: (rng) => ({ rank: ranks[randomInt(rng, ranks.length)]!, suit }),
    remaining: () => Infinity,
    size: () => Infinity,
    shuffleCount: () => 0,
  };
}
