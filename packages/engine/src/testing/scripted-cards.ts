import { parseCardCode, type Card } from '../cards/card.ts';
import type { CardSource } from '../cards/shoe.ts';

export interface ScriptedCardSource extends CardSource {
  /** Number of cards dealt so far. */
  readonly dealt: number;
}

/**
 * Deals `cards` in order and throws once they run out. Accepts cards or
 * card codes: createScriptedCardSource('AS TH 5D').
 */
export function createScriptedCardSource(cards: readonly Card[] | string): ScriptedCardSource {
  const deck = typeof cards === 'string' ? cards.trim().split(/\s+/).map(parseCardCode) : cards;
  let index = 0;
  return {
    get dealt() {
      return index;
    },
    beginRound: () => false,
    draw(): Card {
      if (index >= deck.length) {
        throw new Error(`Scripted card source exhausted after ${deck.length} cards`);
      }
      return deck[index++]!;
    },
    remaining: () => deck.length - index,
    size: () => deck.length,
    shuffleCount: () => 0,
  };
}
