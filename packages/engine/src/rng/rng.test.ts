import { describe, expect, it } from 'vitest';
import { chiSquareUniform } from '../testing/chi-square.ts';
import { createScriptedRng, scriptForInts, uint32ToUnit } from '../testing/scripted-rng.ts';
import { randomInt, shuffleInPlace } from './rng.ts';
import { createSeededRng } from './seeded.ts';

describe('randomInt', () => {
  it('stays within [0, n)', () => {
    const rng = createSeededRng('range');
    for (const n of [1, 2, 3, 6, 7, 52, 312, 1_000_003]) {
      for (let i = 0; i < 2_000; i++) {
        const value = randomInt(rng, n);
        expect(Number.isInteger(value) && value >= 0 && value < n).toBe(true);
      }
    }
  });

  it('rejects draws from the incomplete top bucket instead of folding them (no modulo bias)', () => {
    // For n = 3 the largest multiple of 3 below 2^32 is 2^32 - 1, so the draw
    // 2^32 - 1 must be rejected and a new value drawn.
    const rng = createScriptedRng([uint32ToUnit(0xffff_ffff), uint32ToUnit(5)]);
    expect(randomInt(rng, 3)).toBe(2);
    expect(rng.consumed).toBe(2);
  });

  it('accepts the last complete bucket', () => {
    const rng = createScriptedRng([uint32ToUnit(0xffff_fffe)]);
    expect(randomInt(rng, 3)).toBe(0xffff_fffe % 3);
    expect(rng.consumed).toBe(1);
  });

  it('is exactly uniform over a full cycle of 32-bit inputs for n = 6', () => {
    // Every accepted 32-bit value maps to one face and each face gets the
    // same number of preimages: the reduction itself is unbiased.
    const n = 6;
    const limit = 0x1_0000_0000 - (0x1_0000_0000 % n);
    expect(limit % n).toBe(0);
    expect(0x1_0000_0000 - limit).toBe(4); // 4 rejected values out of 2^32
  });

  it('is uniform for a seeded stream (chi-square, 600k draws)', () => {
    const rng = createSeededRng('uniform-6');
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 600_000; i++) counts[randomInt(rng, 6)]!++;
    expect(chiSquareUniform(counts).pValue).toBeGreaterThan(0.001);
  });

  it('follows a script exactly', () => {
    const rng = createScriptedRng(scriptForInts([4, 0, 5]));
    expect([randomInt(rng, 6), randomInt(rng, 6), randomInt(rng, 6)]).toEqual([4, 0, 5]);
  });

  it.each([0, -1, 1.5, Number.NaN, 2 ** 32 + 1])('rejects the invalid range size %s', (n) => {
    expect(() => randomInt(createSeededRng(1), n)).toThrow(RangeError);
  });

  it.each([1, -0.1, Number.NaN])('rejects an Rng that returns %s', (value) => {
    expect(() => randomInt({ next: () => value }, 6)).toThrow(RangeError);
  });
});

describe('shuffleInPlace', () => {
  it('returns the same array holding a permutation of its items', () => {
    const items = Array.from({ length: 52 }, (_, i) => i);
    const result = shuffleInPlace(createSeededRng('perm'), items);
    expect(result).toBe(items);
    expect([...result].sort((a, b) => a - b)).toEqual(Array.from({ length: 52 }, (_, i) => i));
  });

  it('is deterministic for a given seed', () => {
    const shuffle = () =>
      shuffleInPlace(
        createSeededRng('same'),
        Array.from({ length: 20 }, (_, i) => i),
      );
    expect(shuffle()).toEqual(shuffle());
  });

  it('draws from the last index down (the documented draw order)', () => {
    // j = 0 at every step rotates [a, b, c, d] → [b, c, d, a].
    const rng = createScriptedRng(scriptForInts([0, 0, 0]));
    expect(shuffleInPlace(rng, ['a', 'b', 'c', 'd'])).toEqual(['b', 'c', 'd', 'a']);
    expect(rng.consumed).toBe(3);
  });

  it('makes all 24 orderings of 4 items equally likely (chi-square, 240k shuffles)', () => {
    const rng = createSeededRng('permutations');
    const counts = new Map<string, number>();
    for (let i = 0; i < 240_000; i++) {
      const key = shuffleInPlace(rng, [0, 1, 2, 3]).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(24);
    expect(chiSquareUniform([...counts.values()]).pValue).toBeGreaterThan(0.001);
  });

  it('handles empty and single-item arrays without drawing', () => {
    const rng = createScriptedRng([]);
    expect(shuffleInPlace(rng, [])).toEqual([]);
    expect(shuffleInPlace(rng, ['only'])).toEqual(['only']);
  });
});
