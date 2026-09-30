/**
 * Lock & Roll's strategy, derived here from scratch by expected value: nothing
 * about the best play is typed in. The test values every choice on each of
 * the 21 distinct rolls by enumerating the dealer's two cards and the faces
 * of a re-rolled die, picks the best, and checks that:
 *
 *  - it is the strategy the brief declares: re-roll the low die whenever it
 *    is 1 or 2, keeping the high die, except never a double (other than the
 *    free 1-1) and not 6-2;
 *  - strategy.ts (what the game's strategy, autoplay and sheet use) agrees;
 *  - the house edge follows exactly: 4.07% with the 40% fee and the free
 *    1-1, 4.97% without the free 1-1, with a re-roll in 44–47% of rounds.
 */
import { describe, expect, it } from 'vitest';
import { DIE_FACES, type DicePair, type DieFace } from '../../dice/dice.ts';
import { Fraction } from '../../math/fraction.ts';
import { LOCK_AND_ROLL_CONFIG, type LockAndRollRules } from './config.ts';
import type { LockAndRollChoice } from './rules.ts';
import {
  DISTINCT_ROLLS,
  INFINITE_SHOE,
  bestChoice,
  referenceStrategy,
  shoeTotals,
  strategyMath,
} from './strategy.ts';

const RULES = LOCK_AND_ROLL_CONFIG.rules;
const WITHOUT_FREE: LockAndRollRules = { ...RULES, freeOneOne: false };
const FEE = Fraction.of(2, 5);
const ONE = Fraction.ONE;
const TWO = Fraction.of(2);

/** P(the dealer's two cards total less than `total`): every ordered pair of values is 1 in 36. */
function beats(total: number): Fraction {
  let pairs = 0;
  for (const a of DIE_FACES) for (const b of DIE_FACES) if (a + b < total) pairs++;
  return Fraction.of(pairs, 36);
}

/** Standing on a total: +1 on a win, −1 on a loss or a tie. */
const stand = (total: number) => TWO.mul(beats(total)).sub(ONE);

/** Locking a die of value `kept` and re-rolling the other: the six faces, less the fee. */
function reroll(kept: number, fee: Fraction): Fraction {
  let sum = Fraction.ZERO;
  for (const face of DIE_FACES) sum = sum.add(stand(kept + face));
  return sum.div(Fraction.of(6)).sub(fee);
}

type Play = 'stand' | 'reroll the low die' | 'reroll the high die';

/** Every choice on a roll (low ≤ high) and the best one, by expected value alone. */
function evaluate(low: DieFace, high: DieFace, free: boolean) {
  const fee = free && low === 1 && high === 1 ? Fraction.ZERO : FEE;
  const values: [Play, Fraction][] = [
    ['stand', stand(low + high)],
    ['reroll the low die', reroll(high, fee)], // the high die stays
    ['reroll the high die', reroll(low, fee)],
  ];
  const [best, value] = values.reduce((top, next) => (next[1].compare(top[1]) > 0 ? next : top));
  return { best, value, values: Object.fromEntries(values) as Record<Play, Fraction> };
}

/** The strategy as the brief states it. */
function declaredStrategy(low: DieFace, high: DieFace, free: boolean): Play {
  if (low === high) return free && low === 1 ? 'reroll the low die' : 'stand';
  if (low === 2 && high === 6) return 'stand';
  return low <= 2 ? 'reroll the low die' : 'stand';
}

/**
 * The same play as a game choice, for dice listed lower first: the high die
 * is the second. On a double both locks are worth the same, and the first
 * die is locked.
 */
const asChoice = (play: Play, low: DieFace, high: DieFace): LockAndRollChoice =>
  play === 'stand' ? 'stand' : low === high || play === 'reroll the high die' ? 'lock-0' : 'lock-1';

const ROLLS = DIE_FACES.flatMap((low) =>
  DIE_FACES.filter((high) => high >= low).map((high) => [low, high] as const),
);

/** Σ over the 21 rolls of their chance × the value of the best choice, and how often it re-rolls. */
function edge(free: boolean) {
  let value = Fraction.ZERO;
  let rerolls = Fraction.ZERO;
  for (const [low, high] of ROLLS) {
    const chance = Fraction.of(low === high ? 1 : 2, 36);
    const { best, value: bestValue } = evaluate(low, high, free);
    value = value.add(chance.mul(bestValue));
    if (best !== 'stand') rerolls = rerolls.add(chance);
  }
  return { houseEdge: value.neg(), rerolls };
}

describe('Lock & Roll — the best choice on each of the 21 rolls, by expected value', () => {
  it('lists 21 distinct rolls, whose chances make up every roll', () => {
    expect(ROLLS).toHaveLength(21);
    expect(DISTINCT_ROLLS.map(({ dice }) => dice)).toEqual(ROLLS);
    const total = DISTINCT_ROLLS.reduce((sum, roll) => sum.add(roll.probability), Fraction.ZERO);
    expect(total.equals(ONE)).toBe(true);
  });

  it.each(ROLLS)('%i-%i: the best choice is the declared strategy', (low, high) => {
    const { best, values } = evaluate(low, high, true);
    expect(
      best,
      Object.entries(values)
        .map(([play, v]) => `${play} ${v.toString()}`)
        .join(', '),
    ).toBe(declaredStrategy(low, high, true));
    // Re-rolling the high die is never the best: the higher the die kept, the better the re-roll.
    if (low !== high)
      expect(values['reroll the high die'].compare(values['reroll the low die'])).toBe(-1);
    // strategy.ts computes the same choice (the game, autoplay and the sheet use it).
    expect(bestChoice([low, high], RULES)).toBe(asChoice(best, low, high));
    expect(referenceStrategy(RULES)([low, high])).toBe(asChoice(best, low, high));
    expect(referenceStrategy(RULES)([high, low])).toBe(best === 'stand' ? 'stand' : 'lock-0');
  });

  it('prices the choices as the brief describes the close calls', () => {
    const value = (low: DieFace, high: DieFace, play: Play) =>
      evaluate(low, high, true).values[play].toString();
    // 6-2 stands on 8, worth +1/6, against a re-roll keeping the 6 worth 13/27 − 2/5.
    expect([value(2, 6, 'stand'), value(2, 6, 'reroll the low die')]).toEqual(['1/6', '11/135']);
    // 2-2 stands: 4 is worth −5/6, a re-roll keeping a 2 −13/27 − 2/5.
    expect([value(2, 2, 'stand'), value(2, 2, 'reroll the low die')]).toEqual(['-5/6', '-119/135']);
    // 1-1 re-rolls for free: −73/108 beats standing on 2, a sure loss.
    expect([value(1, 1, 'stand'), value(1, 1, 'reroll the low die')]).toEqual(['-1', '-73/108']);
    // The closest calls: 3-2 and 5-2 re-roll by 1/60 of the bet.
    for (const high of [3, 5] as const) {
      const { values } = evaluate(2, high, true);
      expect(values['reroll the low die'].sub(values.stand).toString()).toBe('1/60');
    }
  });

  it('derives the house edge exactly: 4.07% with the free 1-1, 4.97% without', () => {
    const played = edge(true);
    expect(played.houseEdge.toString()).toBe('791/19440');
    expect((played.houseEdge.toNumber() * 100).toFixed(2)).toBe('4.07');
    const without = edge(false);
    expect(without.houseEdge.toString()).toBe('161/3240');
    expect((without.houseEdge.toNumber() * 100).toFixed(2)).toBe('4.97');
    // Without the free re-roll, 1-1 stands: a sure loss beats paying 40% for −73/108.
    expect(evaluate(1, 1, false).best).toBe('stand');
    // The free 1-1 is worth 1/36 × (1 − 73/108) = 35/3888 of the bet to the player.
    expect(without.houseEdge.sub(played.houseEdge).toString()).toBe('35/3888');
  });

  it('re-rolls in 44–47% of rounds: 17/36 with the free 1-1, 16/36 without', () => {
    expect(edge(true).rerolls.toString()).toBe('17/36'); // 47.2%
    expect(edge(false).rerolls.toString()).toBe('4/9'); // 44.4%
  });

  it('agrees with strategy.ts on every figure of the strategy', () => {
    const math = strategyMath(RULES, INFINITE_SHOE);
    expect(math.rtp.equals(ONE.sub(edge(true).houseEdge))).toBe(true);
    expect(math.rerollFrequency.equals(edge(true).rerolls)).toBe(true);
    expect(math.feeFrequency.toString()).toBe('4/9'); // 1-1 re-rolls without paying
    expect(math.averageFee.toString()).toBe('8/45'); // 40% of the bet in 4/9 of rounds
    expect(math.hitFrequency.toString()).toBe('4421/7776');
    expect(math.elementOfRisk.toString()).toBe('791/22896'); // the loss ÷ (1 + 8/45)
    const without = strategyMath(WITHOUT_FREE, INFINITE_SHOE);
    expect(without.rtp.equals(ONE.sub(edge(false).houseEdge))).toBe(true);
    expect(without.rerollFrequency.toString()).toBe('4/9');
  });

  it('keeps the same strategy on the six-deck shoe, where it returns a little more', () => {
    const shoe = shoeTotals(LOCK_AND_ROLL_CONFIG.decks);
    for (const [low, high] of ROLLS) {
      const dice: DicePair = [low, high];
      expect(bestChoice(dice, RULES, shoe), `${low}-${high}`).toBe(bestChoice(dice, RULES));
    }
    const six = strategyMath(RULES, shoe);
    expect(six.rtp.toString()).toBe('148219/154440'); // 95.97%: 6221/154440 = 4.03% house edge
    expect(six.rtp.compare(strategyMath(RULES).rtp)).toBe(1);
  });
});
