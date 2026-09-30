import { describe, expect, it } from 'vitest';
import { oddsLabel } from '../../game/money.ts';
import {
  EXACT_HIT_ODDS,
  MOVING_TARGET_BET_IDS,
  TARGETS,
  movingTargetOutlook,
  cardValue,
  readMovingTargetDeal,
  resolveMovingTargetBet,
  targetOf,
  type MovingTargetBetId,
  type MovingTargetOutlook,
  type Target,
} from './rules.ts';

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('Moving Target rules', () => {
  it('pays Exact Hit by target as published', () => {
    expect(TARGETS.map((target) => `${target}: ${oddsLabel(EXACT_HIT_ODDS[target])}`)).toEqual([
      '2: 15 to 2',
      '3: 7 to 1',
      '4: 6 to 1',
      '5: 11 to 2',
      '6: 5 to 1',
      '7: 9 to 2',
      '8: 4 to 1',
      '9: 7 to 2',
      '10: 3 to 1',
      '11: 5 to 1',
      '12: 5 to 1',
    ]);
  });

  it('takes the sum of the dice as the target and counts cards at face value', () => {
    expect(targetOf([1, 1])).toBe(2);
    expect(targetOf([6, 5])).toBe(11);
    expect(VALUES.map((value) => cardValue(value as 1))).toEqual(VALUES);
    expect(() => cardValue(11)).toThrow(RangeError);
    expect(() => cardValue(13)).toThrow(RangeError);
  });

  it('reads a deal against its target', () => {
    expect(readMovingTargetDeal(9, [])).toEqual({
      target: 9,
      total: 0,
      cards: 0,
      done: false,
      hit: false,
      over: 0,
    });
    expect(readMovingTargetDeal(9, [4, 5])).toMatchObject({
      total: 9,
      done: true,
      hit: true,
      over: 0,
    });
    expect(readMovingTargetDeal(9, [4, 3])).toMatchObject({ total: 7, done: false, hit: false });
    expect(readMovingTargetDeal(9, [4, 3, 10])).toMatchObject({ total: 17, done: true, over: 8 });
  });

  it('refuses card values outside 1–10 and cards after the target was reached', () => {
    expect(() => readMovingTargetDeal(9, [0])).toThrow(RangeError);
    expect(() => readMovingTargetDeal(9, [11])).toThrow(RangeError);
    expect(() => readMovingTargetDeal(9, [2.5])).toThrow(RangeError);
    expect(() => readMovingTargetDeal(9, [9, 1])).toThrow(RangeError);
    expect(() => resolveMovingTargetBet('exact-hit', 9, [4])).toThrow(/not finished/);
  });

  it.each<[Target, number[], Record<MovingTargetBetId, string>]>([
    [7, [3, 4], { 'exact-hit': 'win 9 to 2', 'first-card': 'lose', 'three-plus-cards': 'lose' }],
    [
      7,
      [2, 2, 3],
      { 'exact-hit': 'win 9 to 2', 'first-card': 'lose', 'three-plus-cards': 'win 4 to 1' },
    ],
    [
      5,
      [5],
      { 'exact-hit': 'win 11 to 2', 'first-card': 'win 9 to 1', 'three-plus-cards': 'lose' },
    ],
    [5, [8], { 'exact-hit': 'lose', 'first-card': 'lose', 'three-plus-cards': 'lose' }],
    [2, [1, 1], { 'exact-hit': 'win 15 to 2', 'first-card': 'lose', 'three-plus-cards': 'lose' }],
    [12, [10, 5], { 'exact-hit': 'lose', 'first-card': 'lose', 'three-plus-cards': 'lose' }],
    [
      12,
      [1, 1, 1, 9],
      { 'exact-hit': 'win 5 to 1', 'first-card': 'lose', 'three-plus-cards': 'win 4 to 1' },
    ],
    [
      11,
      [1, 2, 3, 7],
      { 'exact-hit': 'lose', 'first-card': 'lose', 'three-plus-cards': 'win 4 to 1' },
    ],
  ])('target %i, cards %j', (target, values, expected) => {
    const settled = Object.fromEntries(
      MOVING_TARGET_BET_IDS.map((bet) => {
        const result = resolveMovingTargetBet(bet, target, values);
        return [bet, result.outcome === 'win' ? `win ${oddsLabel(result.odds)}` : 'lose'];
      }),
    );
    expect(settled).toEqual(expected);
  });

  it('names the paytable line that decided a win', () => {
    expect(resolveMovingTargetBet('exact-hit', 8, [3, 5])).toMatchObject({ entryId: 'target-8' });
    expect(resolveMovingTargetBet('first-card', 8, [8])).toMatchObject({ entryId: 'first-card' });
    expect(resolveMovingTargetBet('three-plus-cards', 8, [1, 2, 5])).toMatchObject({
      entryId: 'three-or-more',
    });
  });

  describe('outlook as the cards land', () => {
    /**
     * Every way a deal can go on from `values`: the outcomes the bet can
     * still reach, found by dealing every card value in turn.
     */
    function reachable(bet: MovingTargetBetId, target: Target, values: number[]): Set<string> {
      const total = values.reduce((sum, value) => sum + value, 0);
      if (total >= target) return new Set([resolveMovingTargetBet(bet, target, values).outcome]);
      const outcomes = new Set<string>();
      for (const value of VALUES) {
        for (const outcome of reachable(bet, target, [...values, value])) outcomes.add(outcome);
        if (outcomes.size === 2) break; // both outcomes still possible: nothing more to learn
      }
      return outcomes;
    }

    function expected(
      bet: MovingTargetBetId,
      target: Target,
      values: number[],
    ): MovingTargetOutlook {
      const outcomes = reachable(bet, target, values);
      if (outcomes.size > 1) return 'live';
      return outcomes.has('win') ? 'won' : 'lost';
    }

    /** Every deal prefix up to three cards, and the finished deals among them. */
    function prefixes(target: Target): number[][] {
      const all: number[][] = [[]];
      // Breadth first: the loop also visits the prefixes it appends.
      for (const values of all) {
        const total = values.reduce((sum, value) => sum + value, 0);
        if (total >= target || values.length === 3) continue;
        for (const value of VALUES) all.push([...values, value]);
      }
      return all;
    }

    it.each(TARGETS)('matches every continuation for target %i', (target) => {
      for (const values of prefixes(target)) {
        for (const bet of MOVING_TARGET_BET_IDS) {
          expect(movingTargetOutlook(bet, target, values), `${bet} ${values.join(',')}`).toBe(
            expected(bet, target, values),
          );
        }
      }
    });

    it('decides the side bets early where the cards allow', () => {
      expect(movingTargetOutlook('first-card', 11, [])).toBe('lost');
      expect(movingTargetOutlook('three-plus-cards', 2, [])).toBe('lost');
      // An ace towards 12: two cards cannot get there, so a third is certain.
      expect(movingTargetOutlook('three-plus-cards', 12, [1])).toBe('won');
      expect(movingTargetOutlook('three-plus-cards', 12, [2])).toBe('live');
    });
  });
});
