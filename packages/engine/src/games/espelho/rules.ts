/**
 * The rulebook of Espelho as pure functions of two hands: the player's dice
 * and the dealer's two cards, each a pair of values from 1 to 6. No RNG, no
 * state. The game (game.ts) settles through these, and the table reads each
 * hand with them, so the rules exist once.
 */
import type { Odds } from '../../game/money.ts';
import { ESPELHO_CONFIG } from './config.ts';

/** The bets of Espelho, in layout order: the main bet, then the side bets. */
export const ESPELHO_BET_IDS = [
  'espelho',
  'empate',
  'somas-iguais',
  'par-vs-par',
  'espelho-perfeito',
  'seis-seis',
] as const;

export type EspelhoBetId = (typeof ESPELHO_BET_IDS)[number];

/** The bet that pays the progressive meter. */
export const JACKPOT_BET: EspelhoBetId = 'seis-seis';

/** A hand: two values from 1 to 6, the faces of the dice or the values of the cards. */
export type HandValues = readonly [number, number];

/** What a hand is worth. The same reading serves the dice and the cards. */
export interface EspelhoHand {
  readonly high: number;
  readonly low: number;
  readonly pair: boolean;
  readonly sum: number;
  /**
   * Orders hands: the higher strength wins and equal strengths tie. Pairs
   * rank above every non-pair, by value; non-pairs rank by sum, then by
   * their higher value. Two non-pairs with the same sum and the same higher
   * value have the same lower value too, so only identical hands tie.
   */
  readonly strength: number;
  /** "PAIR 4s" or "SUM 9 HIGH 6". */
  readonly label: string;
}

function handOf(a: number, b: number): EspelhoHand {
  const high = a > b ? a : b;
  const low = a > b ? b : a;
  const pair = a === b;
  const sum = a + b;
  return Object.freeze({
    high,
    low,
    pair,
    sum,
    strength: pair ? 200 + high : sum * 10 + high,
    label: pair ? `PAIR ${high}s` : `SUM ${sum} HIGH ${high}`,
  });
}

/** The 36 hands, read once: rounds and simulations look them up. */
const HAND_TABLE: readonly (readonly EspelhoHand[])[] = [1, 2, 3, 4, 5, 6].map((a) =>
  [1, 2, 3, 4, 5, 6].map((b) => handOf(a, b)),
);

export function readHand([a, b]: HandValues): EspelhoHand {
  const hand = HAND_TABLE[a - 1]?.[b - 1];
  if (hand === undefined) {
    throw new RangeError(`A hand holds values from 1 to 6, got ${a} and ${b}`);
  }
  return hand;
}

/** 1 when the dice outrank the cards, −1 when the cards outrank the dice, 0 for a tie. */
export function compareHands(dice: HandValues, cards: HandValues): 1 | 0 | -1 {
  const difference = readHand(dice).strength - readHand(cards).strength;
  return difference > 0 ? 1 : difference < 0 ? -1 : 0;
}

/** How one bet ends. A win of 6-6 vs 6-6 also pays the meter (`meter`). */
export type EspelhoResolution =
  | {
      readonly outcome: 'win';
      readonly odds: Odds;
      readonly entryId: string;
      readonly meter: boolean;
    }
  | { readonly outcome: 'lose' };

const { odds } = ESPELHO_CONFIG;
const win = (payout: Odds, entryId: string, meter = false): EspelhoResolution => ({
  outcome: 'win',
  odds: payout,
  entryId,
  meter,
});
const LOSE: EspelhoResolution = { outcome: 'lose' };
const WINS: Readonly<Record<EspelhoBetId, EspelhoResolution>> = {
  espelho: win(odds.espelho, 'higher'),
  empate: win(odds.empate, 'tie'),
  'somas-iguais': win(odds.somasIguais, 'same-sum'),
  'par-vs-par': win(odds.parVsPar, 'pairs'),
  'espelho-perfeito': win(odds.espelhoPerfeito, 'same-pair'),
  'seis-seis': win(odds.seisSeis, 'six-six', true),
};

/**
 * Settles one bet for the player's dice and the dealer's cards. This is the
 * whole rulebook:
 *  - Espelho wins when the dice outrank the cards; a tie loses.
 *  - Empate wins when the hands rank equal (the same pair or the same two values).
 *  - Somas Iguais wins when the two hands have the same sum.
 *  - Par vs Par wins when both hands are pairs.
 *  - Espelho Perfeito wins when both hands are the same pair.
 *  - 6-6 vs 6-6 wins when both hands are 6-6; it also pays the meter.
 * Suits never matter.
 */
export function resolveEspelhoBet(
  bet: EspelhoBetId,
  dice: HandValues,
  cards: HandValues,
): EspelhoResolution {
  const player = readHand(dice);
  const dealer = readHand(cards);
  let won: boolean;
  switch (bet) {
    case 'espelho':
      won = player.strength > dealer.strength;
      break;
    case 'empate':
      won = player.strength === dealer.strength;
      break;
    case 'somas-iguais':
      won = player.sum === dealer.sum;
      break;
    case 'par-vs-par':
      won = player.pair && dealer.pair;
      break;
    case 'espelho-perfeito':
      won = player.pair && dealer.pair && player.high === dealer.high;
      break;
    case 'seis-seis':
      won = player.pair && dealer.pair && player.high === 6 && dealer.high === 6;
      break;
  }
  return won ? WINS[bet] : LOSE;
}

export type EspelhoOutlook = 'live' | 'won' | 'lost';

const VALUES = [1, 2, 3, 4, 5, 6] as const;

/**
 * Where a bet stands while the dealer's cards come: once the dice are known
 * and before each card, it is won if every value the remaining cards could
 * take wins it, lost if none does, and live otherwise. The table marks the
 * side bets with it as soon as the cards decide them.
 */
export function espelhoOutlook(
  bet: EspelhoBetId,
  dice: HandValues,
  cards: readonly number[],
): EspelhoOutlook {
  if (cards.length > 2) throw new RangeError(`A hand holds two cards, got ${cards.length}`);
  const hands: HandValues[] =
    cards.length === 2
      ? [[cards[0]!, cards[1]!]]
      : cards.length === 1
        ? VALUES.map((value) => [cards[0]!, value] as const)
        : VALUES.flatMap((a) => VALUES.map((b) => [a, b] as const));
  let wins = 0;
  for (const hand of hands) {
    if (resolveEspelhoBet(bet, dice, hand).outcome === 'win') wins++;
  }
  return wins === hands.length ? 'won' : wins === 0 ? 'lost' : 'live';
}
