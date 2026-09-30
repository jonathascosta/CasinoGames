import { describe, expect, it } from 'vitest';
import { cardCode } from '../../cards/card.ts';
import type { DieFace } from '../../dice/dice.ts';
import { EngineError } from '../../game/errors.ts';
import type { Bets, GameEvent } from '../../game/types.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import { createScriptedCardSource } from '../../testing/scripted-cards.ts';
import { createScriptedRng, scriptForDice } from '../../testing/scripted-rng.ts';
import { ALVO_MOVEL_BETS } from './bets.ts';
import {
  ALVO_MOVEL_DEALER,
  alvoMovelMathSummary,
  createAlvoMovel,
  createAlvoMovelShoe,
} from './game.ts';

const ALL = { acerta: 100, 'primeira-carta': 100, 'tres-ou-mais': 100 };

/** Plays one round with the given dice and card codes. */
function play(dice: readonly [DieFace, DieFace], cards: string, bets: Bets) {
  const game = createAlvoMovel({ source: createScriptedCardSource(cards) });
  return game.start(bets, createScriptedRng(scriptForDice(dice)));
}

function describeEvent(event: GameEvent): string {
  if (event.type === 'dice-rolled') return `dice ${event.dice.join('-')}`;
  if (event.type === 'card-dealt') {
    return `deal ${cardCode(event.card)} to ${event.to} ${event.faceUp ? 'up' : 'down'}`;
  }
  if (event.type === 'bet-settled') return `${event.betId} ${event.outcome} ${event.payout}`;
  return event.type;
}

describe('Alvo Móvel round', () => {
  it('rolls the target, deals face up until the total reaches it, and settles', () => {
    const state = play([3, 4], '3H 4S 9D', ALL);
    expect(state.phase).toBe('settled');
    expect(state.options).toEqual([]);
    expect(state.events.map(describeEvent)).toEqual([
      'round-started',
      'dice 3-4',
      `deal 3H to ${ALVO_MOVEL_DEALER} up`,
      `deal 4S to ${ALVO_MOVEL_DEALER} up`,
      'acerta win 550',
      'primeira-carta lose 0',
      'tres-ou-mais lose 0',
      'round-settled',
    ]);
    expect(state.events.at(-1)).toEqual({
      type: 'round-settled',
      totalStake: 300,
      totalPayout: 550,
      net: 250,
    });
    expect(state.settlement.acerta).toEqual({
      stake: 100,
      payout: 550,
      net: 450,
      outcome: 'win',
      entryId: 'target-7',
    });
  });

  it('pays Três ou Mais when a third card is needed, and Primeira Carta on a first-card hit', () => {
    expect(play([3, 4], '2C 2D 3S', ALL).settlement).toMatchObject({
      acerta: { payout: 550, outcome: 'win' },
      'primeira-carta': { payout: 0, outcome: 'lose' },
      'tres-ou-mais': { payout: 500, outcome: 'win', entryId: 'three-or-more' },
    });
    expect(play([1, 4], '5H', ALL).settlement).toMatchObject({
      acerta: { payout: 650, entryId: 'target-5' },
      'primeira-carta': { payout: 1000, entryId: 'first-card' },
      'tres-ou-mais': { payout: 0 },
    });
  });

  it('pays 15 to 2 on a target of 2 and loses everything past the target', () => {
    expect(play([1, 1], 'AS AH', { acerta: 200 }).settlement.acerta).toMatchObject({
      payout: 1700,
      entryId: 'target-2',
    });
    const over = play([6, 6], 'TS 5H', ALL);
    expect(Object.values(over.settlement).map((line) => line.outcome)).toEqual([
      'lose',
      'lose',
      'lose',
    ]);
    expect(over.events.filter((event) => event.type === 'card-dealt')).toHaveLength(2);
  });

  it('deals up to twelve cards: aces towards a target of 12', () => {
    const state = play([6, 6], 'AS AH AD AC AS AH AD AC AS AH AD AC', ALL);
    expect(state.events.filter((event) => event.type === 'card-dealt')).toHaveLength(12);
    expect(state.settlement.acerta).toMatchObject({ payout: 600, outcome: 'win' });
    expect(state.settlement['tres-ou-mais']).toMatchObject({ outcome: 'win' });
  });

  it('requires the Acerta bet for side bets, and enforces the limits', () => {
    const code = (bets: Bets) => {
      try {
        play([3, 4], '7S', bets);
      } catch (error) {
        return error instanceof EngineError ? error.code : String(error);
      }
      return 'ok';
    };
    expect(code({ 'tres-ou-mais': 100 })).toBe('MAIN_BET_REQUIRED');
    expect(code({ acerta: 25 })).toBe('STAKE_BELOW_MIN');
    expect(code({ acerta: 100, 'primeira-carta': 5_000 })).toBe('STAKE_ABOVE_MAX');
    expect(code({ acerta: 100, nope: 100 })).toBe('UNKNOWN_BET');
    expect(code({ acerta: 25_000, 'primeira-carta': 2_500 })).toBe('ok');
  });

  it('deals from a six-deck shoe of aces to tens by default, shuffling on the first round', () => {
    const shoe = createAlvoMovelShoe();
    expect(shoe.size()).toBe(240);
    const game = createAlvoMovel({ source: shoe });
    const rng = createSeededRng('alvo-movel/shoe');
    const first = game.start({ acerta: 100 }, rng);
    expect(first.events[1]).toEqual({ type: 'shoe-shuffled', cards: 240 });
    const dealt = (events: readonly GameEvent[]) =>
      events.filter((event) => event.type === 'card-dealt').length;
    expect(shoe.remaining()).toBe(240 - dealt(first.events));
    const second = game.start({ acerta: 100 }, rng);
    expect(second.events.some((event) => event.type === 'shoe-shuffled')).toBe(false);
    expect(shoe.remaining()).toBe(240 - dealt(first.events) - dealt(second.events));
  });

  it('refuses picture cards', () => {
    expect(() => play([3, 4], '2S JH', { acerta: 100 })).toThrow(RangeError);
  });

  it('never awaits a decision', () => {
    const game = createAlvoMovel();
    const state = game.start({ acerta: 100 }, createSeededRng('x'));
    expect(() => game.decide(state, undefined as never)).toThrow(EngineError);
  });

  it('declares its math from the bet definitions, with Acerta broken down by target', () => {
    const summary = alvoMovelMathSummary();
    expect(summary.gameId).toBe('alvo-movel');
    expect(summary.gameName).toBe('Alvo Móvel');
    expect(summary.bets.map((bet) => bet.betId)).toEqual(ALVO_MOVEL_BETS.map((bet) => bet.id));
    expect(summary.bets.map((bet) => bet.maxExposure)).toEqual([7.5, 9, 4]);
    const [acerta, primeira, tres] = summary.bets;
    expect(acerta!.breakdown?.by).toBe('Target');
    expect(acerta!.breakdown?.rows.map((row) => row.value)).toEqual([
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
    ]);
    expect(primeira).not.toHaveProperty('breakdown');
    expect(tres).not.toHaveProperty('breakdown');
    expect(createAlvoMovel().mathSummary()).toEqual(summary);
  });
});
