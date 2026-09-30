import type { DecisionSummary, StrategyFigures, StrategyRow } from '../../game/types.ts';
import { defineBets } from '../../game/validation.ts';
import { TRANCAR_CONFIG, type TrancarRules } from './config.ts';
import { TRANCAR_BET, lockedDie, rollLabel } from './rules.ts';
import {
  DISTINCT_ROLLS,
  INFINITE_SHOE,
  referenceStrategy,
  rollValues,
  shoeTotals,
  strategyMath,
  type StrategyMath,
} from './strategy.ts';

const { decks, rules } = TRANCAR_CONFIG;

/** The rules without the free 1-1, which the sheet prices for comparison. */
export const WITHOUT_FREE_ONE_ONE: TrancarRules = { ...rules, freeOneOne: false };

/**
 * The declared math, as exact fractions: the reference strategy (the best
 * choice on every roll, computed in strategy.ts) with the dealer's cards
 * from an infinite shoe. trancar.test.ts checks it against the game run over
 * every roll, re-roll and pair of cards.
 */
export const TRANCAR_MATH = strategyMath(rules, INFINITE_SHOE);
/** The same strategy on the table's six-deck shoe (finite-shoe.test.ts runs every pair of cards). */
export const TRANCAR_SIX_DECK = strategyMath(rules, shoeTotals(decks));
/** Without the free 1-1, with its own best strategy (which stands on 1-1). */
export const TRANCAR_WITHOUT_FREE = strategyMath(WITHOUT_FREE_ONE_ONE, INFINITE_SHOE);

const percent = (numerator: number, denominator: number) =>
  `${String(Math.round((100 * numerator) / denominator))}%`;
const FEE = percent(rules.fee.numerator, rules.fee.denominator);

/**
 * The bet of Trancar. trancar.test.ts enumerates the game to prove every
 * figure; trancar.math.test.ts and six-deck.math.test.ts simulate it with
 * the reference strategy.
 */
export const TRANCAR_BETS = defineBets([
  {
    id: TRANCAR_BET,
    label: 'Trancar',
    kind: 'main',
    min: TRANCAR_CONFIG.min,
    max: TRANCAR_CONFIG.max,
    description:
      "Wins 1 to 1 when your dice add up to more than the dealer's two cards; a tie loses. " +
      `After the roll you may lock one die and roll the other once more, for ${FEE} of the ` +
      'bet, taken at once and never returned' +
      (rules.freeOneOne ? ' (a roll of 1-1 re-rolls for free).' : '.'),
    rtp: TRANCAR_MATH.rtp.toNumber(),
    standardDeviation: Math.sqrt(TRANCAR_MATH.variance.toNumber()),
    finiteShoe: {
      rtp: TRANCAR_SIX_DECK.rtp.toNumber(),
      hitFrequency: TRANCAR_SIX_DECK.hitFrequency.toNumber(),
    },
    paytable: [
      {
        id: 'higher',
        label: "Dice beat the dealer's cards",
        odds: TRANCAR_CONFIG.odds,
        probability: TRANCAR_MATH.hitFrequency.toNumber(),
      },
    ],
  },
]);

/** One roll of the strategy card: the value of standing and of re-rolling, and the best play. */
function cardRow({ dice, probability }: (typeof DISTINCT_ROLLS)[number]): StrategyRow {
  const values = rollValues(dice, rules, INFINITE_SHOE);
  // The dice are listed lower first, so locking the second die keeps the higher one.
  const choice = referenceStrategy(rules)(dice);
  const locked = lockedDie(choice);
  const [low, high] = dice;
  const free = dice[0] === 1 && dice[1] === 1 && rules.freeOneOne;
  return {
    situation: rollLabel(dice),
    probability: probability.toNumber(),
    values: [values.ficar.toNumber(), values.trancar[1].toNumber()],
    best: locked === null ? 0 : 1,
    play:
      locked === null
        ? 'Ficar'
        : low === high
          ? `Lock a ${String(high)}, re-roll the other${free ? ' (free)' : ''}`
          : `Lock the ${String(high)}, re-roll the ${String(low)}`,
  };
}

function figures(label: string, math: StrategyMath): StrategyFigures {
  const rtp = math.rtp.toNumber();
  return {
    label,
    rtp,
    houseEdge: 1 - rtp,
    elementOfRisk: math.elementOfRisk.toNumber(),
    hitFrequency: math.hitFrequency.toNumber(),
    standardDeviation: Math.sqrt(math.variance.toNumber()),
    choiceFrequencies: [{ choice: 'Trancar', frequency: math.rerollFrequency.toNumber() }],
    feeFrequency: math.feeFrequency.toNumber(),
    averageFee: math.averageFee.toNumber(),
  };
}

/**
 * The decision after the roll, for the paytable and the game sheet: the
 * strategy card (21 rolls) and what the strategy returns with and without
 * the free 1-1, and on the table's shoe.
 */
const REROLLED = DISTINCT_ROLLS.filter(({ dice }) => referenceStrategy(rules)(dice) !== 'ficar');

export const TRANCAR_DECISIONS: DecisionSummary = {
  description:
    'After the roll: Ficar (stand), or Trancar (lock one die and roll the other once more) for ' +
    `${FEE} of the bet, taken at once and never returned${
      rules.freeOneOne ? '; a roll of 1-1 re-rolls for free' : ''
    }. A re-roll is always worth more with the higher die locked. The reference strategy ` +
    `re-rolls on ${REROLLED.map(({ dice }) => rollLabel(dice)).join(', ')} and stands on the ` +
    `other ${String(DISTINCT_ROLLS.length - REROLLED.length)} rolls.`,
  card: {
    situation: 'Roll',
    choices: ['Ficar', 'Trancar'],
    measure: 'net result per unit of the main bet, the fee included (Trancar locks the higher die)',
    rows: DISTINCT_ROLLS.map(cardRow),
  },
  figures: [
    figures('These rules', TRANCAR_MATH),
    figures('Without the free 1-1', TRANCAR_WITHOUT_FREE),
    figures(`These rules, ${String(decks)}-deck shoe`, TRANCAR_SIX_DECK),
  ],
};
