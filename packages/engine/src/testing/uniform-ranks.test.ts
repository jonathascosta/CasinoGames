import { describe, expect, it } from 'vitest';
import { RANK_SETS } from '../cards/card.ts';
import { enumerateOutcomes } from '../math/enumerate.ts';
import { createSeededRng } from '../rng/seeded.ts';
import { createUniformRankSource } from './uniform-ranks.ts';

describe('createUniformRankSource', () => {
  it('branches once per rank, each with equal probability, in a fixed suit', () => {
    const source = createUniformRankSource(RANK_SETS.aceToSix, 'hearts');
    const outcomes = [...enumerateOutcomes((rng) => source.draw(rng))];
    expect(outcomes.map((outcome) => outcome.value)).toEqual(
      RANK_SETS.aceToSix.map((rank) => ({ rank, suit: 'hearts' })),
    );
    expect(outcomes.every((outcome) => outcome.probability.toString() === '1/6')).toBe(true);
  });

  it('is infinite and never shuffles', () => {
    const source = createUniformRankSource([1, 13]);
    const rng = createSeededRng('ranks');
    expect(source.beginRound(rng)).toBe(false);
    for (let i = 0; i < 100; i++) expect([1, 13]).toContain(source.draw(rng).rank);
    expect(source.remaining()).toBe(Infinity);
    expect(source.size()).toBe(Infinity);
    expect(source.shuffleCount()).toBe(0);
  });

  it('rejects empty or repeated rank lists', () => {
    expect(() => createUniformRankSource([])).toThrow(RangeError);
    expect(() => createUniformRankSource([2, 2])).toThrow(RangeError);
  });
});
