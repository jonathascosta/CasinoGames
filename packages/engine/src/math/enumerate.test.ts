import { describe, expect, it } from 'vitest';
import { rollDice, rollDie } from '../dice/dice.ts';
import { Fraction } from './fraction.ts';
import { enumerateOutcomes } from './enumerate.ts';

function totalProbability(outcomes: Iterable<{ probability: Fraction }>): Fraction {
  let sum = Fraction.ZERO;
  for (const { probability } of outcomes) sum = sum.add(probability);
  return sum;
}

describe('enumerateOutcomes', () => {
  it('visits the 36 rolls of two dice, each with probability 1/36', () => {
    const outcomes = [...enumerateOutcomes((rng) => rollDice(rng))];
    expect(outcomes).toHaveLength(36);
    expect(outcomes[0]).toMatchObject({ value: [1, 1], draws: [0, 0] });
    expect(outcomes.at(-1)).toMatchObject({ value: [6, 6], draws: [5, 5] });
    expect(outcomes.every(({ probability }) => probability.equals(Fraction.of(1, 36)))).toBe(true);
  });

  it('follows branches of different depths', () => {
    // Roll again only on a six: 5 one-roll outcomes and 6 two-roll outcomes.
    const outcomes = [
      ...enumerateOutcomes((rng) => {
        const first = rollDie(rng);
        return first === 6 ? [first, rollDie(rng)] : [first];
      }),
    ];
    expect(outcomes).toHaveLength(11);
    expect(outcomes.filter((o) => o.value.length === 2)).toHaveLength(6);
    expect(totalProbability(outcomes).equals(Fraction.ONE)).toBe(true);
    expect(outcomes.find((o) => o.value.length === 2)!.probability.toString()).toBe('1/36');
  });

  it('handles mixed ranges (a die then a card from 52)', () => {
    let count = 0;
    let sum = Fraction.ZERO;
    for (const { probability } of enumerateOutcomes((rng) => [rollDie(rng), rng.nextInt(52)])) {
      count++;
      sum = sum.add(probability);
    }
    expect(count).toBe(6 * 52);
    expect(sum.equals(Fraction.ONE)).toBe(true);
  });

  it('refuses plain next() draws, which cannot be enumerated', () => {
    expect(() => [...enumerateOutcomes((rng) => rng.next())]).toThrow(/integer draws/);
  });

  it('detects a play function that is not deterministic', () => {
    let calls = 0;
    const flaky = enumerateOutcomes((rng) => (calls++ === 1 ? 0 : rollDie(rng)));
    expect(() => [...flaky]).toThrow(/not deterministic/);
  });

  it('stops at maxOutcomes', () => {
    expect(() => [...enumerateOutcomes((rng) => rollDice(rng), { maxOutcomes: 10 })]).toThrow(
      /More than 10 outcomes/,
    );
  });

  it('propagates errors thrown by the game', () => {
    const failing = enumerateOutcomes(() => {
      throw new TypeError('boom');
    });
    expect(() => [...failing]).toThrow(TypeError);
  });
});
