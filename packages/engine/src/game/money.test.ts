import { describe, expect, it } from 'vitest';
import { EngineError } from './errors.ts';
import { isCents, odds, oddsLabel, oddsMultiplier, winnings } from './money.ts';

describe('odds', () => {
  it('builds and labels "to" odds', () => {
    expect(odds(3, 2)).toEqual({ to: 3, per: 2 });
    expect(odds(1)).toEqual({ to: 1, per: 1 });
    expect(oddsLabel(odds(9, 2))).toBe('9 to 2');
  });

  it('gives the total return per unit staked', () => {
    expect(oddsMultiplier(odds(1))).toBe(2);
    expect(oddsMultiplier(odds(3, 2))).toBe(2.5);
    expect(oddsMultiplier(odds(0))).toBe(1);
  });

  it.each([
    [-1, 1],
    [1, 0],
    [1.5, 1],
    [1, 2.5],
  ])('rejects %d to %d', (to, per) => {
    expect(() => odds(to, per)).toThrow(EngineError);
  });
});

describe('winnings', () => {
  it('pays exactly when the stake divides evenly', () => {
    expect(winnings(200, odds(3, 2))).toBe(300);
    expect(winnings(50, odds(6, 5))).toBe(60);
    expect(winnings(50, odds(1, 2))).toBe(25);
  });

  it('rounds fractional cents down (breakage)', () => {
    expect(winnings(25, odds(3, 2))).toBe(37); // 37.5¢
    expect(winnings(1, odds(1, 2))).toBe(0); // 0.5¢
  });
});

describe('isCents', () => {
  it('accepts safe integers only', () => {
    expect([0, 1, -5, 1_000_000].every(isCents)).toBe(true);
    expect([0.5, Number.NaN, Infinity, 2 ** 53, '5'].some(isCents)).toBe(false);
  });
});
