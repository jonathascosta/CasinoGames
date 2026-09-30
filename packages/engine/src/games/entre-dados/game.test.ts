import { describe, expect, it } from 'vitest';
import { cardCode } from '../../cards/card.ts';
import { EngineError } from '../../game/errors.ts';
import type { Bets, GameEvent } from '../../game/types.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import { createScriptedCardSource } from '../../testing/scripted-cards.ts';
import { createScriptedRng, scriptForDice } from '../../testing/scripted-rng.ts';
import type { DieFace } from '../../dice/dice.ts';
import { ENTRE_DADOS_BETS } from './bets.ts';
import {
  ENTRE_DADOS_DEALER,
  createEntreDados,
  createEntreDadosShoe,
  entreDadosMathSummary,
} from './game.ts';

/** Plays one round with the given dice and card code. */
function play(dice: readonly [DieFace, DieFace], card: string, bets: Bets) {
  const game = createEntreDados({ source: createScriptedCardSource(card) });
  return game.start(bets, createScriptedRng(scriptForDice(dice)));
}

function describeEvent(event: GameEvent): string {
  if (event.type === 'dice-rolled') return `dice ${event.dice.join('-')}`;
  if (event.type === 'card-dealt') {
    return `deal ${cardCode(event.card)} to ${event.to} ${event.faceUp ? 'up' : 'down'}`;
  }
  if (event.type === 'card-revealed') return `reveal ${cardCode(event.card)} #${event.index}`;
  if (event.type === 'bet-settled') return `${event.betId} ${event.outcome} ${event.payout}`;
  return event.type;
}

describe('Entre Dados round', () => {
  it('rolls, deals the card face down, reveals it and settles every placed bet', () => {
    const state = play([2, 5], '3H', { entre: 100, exato: 50, 'olho-de-boi': 50 });
    expect(state.phase).toBe('settled');
    expect(state.options).toEqual([]);
    expect(state.events.map(describeEvent)).toEqual([
      'round-started',
      'dice 2-5',
      `deal 3H to ${ENTRE_DADOS_DEALER} down`,
      'reveal 3H #0',
      'entre win 300',
      'exato lose 0',
      'olho-de-boi lose 0',
      'round-settled',
    ]);
    expect(state.events.at(-1)).toEqual({
      type: 'round-settled',
      totalStake: 200,
      totalPayout: 300,
      net: 100,
    });
    expect(state.settlement.entre).toEqual({
      stake: 100,
      payout: 300,
      net: 200,
      outcome: 'win',
      entryId: 'spread-3',
    });
  });

  it('pays 1 to 2 on a spread of 5 and pushes pairs', () => {
    expect(play([6, 1], '4S', { entre: 150 }).settlement.entre).toMatchObject({
      payout: 225,
      outcome: 'win',
    });
    const pair = play([3, 3], '3D', { entre: 100, exato: 100, dobros: 100, triplo: 100 });
    expect(pair.settlement).toEqual({
      entre: { stake: 100, payout: 100, net: 0, outcome: 'push', entryId: 'push' },
      exato: { stake: 100, payout: 300, net: 200, outcome: 'win', entryId: 'match' },
      dobros: { stake: 100, payout: 500, net: 400, outcome: 'win', entryId: 'pair' },
      triplo: { stake: 100, payout: 3100, net: 3000, outcome: 'win', entryId: 'triple' },
    });
  });

  it('pays Olho de Boi 22 to 1 on the middle card of a spread of 2', () => {
    const state = play([4, 6], '5C', { entre: 100, 'olho-de-boi': 100 });
    expect(state.settlement['olho-de-boi']).toMatchObject({ payout: 2300, entryId: 'bullseye' });
    expect(state.settlement.entre).toMatchObject({ payout: 500, entryId: 'spread-2' });
  });

  it('requires the Entre bet for side bets, and enforces the limits', () => {
    const code = (bets: Bets) => {
      try {
        play([1, 2], 'AS', bets);
      } catch (error) {
        return error instanceof EngineError ? error.code : String(error);
      }
      return 'ok';
    };
    expect(code({ exato: 100 })).toBe('MAIN_BET_REQUIRED');
    expect(code({ entre: 25 })).toBe('STAKE_BELOW_MIN');
    expect(code({ entre: 100, triplo: 5_000 })).toBe('STAKE_ABOVE_MAX');
    expect(code({ entre: 100, nope: 100 })).toBe('UNKNOWN_BET');
  });

  it('deals from a six-deck shoe of aces to sixes by default, shuffling on the first round', () => {
    const shoe = createEntreDadosShoe();
    expect(shoe.size()).toBe(144);
    const game = createEntreDados({ source: shoe });
    const rng = createSeededRng('entre-dados/shoe');
    const first = game.start({ entre: 100 }, rng);
    expect(first.events[1]).toEqual({ type: 'shoe-shuffled', cards: 144 });
    expect(shoe.remaining()).toBe(143);
    const second = game.start({ entre: 100 }, rng);
    expect(second.events.some((event) => event.type === 'shoe-shuffled')).toBe(false);
    expect(shoe.remaining()).toBe(142);
  });

  it('refuses cards above six', () => {
    expect(() => play([1, 6], '7S', { entre: 100 })).toThrow(RangeError);
  });

  it('never awaits a decision', () => {
    const game = createEntreDados();
    const state = game.start({ entre: 100 }, createSeededRng('x'));
    expect(() => game.decide(state, undefined as never)).toThrow(EngineError);
  });

  it('declares its math from the bet definitions', () => {
    const summary = entreDadosMathSummary();
    expect(summary.gameId).toBe('entre-dados');
    expect(summary.gameName).toBe('Entre Dados');
    expect(summary.bets.map((bet) => bet.betId)).toEqual(ENTRE_DADOS_BETS.map((bet) => bet.id));
    expect(summary.bets.map((bet) => bet.maxExposure)).toEqual([4, 2, 22, 4, 30]);
    expect(createEntreDados().mathSummary()).toEqual(summary);
  });
});
