/**
 * The rulebook of Moving Target as pure functions of a roll and the card values
 * dealt: no RNG, no state. The game (game.ts) rolls, deals until the total
 * reaches the target and settles through these; the table UI reads each card
 * with them as it lands.
 */
import type { Rank } from '../../cards/card.ts';
import type { DicePair } from '../../dice/dice.ts';
import { odds, type Odds } from '../../game/money.ts';

/** The bets of Moving Target, in layout order: the main bet, then the side bets. */
export const MOVING_TARGET_BET_IDS = ['exact-hit', 'first-card', 'three-plus-cards'] as const;

export type MovingTargetBetId = (typeof MOVING_TARGET_BET_IDS)[number];

/** The sum of the dice: the total the dealer's cards have to land on. */
export type Target = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const TARGETS: readonly Target[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Exact Hit pays by target: more where landing exactly on it is harder. */
export const EXACT_HIT_ODDS: Readonly<Record<Target, Odds>> = {
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
export const FIRST_CARD_ODDS = odds(9);
export const THREE_PLUS_CARDS_ODDS = odds(4);
/** 3+ Cards wins when the dealer needs at least this many cards. */
export const THREE_PLUS_MIN_CARDS = 3;

/** The highest card value: the shoe holds aces to tens. */
export const MAX_CARD_VALUE = 10;

export function targetOf([a, b]: DicePair): Target {
  return (a + b) as Target;
}

/** What a card counts: the ace 1, the others their number. There are no picture cards. */
export function cardValue(rank: Rank): number {
  if (rank > MAX_CARD_VALUE) {
    throw new RangeError(`Moving Target deals aces to tens, got rank ${rank}`);
  }
  return rank;
}

/** The dealer's cards so far, measured against the target. */
export interface MovingTargetDeal {
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
export function readMovingTargetDeal(target: Target, values: readonly number[]): MovingTargetDeal {
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
export type MovingTargetResolution =
  | { readonly outcome: 'win'; readonly odds: Odds; readonly entryId: string }
  | { readonly outcome: 'lose' };

const win = (payout: Odds, entryId: string): MovingTargetResolution => ({
  outcome: 'win',
  odds: payout,
  entryId,
});
const LOSE: MovingTargetResolution = { outcome: 'lose' };
const EXACT_HIT_WINS = Object.fromEntries(
  TARGETS.map((target) => [target, win(EXACT_HIT_ODDS[target], `target-${target}`)]),
) as Readonly<Record<Target, MovingTargetResolution>>;
const FIRST_CARD_WIN = win(FIRST_CARD_ODDS, 'first-card');
const THREE_PLUS_CARDS_WIN = win(THREE_PLUS_CARDS_ODDS, 'three-or-more');

/**
 * Settles one bet on a finished deal. This is the whole rulebook:
 *  - Exact Hit wins when the dealer's total lands exactly on the target, at
 *    odds set by the target.
 *  - First Card wins when the first card alone is the target.
 *  - 3+ Cards wins when the dealer needs three cards or more.
 */
export function resolveMovingTargetBet(
  bet: MovingTargetBetId,
  target: Target,
  values: readonly number[],
): MovingTargetResolution {
  const deal = readMovingTargetDeal(target, values);
  if (!deal.done) throw new RangeError('The deal is not finished: the total is below the target');
  switch (bet) {
    case 'exact-hit':
      return deal.hit ? EXACT_HIT_WINS[target] : LOSE;
    case 'first-card':
      return deal.hit && deal.cards === 1 ? FIRST_CARD_WIN : LOSE;
    case 'three-plus-cards':
      return deal.cards >= THREE_PLUS_MIN_CARDS ? THREE_PLUS_CARDS_WIN : LOSE;
  }
}

/** What the cards dealt so far leave for a bet. */
export type MovingTargetOutlook = 'live' | 'won' | 'lost';

/**
 * Whether a bet is still open after the roll and the cards dealt so far, or
 * already decided by them whatever comes next:
 *  - Exact Hit stays open until the dealer stops: from any total below the
 *    target, small cards can still land on it and large ones pass it.
 *  - First Card is decided by the first card, and lost from the roll
 *    when the target is above ten.
 *  - 3+ Cards is won once two cards leave the total short, and lost
 *    when the deal stops within two cards or can no longer need a third
 *    (a target of 2 is always reached by two cards).
 */
export function movingTargetOutlook(
  bet: MovingTargetBetId,
  target: Target,
  values: readonly number[],
): MovingTargetOutlook {
  const deal = readMovingTargetDeal(target, values);
  if (deal.done)
    return resolveMovingTargetBet(bet, target, values).outcome === 'win' ? 'won' : 'lost';
  switch (bet) {
    case 'exact-hit':
      return 'live';
    case 'first-card':
      // Not done: the first card, if any, fell short of the target.
      if (deal.cards > 0) return 'lost';
      return target <= MAX_CARD_VALUE ? 'live' : 'lost';
    case 'three-plus-cards': {
      if (deal.cards >= THREE_PLUS_MIN_CARDS - 1) return 'won';
      // Short with fewer than two cards: a third is still possible if an ace
      // per missing card keeps the total below the target, and avoidable if
      // tens can reach the target within two cards.
      const missing = THREE_PLUS_MIN_CARDS - 1 - deal.cards;
      const canNeedThird = deal.total + missing < target;
      const canStopEarlier = deal.total + missing * MAX_CARD_VALUE >= target;
      if (canNeedThird && canStopEarlier) return 'live';
      return canNeedThird ? 'won' : 'lost';
    }
  }
}
