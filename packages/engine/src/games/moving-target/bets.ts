import type { PaytableEntry } from '../../game/types.ts';
import { defineBets } from '../../game/validation.ts';
import { Fraction } from '../../math/fraction.ts';
import {
  EXACT_HIT_ODDS,
  FIRST_CARD_ODDS,
  TARGETS,
  THREE_PLUS_CARDS_ODDS,
  type Target,
} from './rules.ts';

/** Chance per round of each target: the sum of two dice. */
function targetChance(target: Target): Fraction {
  return Fraction.of(6 - Math.abs(target - 7), 36);
}

/**
 * Chance that the dealer's total lands exactly on the target when every card
 * value from 1 to 10 is equally likely (an infinite shoe). The running total
 * passes through n with chance h(n) = (h(n − 1) + … + h(n − 10)) / 10, where
 * h(0) = 1. Up to 10 every earlier term is in that window, so h(n) = 1.1·h(n − 1)
 * = 11^(n−1)/10^n; at 11 the window loses h(0), giving (1.1^10 − 1)/10, and at
 * 12 it loses h(1) too, giving (1.1^11 − 1.2)/10. moving-target.test.ts checks
 * these against a memoised recursion and against the game itself.
 */
function hitChance(target: Target): Fraction {
  if (target <= 10) return Fraction.of(11n ** BigInt(target - 1), 10n ** BigInt(target));
  if (target === 11) return Fraction.of(11n ** 10n - 10n ** 10n, 10n ** 11n);
  return Fraction.of(11n ** 11n - 12n * 10n ** 10n, 10n ** 12n);
}

/** Exact Hit's lines, one per target: P(target) × P(hit | target), paid at the target's odds. */
const EXACT_HIT_LINES = TARGETS.map((target) => {
  const chance = targetChance(target);
  return {
    target,
    chance,
    probability: chance.mul(hitChance(target)),
    multiplier: Fraction.of(
      EXACT_HIT_ODDS[target].to + EXACT_HIT_ODDS[target].per,
      EXACT_HIT_ODDS[target].per,
    ),
  };
});
const EXACT_HIT_RTP = EXACT_HIT_LINES.reduce(
  (sum, line) => sum.add(line.probability.mul(line.multiplier)),
  Fraction.ZERO,
);
const EXACT_HIT_VARIANCE = EXACT_HIT_LINES.reduce(
  (sum, line) => sum.add(line.probability.mul(line.multiplier).mul(line.multiplier)),
  Fraction.ZERO,
).sub(EXACT_HIT_RTP.mul(EXACT_HIT_RTP));

const EXACT_HIT_PAYTABLE: readonly PaytableEntry[] = EXACT_HIT_LINES.map((line) => ({
  id: `target-${line.target}`,
  label: `Total exactly ${line.target}`,
  odds: EXACT_HIT_ODDS[line.target],
  probability: line.probability.toNumber(),
  given: { name: 'Target', value: String(line.target), probability: line.chance.toNumber() },
}));

/**
 * The bets of Moving Target and their declared math, with every card value from
 * 1 to 10 equally likely (an infinite shoe):
 *  - Exact Hit's figures are exact fractions computed above from h(n);
 *  - First Card wins when the target is 10 or less (33 rolls in 36) and
 *    the first card is it (1 in 10): 11/120;
 *  - 3+ Cards wins when two cards stay below the target: (T − 2)(T − 1)/200
 *    for target T, 43/240 over the rolls.
 * moving-target.test.ts proves every figure exactly; moving-target.math.test.ts
 * plays seeded Monte Carlo runs on an infinite shoe and on the real
 * six-deck shoe, whose long-run returns differ slightly (see the Math Report).
 */
export const MOVING_TARGET_BETS = defineBets([
  {
    id: 'exact-hit',
    label: 'Exact Hit',
    kind: 'main',
    min: 50,
    max: 25_000,
    rtp: EXACT_HIT_RTP.toNumber(),
    standardDeviation: Math.sqrt(EXACT_HIT_VARIANCE.toNumber()),
    description:
      "Wins when the dealer's total lands exactly on the target (the sum of the dice), " +
      'at odds set by the target.',
    paytable: EXACT_HIT_PAYTABLE,
  },
  {
    id: 'first-card',
    label: 'First Card',
    kind: 'side',
    min: 50,
    max: 2_500,
    rtp: 11 / 12,
    standardDeviation: Math.sqrt(1199) / 12,
    description: 'Wins when the first card alone is the target. A target of 11 or 12 cannot win.',
    paytable: [
      {
        id: 'first-card',
        label: 'The first card is the target',
        odds: FIRST_CARD_ODDS,
        probability: 11 / 120,
      },
    ],
  },
  {
    id: 'three-plus-cards',
    label: '3+ Cards',
    kind: 'side',
    min: 50,
    max: 2_500,
    rtp: 43 / 48,
    standardDeviation: Math.sqrt(8471) / 48,
    description: 'Wins when the dealer needs three cards or more to reach the target.',
    paytable: [
      {
        id: 'three-or-more',
        label: 'Three cards or more',
        odds: THREE_PLUS_CARDS_ODDS,
        probability: 43 / 240,
      },
    ],
  },
]);
