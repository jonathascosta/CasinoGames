/**
 * The rulebook of Entre Dados as pure functions of a roll and a card value:
 * no RNG, no state. The game (game.ts) draws the dice and the card and
 * settles through these; the table UI reads the roll with them to show the
 * winning range before the card is revealed.
 */
import type { Rank } from '../../cards/card.ts';
import type { DicePair, DieFace } from '../../dice/dice.ts';
import { odds, type Odds } from '../../game/money.ts';

/** The bets of Entre Dados, in layout order: the main bet, then the side bets. */
export const ENTRE_DADOS_BET_IDS = ['entre', 'exato', 'olho-de-boi', 'dobros', 'triplo'] as const;

export type EntreDadosBetId = (typeof ENTRE_DADOS_BET_IDS)[number];

/** High die minus low die: 0 for a pair, 5 for a one and a six. */
export type Spread = 0 | 1 | 2 | 3 | 4 | 5;

/** Entre pays by spread; spreads 0 (a pair) and 1 push. */
export const ENTRE_ODDS: Readonly<Record<2 | 3 | 4 | 5, Odds>> = {
  2: odds(4),
  3: odds(2),
  4: odds(1),
  5: odds(1, 2),
};
export const EXATO_ODDS = odds(2);
export const OLHO_DE_BOI_ODDS = odds(22);
export const DOBROS_ODDS = odds(4);
export const TRIPLO_ODDS = odds(30);

/** What a roll means for the card to come. */
export interface EntreDadosRoll {
  readonly low: DieFace;
  readonly high: DieFace;
  readonly spread: Spread;
  readonly pair: boolean;
  /** Card values that win Entre: strictly between the dice. Empty when Entre pushes. */
  readonly between: readonly Rank[];
  /** Entre's odds for this spread, or null when it pushes. */
  readonly entreOdds: Odds | null;
  /** The card value that wins Olho de Boi (the middle of a spread of 2), or null. */
  readonly bullseye: Rank | null;
}

export function readEntreDadosRoll([a, b]: DicePair): EntreDadosRoll {
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
    entreOdds: spread >= 2 ? ENTRE_ODDS[spread as 2 | 3 | 4 | 5] : null,
    bullseye: spread === 2 ? ((low + 1) as Rank) : null,
  };
}

/** How one bet ends, with the paytable entry that decided it. */
export type EntreDadosResolution =
  | { readonly outcome: 'win'; readonly odds: Odds; readonly entryId: string }
  | { readonly outcome: 'push'; readonly entryId: string }
  | { readonly outcome: 'lose' };

const win = (payout: Odds, entryId: string): EntreDadosResolution => ({
  outcome: 'win',
  odds: payout,
  entryId,
});
const LOSE: EntreDadosResolution = { outcome: 'lose' };
const PUSH: EntreDadosResolution = { outcome: 'push', entryId: 'push' };
const ENTRE_WINS: Readonly<Record<2 | 3 | 4 | 5, EntreDadosResolution>> = {
  2: win(ENTRE_ODDS[2], 'spread-2'),
  3: win(ENTRE_ODDS[3], 'spread-3'),
  4: win(ENTRE_ODDS[4], 'spread-4'),
  5: win(ENTRE_ODDS[5], 'spread-5'),
};
const EXATO_WIN = win(EXATO_ODDS, 'match');
const OLHO_DE_BOI_WIN = win(OLHO_DE_BOI_ODDS, 'bullseye');
const DOBROS_WIN = win(DOBROS_ODDS, 'pair');
const TRIPLO_WIN = win(TRIPLO_ODDS, 'triple');

/**
 * Settles one bet for a roll and a card value. This is the whole rulebook:
 *  - Entre wins when the card is strictly between the dice, at odds set by
 *    the spread; a pair or a spread of 1 pushes.
 *  - Exato wins when the card equals either die.
 *  - Olho de Boi wins when the spread is 2 and the card is the middle value.
 *  - Dobros wins when the dice are a pair.
 *  - Triplo wins when the dice are a pair and the card matches it.
 */
export function resolveEntreDadosBet(
  bet: EntreDadosBetId,
  [a, b]: DicePair,
  card: Rank,
): EntreDadosResolution {
  switch (bet) {
    case 'entre': {
      const low = a < b ? a : b;
      const high = a < b ? b : a;
      const spread = high - low;
      if (spread < 2) return PUSH;
      return card > low && card < high ? ENTRE_WINS[spread as 2 | 3 | 4 | 5] : LOSE;
    }
    case 'exato':
      return card === a || card === b ? EXATO_WIN : LOSE;
    case 'olho-de-boi':
      return Math.abs(a - b) === 2 && card * 2 === a + b ? OLHO_DE_BOI_WIN : LOSE;
    case 'dobros':
      return a === b ? DOBROS_WIN : LOSE;
    case 'triplo':
      return a === b && card === a ? TRIPLO_WIN : LOSE;
  }
}
