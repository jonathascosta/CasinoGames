import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../rng/seeded.ts';
import { createScriptedCardSource } from './scripted-cards.ts';

describe('createScriptedCardSource', () => {
  it('deals the scripted cards in order, then fails loudly', () => {
    const rng = createSeededRng(0);
    const source = createScriptedCardSource('AS TH 5D');
    expect(source.beginRound(rng)).toBe(false);
    expect([source.draw(rng), source.draw(rng)]).toEqual([
      { rank: 1, suit: 'spades' },
      { rank: 10, suit: 'hearts' },
    ]);
    expect(source.dealt).toBe(2);
    expect(source.remaining()).toBe(1);
    source.draw(rng);
    expect(() => source.draw(rng)).toThrow(/exhausted/);
  });
});
