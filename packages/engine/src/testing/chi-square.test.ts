import { describe, expect, it } from 'vitest';
import { chiSquareTest, chiSquareUniform, logGamma, regularizedGammaQ } from './chi-square.ts';

describe('regularizedGammaQ', () => {
  // Reference values from mpmath (30 significant digits).
  it.each([
    [3.841458820694124, 1, 0.05],
    [11.070497693516351, 5, 0.05],
    [18.307038053275146, 10, 0.05],
    [49.72823247, 23, 0.000999999998925766],
    [0.5, 4, 0.9735009788392561],
    [100, 51, 0.0000499813137199826],
    [30, 40, 0.8752187849674752],
  ])('gives the chi-square tail p for statistic %d with %d degrees of freedom', (x, df, p) => {
    expect(regularizedGammaQ(df / 2, x / 2)).toBeCloseTo(p, 10);
  });

  it('is 1 at x = 0 and rejects invalid arguments', () => {
    expect(regularizedGammaQ(2, 0)).toBe(1);
    expect(() => regularizedGammaQ(0, 1)).toThrow(RangeError);
    expect(() => regularizedGammaQ(1, -1)).toThrow(RangeError);
  });
});

describe('logGamma', () => {
  it.each([
    [0.5, 0.5723649429247001],
    [2.5, 0.2846828704729192],
    [10, 12.80182748008147],
  ])('ln Γ(%d) ≈ %d', (z, expected) => {
    expect(logGamma(z)).toBeCloseTo(expected, 12);
  });
});

describe('chiSquareTest', () => {
  it('computes the Pearson statistic', () => {
    const result = chiSquareTest([10, 20, 30], [1 / 3, 1 / 3, 1 / 3]);
    expect(result.statistic).toBeCloseTo(10, 12);
    expect(result.degreesOfFreedom).toBe(2);
    expect(result.pValue).toBeCloseTo(Math.exp(-5), 12); // Q(1, 5) = e^-5
  });

  it('accepts a perfect fit and rejects an obviously skewed one', () => {
    expect(chiSquareUniform([100, 100, 100, 100]).pValue).toBe(1);
    expect(chiSquareUniform([400, 100, 100, 100]).pValue).toBeLessThan(1e-12);
  });

  it('rejects mismatched inputs', () => {
    expect(() => chiSquareTest([1, 2], [1])).toThrow(RangeError);
    expect(() => chiSquareTest([1], [1])).toThrow(RangeError);
  });
});
