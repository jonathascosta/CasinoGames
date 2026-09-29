import { describe, expect, it } from 'vitest';
import { createDiceFixture } from '../fixtures/dice-fixture.ts';
import { createWarFixture, raiseOnEightOrBetter } from '../fixtures/war-fixture.ts';
import { createSeededRng } from '../rng/seeded.ts';
import { createScriptedCardSource } from '../testing/scripted-cards.ts';
import { playRound } from './play.ts';

describe('playRound', () => {
  it('plays a round without decisions to settlement', () => {
    const state = playRound(createDiceFixture(), { over: 100 }, createSeededRng(1));
    expect(state.phase).toBe('settled');
  });

  it('asks the strategy for each decision', () => {
    const game = createWarFixture(createScriptedCardSource('9S 4H'));
    const state = playRound(game, { ante: 100 }, createSeededRng(1), raiseOnEightOrBetter);
    expect(state.phase).toBe('settled');
    expect(state.bets).toEqual({ ante: 100, play: 100 });
  });

  it('requires a strategy when the game asks for a decision', () => {
    const game = createWarFixture(createScriptedCardSource('9S 4H'));
    expect(() => playRound(game, { ante: 100 }, createSeededRng(1))).toThrow(/strategy/);
  });
});
