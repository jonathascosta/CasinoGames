import { describe, expect, it } from 'vitest';
import { createSeededRng, type Seed } from './seeded.ts';

const TWO_POW_32 = 0x1_0000_0000;

function firstUint32s(seed: Seed, count: number): number[] {
  const rng = createSeededRng(seed);
  return Array.from({ length: count }, () => rng.next() * TWO_POW_32);
}

/**
 * Vectors produced by the reference C code of SplitMix64 and xoshiro128** 1.1
 * (https://prng.di.unimi.it/), seeding the four state words with the low and
 * high halves of the first two SplitMix64 outputs. String seeds are hashed
 * with FNV-1a 64 over UTF-8 first (e.g. 'entre-dados' → 0xa4e895682dd0dcbd).
 */
const REFERENCE_VECTORS: readonly (readonly [Seed, readonly number[]])[] = [
  [
    0,
    [
      3737715805, 2584255861, 2876756834, 3286328325, 1553311962, 1625202774, 3260698944,
      2754151956,
    ],
  ],
  [
    42,
    [1776835114, 4165204688, 17111135, 2317295270, 2792088233, 2554630222, 2940343271, 2244566231],
  ],
  [
    0xdeadbeef,
    [
      2848183187, 2643428161, 2173202904, 2114983966, 4104570023, 1778707404, 1578012846,
      2283634591,
    ],
  ],
  [
    'entre-dados',
    [3623662512, 2277839483, 1240470053, 2035840964, 635838086, 2076942927, 3933920999, 513495773],
  ],
  [
    'Alvo Móvel 🎲',
    [2517935802, 4036427837, 2043780429, 3023713416, 4044601193, 198571180, 4098011061, 3201455589],
  ],
];

describe('createSeededRng', () => {
  it.each(REFERENCE_VECTORS)(
    'matches the reference implementation for seed %j',
    (seed, expected) => {
      expect(firstUint32s(seed, expected.length)).toEqual(expected);
    },
  );

  it('reproduces the same stream for the same seed', () => {
    expect(firstUint32s('replay-me', 1000)).toEqual(firstUint32s('replay-me', 1000));
  });

  it('produces unrelated streams for adjacent seeds', () => {
    const a = firstUint32s(1, 100);
    const b = firstUint32s(2, 100);
    expect(a.filter((value, i) => value === b[i])).toHaveLength(0);
  });

  it('reduces numeric and bigint seeds modulo 2^64', () => {
    const minusOne = firstUint32s(-1, 8);
    expect(firstUint32s(2n ** 64n - 1n, 8)).toEqual(minusOne);
    expect(firstUint32s(0xffff_ffff_ffff_ffffn, 8)).toEqual(minusOne);
    expect(minusOne).toEqual([
      477689756, 2493998634, 555695776, 607808419, 61340979, 301466976, 2478485284, 2565876330,
    ]);
    expect(firstUint32s(7n, 8)).toEqual(firstUint32s(7, 8));
  });

  it('only yields values in [0, 1)', () => {
    const rng = createSeededRng('bounds');
    for (let i = 0; i < 100_000; i++) {
      const value = rng.next();
      expect(value >= 0 && value < 1).toBe(true);
    }
  });

  it.each([1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1, Infinity])(
    'rejects the non-integer or unsafe seed %s',
    (seed) => {
      expect(() => createSeededRng(seed)).toThrow(RangeError);
    },
  );
});
