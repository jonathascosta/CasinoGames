import type { DecisionSummary, StrategyFigures, StrategyRow } from '../../game/types.ts';
import { defineBets } from '../../game/validation.ts';
import { LOCK_AND_ROLL_CONFIG, type LockAndRollRules } from './config.ts';
import { LOCK_AND_ROLL_BET, lockedDie, rollLabel } from './rules.ts';
import {
  DISTINCT_ROLLS,
  INFINITE_SHOE,
  referenceStrategy,
  rollValues,
  shoeTotals,
  strategyMath,
  type StrategyMath,
} from './strategy.ts';

const { decks, rules } = LOCK_AND_ROLL_CONFIG;

/** The rules without the free 1-1, which the sheet prices for comparison. */
export const WITHOUT_FREE_ONE_ONE: LockAndRollRules = { ...rules, freeOneOne: false };

/**
 * The declared math, as exact fractions: the reference strategy (the best
 * choice on every roll, computed in strategy.ts) with the dealer's cards
 * from an infinite shoe. lock-and-roll.test.ts checks it against the game run over
 * every roll, re-roll and pair of cards.
 */
export const LOCK_AND_ROLL_MATH = strategyMath(rules, INFINITE_SHOE);
/** The same strategy on the table's six-deck shoe (finite-shoe.test.ts runs every pair of cards). */
export const LOCK_AND_ROLL_SIX_DECK = strategyMath(rules, shoeTotals(decks));
/** Without the free 1-1, with its own best strategy (which stands on 1-1). */
export const LOCK_AND_ROLL_WITHOUT_FREE = strategyMath(WITHOUT_FREE_ONE_ONE, INFINITE_SHOE);

const percent = (numerator: number, denominator: number) =>
  `${String(Math.round((100 * numerator) / denominator))}%`;
const FEE = percent(rules.fee.numerator, rules.fee.denominator);

/**
 * The bet of Lock & Roll. lock-and-roll.test.ts enumerates the game to prove every
 * figure; lock-and-roll.math.test.ts and six-deck.math.test.ts simulate it with
 * the reference strategy.
 */
export const LOCK_AND_ROLL_BETS = defineBets([
  {
    id: LOCK_AND_ROLL_BET,
    label: 'Lock & Roll',
    kind: 'main',
    min: LOCK_AND_ROLL_CONFIG.min,
    max: LOCK_AND_ROLL_CONFIG.max,
    description:
      "Wins 1 to 1 when your dice add up to more than the dealer's two cards; a tie loses. " +
      `After the roll you may lock one die and roll the other once more, for the Lock fee of ${FEE} ` +
      'of the bet, taken at once and never returned' +
      (rules.freeOneOne ? ' (a roll of 1-1 re-rolls for free).' : '.'),
    rtp: LOCK_AND_ROLL_MATH.rtp.toNumber(),
    standardDeviation: Math.sqrt(LOCK_AND_ROLL_MATH.variance.toNumber()),
    finiteShoe: {
      rtp: LOCK_AND_ROLL_SIX_DECK.rtp.toNumber(),
      hitFrequency: LOCK_AND_ROLL_SIX_DECK.hitFrequency.toNumber(),
    },
    paytable: [
      {
        id: 'higher',
        label: "Dice beat the dealer's cards",
        odds: LOCK_AND_ROLL_CONFIG.odds,
        probability: LOCK_AND_ROLL_MATH.hitFrequency.toNumber(),
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
    values: [values.stand.toNumber(), values.lock[1].toNumber()],
    best: locked === null ? 0 : 1,
    play:
      locked === null
        ? 'Stand'
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
    choiceFrequencies: [{ choice: 'Lock', frequency: math.rerollFrequency.toNumber() }],
    feeFrequency: math.feeFrequency.toNumber(),
    averageFee: math.averageFee.toNumber(),
  };
}

/**
 * The decision after the roll, for the paytable and the game sheet: the
 * strategy card (21 rolls) and what the strategy returns with and without
 * the free 1-1, and on the table's shoe.
 */
const REROLLED = DISTINCT_ROLLS.filter(({ dice }) => referenceStrategy(rules)(dice) !== 'stand');

export const LOCK_AND_ROLL_DECISIONS: DecisionSummary = {
  description:
    'After the roll: Stand, or Lock (keep one die and roll the other once more) for the Lock fee, ' +
    `${FEE} of the bet, taken at once and never returned${
      rules.freeOneOne ? '; a roll of 1-1 re-rolls for free' : ''
    }. A re-roll is always worth more with the higher die locked. The reference strategy ` +
    `re-rolls on ${REROLLED.map(({ dice }) => rollLabel(dice)).join(', ')} and stands on the ` +
    `other ${String(DISTINCT_ROLLS.length - REROLLED.length)} rolls.`,
  card: {
    situation: 'Roll',
    choices: ['Stand', 'Lock'],
    measure: 'net result per unit of the main bet, the fee included (Lock keeps the higher die)',
    rows: DISTINCT_ROLLS.map(cardRow),
  },
  figures: [
    figures('These rules', LOCK_AND_ROLL_MATH),
    figures('Without the free 1-1', LOCK_AND_ROLL_WITHOUT_FREE),
    figures(`These rules, ${String(decks)}-deck shoe`, LOCK_AND_ROLL_SIX_DECK),
  ],
};
