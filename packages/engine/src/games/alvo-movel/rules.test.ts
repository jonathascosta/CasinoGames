import { describe, expect, it } from 'vitest';
import { oddsLabel } from '../../game/money.ts';
import {
  ACERTA_ODDS,
  ALVO_MOVEL_BET_IDS,
  TARGETS,
  alvoMovelOutlook,
  cardValue,
  readAlvoMovelDeal,
  resolveAlvoMovelBet,
  targetOf,
  type AlvoMovelBetId,
  type AlvoMovelOutlook,
  type Target,
} from './rules.ts';

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('Alvo Móvel rules', () => {
  it('pays Acerta by target as published', () => {
    expect(TARGETS.map((target) => `${target}: ${oddsLabel(ACERTA_ODDS[target])}`)).toEqual([
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
    expect(readAlvoMovelDeal(9, [])).toEqual({
      target: 9,
      total: 0,
      cards: 0,
      done: false,
      hit: false,
      over: 0,
    });
    expect(readAlvoMovelDeal(9, [4, 5])).toMatchObject({
      total: 9,
      done: true,
      hit: true,
      over: 0,
    });
    expect(readAlvoMovelDeal(9, [4, 3])).toMatchObject({ total: 7, done: false, hit: false });
    expect(readAlvoMovelDeal(9, [4, 3, 10])).toMatchObject({ total: 17, done: true, over: 8 });
  });

  it('refuses card values outside 1–10 and cards after the target was reached', () => {
    expect(() => readAlvoMovelDeal(9, [0])).toThrow(RangeError);
    expect(() => readAlvoMovelDeal(9, [11])).toThrow(RangeError);
    expect(() => readAlvoMovelDeal(9, [2.5])).toThrow(RangeError);
    expect(() => readAlvoMovelDeal(9, [9, 1])).toThrow(RangeError);
    expect(() => resolveAlvoMovelBet('acerta', 9, [4])).toThrow(/not finished/);
  });

  it.each<[Target, number[], Record<AlvoMovelBetId, string>]>([
    [7, [3, 4], { acerta: 'win 9 to 2', 'primeira-carta': 'lose', 'tres-ou-mais': 'lose' }],
    [
      7,
      [2, 2, 3],
      { acerta: 'win 9 to 2', 'primeira-carta': 'lose', 'tres-ou-mais': 'win 4 to 1' },
    ],
    [5, [5], { acerta: 'win 11 to 2', 'primeira-carta': 'win 9 to 1', 'tres-ou-mais': 'lose' }],
    [5, [8], { acerta: 'lose', 'primeira-carta': 'lose', 'tres-ou-mais': 'lose' }],
    [2, [1, 1], { acerta: 'win 15 to 2', 'primeira-carta': 'lose', 'tres-ou-mais': 'lose' }],
    [12, [10, 5], { acerta: 'lose', 'primeira-carta': 'lose', 'tres-ou-mais': 'lose' }],
    [
      12,
      [1, 1, 1, 9],
      { acerta: 'win 5 to 1', 'primeira-carta': 'lose', 'tres-ou-mais': 'win 4 to 1' },
    ],
    [11, [1, 2, 3, 7], { acerta: 'lose', 'primeira-carta': 'lose', 'tres-ou-mais': 'win 4 to 1' }],
  ])('target %i, cards %j', (target, values, expected) => {
    const settled = Object.fromEntries(
      ALVO_MOVEL_BET_IDS.map((bet) => {
        const result = resolveAlvoMovelBet(bet, target, values);
        return [bet, result.outcome === 'win' ? `win ${oddsLabel(result.odds)}` : 'lose'];
      }),
    );
    expect(settled).toEqual(expected);
  });

  it('names the paytable line that decided a win', () => {
    expect(resolveAlvoMovelBet('acerta', 8, [3, 5])).toMatchObject({ entryId: 'target-8' });
    expect(resolveAlvoMovelBet('primeira-carta', 8, [8])).toMatchObject({ entryId: 'first-card' });
    expect(resolveAlvoMovelBet('tres-ou-mais', 8, [1, 2, 5])).toMatchObject({
      entryId: 'three-or-more',
    });
  });

  describe('outlook as the cards land', () => {
    /**
     * Every way a deal can go on from `values`: the outcomes the bet can
     * still reach, found by dealing every card value in turn.
     */
    function reachable(bet: AlvoMovelBetId, target: Target, values: number[]): Set<string> {
      const total = values.reduce((sum, value) => sum + value, 0);
      if (total >= target) return new Set([resolveAlvoMovelBet(bet, target, values).outcome]);
      const outcomes = new Set<string>();
      for (const value of VALUES) {
        for (const outcome of reachable(bet, target, [...values, value])) outcomes.add(outcome);
        if (outcomes.size === 2) break; // both outcomes still possible: nothing more to learn
      }
      return outcomes;
    }

    function expected(bet: AlvoMovelBetId, target: Target, values: number[]): AlvoMovelOutlook {
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
        for (const bet of ALVO_MOVEL_BET_IDS) {
          expect(alvoMovelOutlook(bet, target, values), `${bet} ${values.join(',')}`).toBe(
            expected(bet, target, values),
          );
        }
      }
    });

    it('decides the side bets early where the cards allow', () => {
      expect(alvoMovelOutlook('primeira-carta', 11, [])).toBe('lost');
      expect(alvoMovelOutlook('tres-ou-mais', 2, [])).toBe('lost');
      // An ace towards 12: two cards cannot get there, so a third is certain.
      expect(alvoMovelOutlook('tres-ou-mais', 12, [1])).toBe('won');
      expect(alvoMovelOutlook('tres-ou-mais', 12, [2])).toBe('live');
    });
  });
});
