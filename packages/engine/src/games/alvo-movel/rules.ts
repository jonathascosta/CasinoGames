/**
 * The rulebook of Alvo Móvel as pure functions of a roll and the card values
 * dealt: no RNG, no state. The game (game.ts) rolls, deals until the total
 * reaches the target and settles through these; the table UI reads each card
 * with them as it lands.
 */
import type { Rank } from '../../cards/card.ts';
import type { DicePair } from '../../dice/dice.ts';
import { odds, type Odds } from '../../game/money.ts';

/** The bets of Alvo Móvel, in layout order: the main bet, then the side bets. */
export const ALVO_MOVEL_BET_IDS = ['acerta', 'primeira-carta', 'tres-ou-mais'] as const;

export type AlvoMovelBetId = (typeof ALVO_MOVEL_BET_IDS)[number];

/** The sum of the dice: the total the dealer's cards have to land on. */
export type Target = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const TARGETS: readonly Target[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Acerta pays by target: more where landing exactly on it is harder. */
export const ACERTA_ODDS: Readonly<Record<Target, Odds>> = {
  2: odds(15, 2),
  3: odds(7),
  4: odds(6),
  5: odds(11, 2),
  6: odds(5),
  7: odds(9, 2),
  8: odds(4),
  9: odds(7, 2),
  10: odds(3),
  11: odds(5),
  12: odds(5),
};
export const PRIMEIRA_CARTA_ODDS = odds(9);
export const TRES_OU_MAIS_ODDS = odds(4);
/** Três ou Mais wins when the dealer needs at least this many cards. */
export const TRES_OU_MAIS_CARDS = 3;

/** The highest card value: the shoe holds aces to tens. */
export const MAX_CARD_VALUE = 10;

export function targetOf([a, b]: DicePair): Target {
  return (a + b) as Target;
}

/** What a card counts: the ace 1, the others their number. There are no picture cards. */
export function cardValue(rank: Rank): number {
  if (rank > MAX_CARD_VALUE) {
    throw new RangeError(`Alvo Móvel deals aces to tens, got rank ${rank}`);
  }
  return rank;
}

/** The dealer's cards so far, measured against the target. */
export interface AlvoMovelDeal {
  readonly target: Target;
  readonly total: number;
  readonly cards: number;
  /** The total has reached the target: the dealer stops. */
  readonly done: boolean;
  /** The total equals the target. */
  readonly hit: boolean;
  /** How far the total went past the target; 0 until it does. */
  readonly over: number;
}

/**
 * Reads the card values dealt so far against the target. Throws on values
 * outside 1–10 and on a deal that went on after reaching the target.
 */
export function readAlvoMovelDeal(target: Target, values: readonly number[]): AlvoMovelDeal {
  let total = 0;
  for (const value of values) {
    if (total >= target) {
      throw new RangeError('The dealer stops as soon as the total reaches the target');
    }
    if (!Number.isInteger(value) || value < 1 || value > MAX_CARD_VALUE) {
      throw new RangeError(`Card values run from 1 to ${MAX_CARD_VALUE}, got ${value}`);
    }
    total += value;
  }
  return {
    target,
    total,
    cards: values.length,
    done: total >= target,
    hit: total === target,
    over: Math.max(0, total - target),
  };
}

/** How one bet ends, with the paytable entry that decided it. */
export type AlvoMovelResolution =
  | { readonly outcome: 'win'; readonly odds: Odds; readonly entryId: string }
  | { readonly outcome: 'lose' };

const win = (payout: Odds, entryId: string): AlvoMovelResolution => ({
  outcome: 'win',
  odds: payout,
  entryId,
});
const LOSE: AlvoMovelResolution = { outcome: 'lose' };
const ACERTA_WINS = Object.fromEntries(
  TARGETS.map((target) => [target, win(ACERTA_ODDS[target], `target-${target}`)]),
) as Readonly<Record<Target, AlvoMovelResolution>>;
const PRIMEIRA_CARTA_WIN = win(PRIMEIRA_CARTA_ODDS, 'first-card');
const TRES_OU_MAIS_WIN = win(TRES_OU_MAIS_ODDS, 'three-or-more');

/**
 * Settles one bet on a finished deal. This is the whole rulebook:
 *  - Acerta wins when the dealer's total lands exactly on the target, at
 *    odds set by the target.
 *  - Primeira Carta wins when the first card alone is the target.
 *  - Três ou Mais wins when the dealer needs three cards or more.
 */
export function resolveAlvoMovelBet(
  bet: AlvoMovelBetId,
  target: Target,
  values: readonly number[],
): AlvoMovelResolution {
  const deal = readAlvoMovelDeal(target, values);
  if (!deal.done) throw new RangeError('The deal is not finished: the total is below the target');
  switch (bet) {
    case 'acerta':
      return deal.hit ? ACERTA_WINS[target] : LOSE;
    case 'primeira-carta':
      return deal.hit && deal.cards === 1 ? PRIMEIRA_CARTA_WIN : LOSE;
    case 'tres-ou-mais':
      return deal.cards >= TRES_OU_MAIS_CARDS ? TRES_OU_MAIS_WIN : LOSE;
  }
}

/** What the cards dealt so far leave for a bet. */
export type AlvoMovelOutlook = 'live' | 'won' | 'lost';

/**
 * Whether a bet is still open after the roll and the cards dealt so far, or
 * already decided by them whatever comes next:
 *  - Acerta stays open until the dealer stops: from any total below the
 *    target, small cards can still land on it and large ones pass it.
 *  - Primeira Carta is decided by the first card, and lost from the roll
 *    when the target is above ten.
 *  - Três ou Mais is won once two cards leave the total short, and lost
 *    when the deal stops within two cards or can no longer need a third
 *    (a target of 2 is always reached by two cards).
 */
export function alvoMovelOutlook(
  bet: AlvoMovelBetId,
  target: Target,
  values: readonly number[],
): AlvoMovelOutlook {
  const deal = readAlvoMovelDeal(target, values);
  if (deal.done) return resolveAlvoMovelBet(bet, target, values).outcome === 'win' ? 'won' : 'lost';
  switch (bet) {
    case 'acerta':
      return 'live';
    case 'primeira-carta':
      // Not done: the first card, if any, fell short of the target.
      if (deal.cards > 0) return 'lost';
      return target <= MAX_CARD_VALUE ? 'live' : 'lost';
    case 'tres-ou-mais': {
      if (deal.cards >= TRES_OU_MAIS_CARDS - 1) return 'won';
      // Short with fewer than two cards: a third is still possible if an ace
      // per missing card keeps the total below the target, and avoidable if
      // tens can reach the target within two cards.
      const missing = TRES_OU_MAIS_CARDS - 1 - deal.cards;
      const canNeedThird = deal.total + missing < target;
      const canStopEarlier = deal.total + missing * MAX_CARD_VALUE >= target;
      if (canNeedThird && canStopEarlier) return 'live';
      return canNeedThird ? 'won' : 'lost';
    }
  }
}
