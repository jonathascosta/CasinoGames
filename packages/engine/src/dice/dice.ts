import { randomInt, type Rng } from '../rng/rng.ts';

export type DieFace = 1 | 2 | 3 | 4 | 5 | 6;

/** Two dice in the order they were rolled. */
export type DicePair = readonly [DieFace, DieFace];

export const DIE_FACES: readonly DieFace[] = [1, 2, 3, 4, 5, 6];

/** One fair six-sided die: exactly one Rng draw, uniform over 1–6. */
export function rollDie(rng: Rng): DieFace {
  return (randomInt(rng, 6) + 1) as DieFace;
}

/** Two dice, first die drawn first. */
export function rollDice(rng: Rng): DicePair {
  const first = rollDie(rng);
  const second = rollDie(rng);
  return [first, second];
}

export function diceTotal(dice: DicePair): number {
  return dice[0] + dice[1];
}

export function isDieFace(value: unknown): value is DieFace {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6;
}
