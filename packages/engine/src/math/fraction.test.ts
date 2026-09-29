import { describe, expect, it } from 'vitest';
import { Fraction } from './fraction.ts';

describe('Fraction', () => {
  it('normalises to lowest terms with a positive denominator', () => {
    expect(Fraction.of(6, 8).toString()).toBe('3/4');
    expect(Fraction.of(3, -4).toString()).toBe('-3/4');
    expect(Fraction.of(0, 5).equals(Fraction.ZERO)).toBe(true);
    expect(Fraction.of(10n, 5n).toString()).toBe('2');
  });

  it('does exact arithmetic', () => {
    const third = Fraction.of(1, 3);
    const sixth = Fraction.of(1, 6);
    expect(third.add(sixth).toString()).toBe('1/2');
    expect(third.sub(sixth).toString()).toBe('1/6');
    expect(third.mul(sixth).toString()).toBe('1/18');
    expect(third.div(sixth).toString()).toBe('2');
    expect(third.neg().toString()).toBe('-1/3');
  });

  it('sums 1/36 thirty-six times to exactly one', () => {
    let sum = Fraction.ZERO;
    for (let i = 0; i < 36; i++) sum = sum.add(Fraction.of(1, 36));
    expect(sum.equals(Fraction.ONE)).toBe(true);
  });

  it('compares', () => {
    expect(Fraction.of(35, 36).compare(Fraction.of(36, 37))).toBe(-1);
    expect(Fraction.of(2, 4).compare(Fraction.of(1, 2))).toBe(0);
    expect(Fraction.of(1, 2).compare(Fraction.of(-1, 2))).toBe(1);
  });

  it('converts to the nearest double', () => {
    expect(Fraction.of(35, 36).toNumber()).toBe(35 / 36);
    expect(Fraction.of(5, 6).toNumber()).toBe(5 / 6);
    expect(Fraction.of(120, 169).toNumber()).toBe(120 / 169);
    expect(Fraction.of(-7, 2).toNumber()).toBe(-3.5);
    const huge = Fraction.of(10n ** 40n + 1n, 3n * 10n ** 40n);
    expect(huge.toNumber()).toBeCloseTo(1 / 3, 15);
  });

  it('rejects zero denominators, division by zero and unsafe numbers', () => {
    expect(() => Fraction.of(1, 0)).toThrow(RangeError);
    expect(() => Fraction.ONE.div(Fraction.ZERO)).toThrow(RangeError);
    expect(() => Fraction.of(0.5)).toThrow(RangeError);
  });
});
