import { describe, expect, it } from 'vitest';
import { cardCode } from '../../cards/card.ts';
import { EngineError } from '../../game/errors.ts';
import type { Bets, GameEvent } from '../../game/types.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import { createScriptedCardSource } from '../../testing/scripted-cards.ts';
import { createScriptedRng, scriptForDice } from '../../testing/scripted-rng.ts';
import type { DieFace } from '../../dice/dice.ts';
import { DICE_SPREAD_BETS } from './bets.ts';
import {
  DICE_SPREAD_DEALER,
  createDiceSpread,
  createDiceSpreadShoe,
  diceSpreadMathSummary,
} from './game.ts';

/** Plays one round with the given dice and card code. */
function play(dice: readonly [DieFace, DieFace], card: string, bets: Bets) {
  const game = createDiceSpread({ source: createScriptedCardSource(card) });
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

describe('Dice Spread round', () => {
  it('rolls, deals the card face down, reveals it and settles every placed bet', () => {
    const state = play([2, 5], '3H', { between: 100, match: 50, bullseye: 50 });
    expect(state.phase).toBe('settled');
    expect(state.options).toEqual([]);
    expect(state.events.map(describeEvent)).toEqual([
      'round-started',
      'dice 2-5',
      `deal 3H to ${DICE_SPREAD_DEALER} down`,
      'reveal 3H #0',
      'between win 300',
      'match lose 0',
      'bullseye lose 0',
      'round-settled',
    ]);
    expect(state.events.at(-1)).toEqual({
      type: 'round-settled',
      totalStake: 200,
      totalPayout: 300,
      net: 100,
    });
    expect(state.settlement.between).toEqual({
      stake: 100,
      payout: 300,
      net: 200,
      outcome: 'win',
      entryId: 'spread-3',
    });
  });

  it('pays 1 to 2 on a spread of 5 and pushes pairs', () => {
    expect(play([6, 1], '4S', { between: 150 }).settlement.between).toMatchObject({
      payout: 225,
      outcome: 'win',
    });
    const pair = play([3, 3], '3D', { between: 100, match: 100, doubles: 100, triple: 100 });
    expect(pair.settlement).toEqual({
      between: { stake: 100, payout: 100, net: 0, outcome: 'push', entryId: 'push' },
      match: { stake: 100, payout: 300, net: 200, outcome: 'win', entryId: 'match' },
      doubles: { stake: 100, payout: 500, net: 400, outcome: 'win', entryId: 'pair' },
      triple: { stake: 100, payout: 3100, net: 3000, outcome: 'win', entryId: 'triple' },
    });
  });

  it('pays Bullseye 22 to 1 on the middle card of a spread of 2', () => {
    const state = play([4, 6], '5C', { between: 100, bullseye: 100 });
    expect(state.settlement.bullseye).toMatchObject({ payout: 2300, entryId: 'bullseye' });
    expect(state.settlement.between).toMatchObject({ payout: 500, entryId: 'spread-2' });
  });

  it('requires the Between bet for side bets, and enforces the limits', () => {
    const code = (bets: Bets) => {
      try {
        play([1, 2], 'AS', bets);
      } catch (error) {
        return error instanceof EngineError ? error.code : String(error);
      }
      return 'ok';
    };
    expect(code({ match: 100 })).toBe('MAIN_BET_REQUIRED');
    expect(code({ between: 25 })).toBe('STAKE_BELOW_MIN');
    expect(code({ between: 100, triple: 5_000 })).toBe('STAKE_ABOVE_MAX');
    expect(code({ between: 100, nope: 100 })).toBe('UNKNOWN_BET');
  });

  it('deals from a six-deck shoe of aces to sixes by default, shuffling on the first round', () => {
    const shoe = createDiceSpreadShoe();
    expect(shoe.size()).toBe(144);
    const game = createDiceSpread({ source: shoe });
    const rng = createSeededRng('dice-spread/shoe');
    const first = game.start({ between: 100 }, rng);
    expect(first.events[1]).toEqual({ type: 'shoe-shuffled', cards: 144 });
    expect(shoe.remaining()).toBe(143);
    const second = game.start({ between: 100 }, rng);
    expect(second.events.some((event) => event.type === 'shoe-shuffled')).toBe(false);
    expect(shoe.remaining()).toBe(142);
  });

  it('refuses cards above six', () => {
    expect(() => play([1, 6], '7S', { between: 100 })).toThrow(RangeError);
  });

  it('never awaits a decision', () => {
    const game = createDiceSpread();
    const state = game.start({ between: 100 }, createSeededRng('x'));
    expect(() => game.decide(state, undefined as never)).toThrow(EngineError);
  });

  it('declares its math from the bet definitions', () => {
    const summary = diceSpreadMathSummary();
    expect(summary.gameId).toBe('dice-spread');
    expect(summary.gameName).toBe('Dice Spread');
    expect(summary.bets.map((bet) => bet.betId)).toEqual(DICE_SPREAD_BETS.map((bet) => bet.id));
    expect(summary.bets.map((bet) => bet.maxExposure)).toEqual([4, 2, 22, 4, 30]);
    expect(createDiceSpread().mathSummary()).toEqual(summary);
  });
});
