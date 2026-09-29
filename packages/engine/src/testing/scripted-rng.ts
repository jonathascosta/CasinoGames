import type { DieFace } from '../dice/dice.ts';
import type { Rng } from '../rng/rng.ts';

const TWO_POW_32 = 0x1_0000_0000;

/** An Rng that replays a fixed script and reports how much of it was used. */
export interface ScriptedRng extends Rng {
  /** Number of values consumed so far. */
  readonly consumed: number;
}

/**
 * Replays `values` (each in [0, 1)) in order and throws once the script runs
 * out, so a test fails loudly if a game draws more than expected.
 */
export function createScriptedRng(values: readonly number[]): ScriptedRng {
  let index = 0;
  return {
    get consumed() {
      return index;
    },
    next(): number {
      if (index >= values.length) {
        throw new Error(`Scripted Rng exhausted after ${values.length} draws`);
      }
      return values[index++]!;
    },
  };
}

/** The Rng value whose 32-bit reduction is exactly `k`. */
export function uint32ToUnit(k: number): number {
  if (!Number.isInteger(k) || k < 0 || k >= TWO_POW_32) {
    throw new RangeError(`Expected a uint32, got ${k}`);
  }
  return k / TWO_POW_32;
}

/**
 * Script values that make `randomInt(rng, n)` return each of `results` in
 * turn. Valid for every n because a small k is never in the rejected bucket.
 */
export function scriptForInts(results: readonly number[]): number[] {
  return results.map(uint32ToUnit);
}

/** Script values that make successive `rollDie` calls land on `faces`. */
export function scriptForDice(faces: readonly DieFace[]): number[] {
  return scriptForInts(faces.map((face) => face - 1));
}
