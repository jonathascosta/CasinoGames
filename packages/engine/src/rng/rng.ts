/**
 * The single source of randomness for every game.
 *
 * Games never call Math.random (lint enforces it): they receive an Rng and
 * draw from it, which makes every round reproducible from a seed in tests and
 * lets a server swap in a certified RNG without touching game code.
 */
export interface Rng {
  /**
   * A uniformly distributed number in [0, 1) carrying at least 32 bits of
   * randomness. Both built-in sources return exactly k / 2^32.
   */
  next(): number;
}

const TWO_POW_32 = 0x1_0000_0000;

/**
 * A uniformly distributed integer in [0, n), free of modulo bias.
 *
 * The draw is reduced to a 32-bit integer and values from the incomplete top
 * bucket (2^32 mod n of them) are rejected and redrawn, so each result has
 * probability exactly 1/n given a uniform 32-bit source. A naive
 * `Math.floor(next() * n)` is biased for any n that is not a power of two,
 * which certification labs flag.
 */
export function randomInt(rng: Rng, n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > TWO_POW_32) {
    throw new RangeError(`randomInt: n must be an integer in [1, 2^32], got ${n}`);
  }
  const limit = TWO_POW_32 - (TWO_POW_32 % n);
  for (;;) {
    const u = rng.next();
    if (!(u >= 0 && u < 1)) {
      throw new RangeError(`Rng.next() must return a number in [0, 1), got ${u}`);
    }
    const x = Math.floor(u * TWO_POW_32);
    if (x < limit) return x % n;
  }
}

/**
 * Shuffles `items` in place with the Fisher–Yates (Durstenfeld) algorithm and
 * returns the same array. Every permutation is equally likely given a uniform
 * Rng; the draw order (from the last index down) is part of the determinism
 * contract.
 */
export function shuffleInPlace<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    const held = items[i]!;
    items[i] = items[j]!;
    items[j] = held;
  }
  return items;
}
