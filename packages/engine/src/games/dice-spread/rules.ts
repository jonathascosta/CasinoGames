/**
 * The rulebook of Dice Spread as pure functions of a roll and a card value:
 * no RNG, no state. The game (game.ts) draws the dice and the card and
 * settles through these; the table UI reads the roll with them to show the
 * winning range before the card is revealed.
 */
import type { Rank } from '../../cards/card.ts';
import type { DicePair, DieFace } from '../../dice/dice.ts';
import { odds, type Odds } from '../../game/money.ts';

/** The bets of Dice Spread, in layout order: the main bet, then the side bets. */
export const DICE_SPREAD_BET_IDS = ['between', 'match', 'bullseye', 'doubles', 'triple'] as const;

export type DiceSpreadBetId = (typeof DICE_SPREAD_BET_IDS)[number];

/** High die minus low die: 0 for a pair, 5 for a one and a six. */
export type Spread = 0 | 1 | 2 | 3 | 4 | 5;

/** Between pays by spread; spreads 0 (a pair) and 1 push. */
export const BETWEEN_ODDS: Readonly<Record<2 | 3 | 4 | 5, Odds>> = {
  2: odds(4),
  3: odds(2),
  4: odds(1),
  5: odds(1, 2),
};
export const MATCH_ODDS = odds(2);
export const BULLSEYE_ODDS = odds(22);
export const DOUBLES_ODDS = odds(4);
export const TRIPLE_ODDS = odds(30);

/** What a roll means for the card to come. */
export interface DiceSpreadRoll {
  readonly low: DieFace;
  readonly high: DieFace;
  readonly spread: Spread;
  readonly pair: boolean;
  /** Card values that win Between: strictly between the dice. Empty when Between pushes. */
  readonly between: readonly Rank[];
  /** Between's odds for this spread, or null when it pushes. */
  readonly betweenOdds: Odds | null;
  /** The card value that wins Bullseye (the middle of a spread of 2), or null. */
  readonly bullseye: Rank | null;
}

export function readDiceSpreadRoll([a, b]: DicePair): DiceSpreadRoll {
  const low = a < b ? a : b;
  const high = a < b ? b : a;
  const spread = (high - low) as Spread;
  const between: Rank[] = [];
  for (let value = low + 1; value < high; value++) between.push(value as Rank);
  return {
    low,
    high,
    spread,
    pair: spread === 0,
    between: spread >= 2 ? between : [],
    betweenOdds: spread >= 2 ? BETWEEN_ODDS[spread as 2 | 3 | 4 | 5] : null,
    bullseye: spread === 2 ? ((low + 1) as Rank) : null,
  };
}

/** How one bet ends, with the paytable entry that decided it. */
export type DiceSpreadResolution =
  | { readonly outcome: 'win'; readonly odds: Odds; readonly entryId: string }
  | { readonly outcome: 'push'; readonly entryId: string }
  | { readonly outcome: 'lose' };

const win = (payout: Odds, entryId: string): DiceSpreadResolution => ({
  outcome: 'win',
  odds: payout,
  entryId,
});
const LOSE: DiceSpreadResolution = { outcome: 'lose' };
const PUSH: DiceSpreadResolution = { outcome: 'push', entryId: 'push' };
const BETWEEN_WINS: Readonly<Record<2 | 3 | 4 | 5, DiceSpreadResolution>> = {
  2: win(BETWEEN_ODDS[2], 'spread-2'),
  3: win(BETWEEN_ODDS[3], 'spread-3'),
  4: win(BETWEEN_ODDS[4], 'spread-4'),
  5: win(BETWEEN_ODDS[5], 'spread-5'),
};
const MATCH_WIN = win(MATCH_ODDS, 'match');
const BULLSEYE_WIN = win(BULLSEYE_ODDS, 'bullseye');
const DOUBLES_WIN = win(DOUBLES_ODDS, 'pair');
const TRIPLE_WIN = win(TRIPLE_ODDS, 'triple');

/**
 * Settles one bet for a roll and a card value. This is the whole rulebook:
 *  - Between wins when the card is strictly between the dice, at odds set by
 *    the spread; a pair or a spread of 1 pushes.
 *  - Match wins when the card equals either die.
 *  - Bullseye wins when the spread is 2 and the card is the middle value.
 *  - Doubles wins when the dice are a pair.
 *  - Triple wins when the dice are a pair and the card matches it.
 */
export function resolveDiceSpreadBet(
  bet: DiceSpreadBetId,
  [a, b]: DicePair,
  card: Rank,
): DiceSpreadResolution {
  switch (bet) {
    case 'between': {
      const low = a < b ? a : b;
      const high = a < b ? b : a;
      const spread = high - low;
      if (spread < 2) return PUSH;
      return card > low && card < high ? BETWEEN_WINS[spread as 2 | 3 | 4 | 5] : LOSE;
    }
    case 'match':
      return card === a || card === b ? MATCH_WIN : LOSE;
    case 'bullseye':
      return Math.abs(a - b) === 2 && card * 2 === a + b ? BULLSEYE_WIN : LOSE;
    case 'doubles':
      return a === b ? DOUBLES_WIN : LOSE;
    case 'triple':
      return a === b && card === a ? TRIPLE_WIN : LOSE;
  }
}
