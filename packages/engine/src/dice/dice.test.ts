import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../rng/seeded.ts';
import { chiSquareTest, chiSquareUniform } from '../testing/chi-square.ts';
import { createScriptedRng, scriptForDice } from '../testing/scripted-rng.ts';
import { DIE_FACES, diceTotal, isDieFace, rollDice, rollDie } from './dice.ts';

describe('rollDie', () => {
  it('returns a face from 1 to 6 using exactly one draw', () => {
    const rng = createScriptedRng(scriptForDice([4]));
    expect(rollDie(rng)).toBe(4);
    expect(rng.consumed).toBe(1);
  });

  it('is uniform over the six faces (chi-square, 600k rolls)', () => {
    const rng = createSeededRng('die');
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 600_000; i++) counts[rollDie(rng) - 1]!++;
    expect(chiSquareUniform(counts).pValue).toBeGreaterThan(0.001);
  });
});

describe('rollDice', () => {
  it('rolls the first die first', () => {
    const rng = createScriptedRng(scriptForDice([6, 2]));
    expect(rollDice(rng)).toEqual([6, 2]);
    expect(rng.consumed).toBe(2);
  });

  it('reproduces the same rolls for the same seed', () => {
    const roll = (seed: string) => {
      const rng = createSeededRng(seed);
      return Array.from({ length: 50 }, () => rollDice(rng));
    };
    expect(roll('dice')).toEqual(roll('dice'));
    expect(roll('dice')).not.toEqual(roll('other'));
  });

  it('gives the triangular 2–12 distribution of totals (chi-square, 720k rolls)', () => {
    const rng = createSeededRng('totals');
    const counts = new Array<number>(11).fill(0);
    for (let i = 0; i < 720_000; i++) counts[diceTotal(rollDice(rng)) - 2]!++;
    // P(total = t) = (6 − |t − 7|) / 36
    const probabilities = counts.map((_, i) => (6 - Math.abs(i + 2 - 7)) / 36);
    expect(chiSquareTest(counts, probabilities).pValue).toBeGreaterThan(0.001);
  });
});

describe('dice helpers', () => {
  it('lists the faces and validates values', () => {
    expect(DIE_FACES).toEqual([1, 2, 3, 4, 5, 6]);
    expect(DIE_FACES.every(isDieFace)).toBe(true);
    expect([0, 7, 2.5, '3', null].some(isDieFace)).toBe(false);
  });

  it('adds a pair', () => {
    expect(diceTotal([6, 5])).toBe(11);
  });
});
