import type { Rank } from '../cards/card.ts';
import type { CardSource } from '../cards/shoe.ts';
import { randomInt } from '../rng/rng.ts';

/**
 * Two cards a round from a full shoe of `decks` decks of aces to sixes,
 * without replacement, and a full shoe again every round. In a game that
 * deals exactly two cards a round and a fixed number of rounds per shoe,
 * that is what every round of the real shoe deals, however deep the shoe
 * has been dealt, so enumerating a game on it gives its exact long-run
 * figures on the real shoe.
 *
 * The first card is equally likely to be any value (4 × decks of each among
 * 24 × decks), so it is drawn as a value: 6 branches. The second is drawn
 * among the cards left, one fewer of the first card's value: 24 × decks − 1
 * branches, one per card. Suits never matter to the games it serves, so
 * every card is a spade. A third card in a round throws.
 */
export function createFullShoePairSource(decks: number): CardSource {
  const perValue = 4 * decks;
  let first: number | null = null;
  let dealt = 0;
  return {
    beginRound: () => {
      first = null;
      dealt = 0;
      return false;
    },
    draw: (rng) => {
      if (dealt === 2) throw new Error('A full-shoe pair source deals two cards a round');
      dealt++;
      if (first === null) {
        first = 1 + randomInt(rng, 6);
        return { rank: first as Rank, suit: 'spades' };
      }
      // Cards left, value by value: perValue − 1 of the first card's value, perValue of the others.
      let card = randomInt(rng, 6 * perValue - 1);
      for (let value = 1; value <= 6; value++) {
        const left = value === first ? perValue - 1 : perValue;
        if (card < left) return { rank: value as Rank, suit: 'spades' };
        card -= left;
      }
      throw new Error('unreachable');
    },
    remaining: () => 6 * perValue - dealt,
    size: () => 6 * perValue,
    shuffleCount: () => 0,
  };
}
