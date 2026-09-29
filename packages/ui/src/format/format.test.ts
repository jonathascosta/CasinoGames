import { describe, expect, it } from 'vitest';
import { formatCents, formatChip, formatCount, formatPercent, formatPoints } from './format.ts';

describe('formatCents', () => {
  it('formats integer cents with two decimals and grouping', () => {
    expect(formatCents(0)).toBe('0.00');
    expect(formatCents(50)).toBe('0.50');
    expect(formatCents(123_456)).toBe('1,234.56');
  });

  it('uses a true minus sign and an optional plus sign', () => {
    expect(formatCents(-2_550)).toBe('−25.50');
    expect(formatCents(2_550, { sign: true })).toBe('+25.50');
    expect(formatCents(0, { sign: true })).toBe('0.00');
  });
});

describe('formatChip', () => {
  it('labels chips compactly', () => {
    expect([50, 100, 500, 2_500, 10_000, 100_000].map(formatChip)).toEqual([
      '0.5',
      '1',
      '5',
      '25',
      '100',
      '1K',
    ]);
  });
});

describe('percentages', () => {
  it('formats ratios and differences in points', () => {
    expect(formatPercent(35 / 36)).toBe('97.22%');
    expect(formatPercent(Number.NaN)).toBe('—');
    expect(formatPoints(0.0038)).toBe('+0.38 pp');
    expect(formatPoints(-0.0125)).toBe('−1.25 pp');
    expect(formatPoints(-0.00001)).toBe('0.00 pp');
  });

  it('groups counts', () => {
    expect(formatCount(2_000_000)).toBe('2,000,000');
  });
});
