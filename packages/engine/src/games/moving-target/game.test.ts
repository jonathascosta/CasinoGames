import { describe, expect, it } from 'vitest';
import { cardCode } from '../../cards/card.ts';
import type { DieFace } from '../../dice/dice.ts';
import { EngineError } from '../../game/errors.ts';
import type { Bets, GameEvent } from '../../game/types.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import { createScriptedCardSource } from '../../testing/scripted-cards.ts';
import { createScriptedRng, scriptForDice } from '../../testing/scripted-rng.ts';
import { MOVING_TARGET_BETS } from './bets.ts';
import {
  MOVING_TARGET_DEALER,
  movingTargetMathSummary,
  createMovingTarget,
  createMovingTargetShoe,
} from './game.ts';

const ALL = { 'exact-hit': 100, 'first-card': 100, 'three-plus-cards': 100 };

/** Plays one round with the given dice and card codes. */
function play(dice: readonly [DieFace, DieFace], cards: string, bets: Bets) {
  const game = createMovingTarget({ source: createScriptedCardSource(cards) });
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

describe('Moving Target round', () => {
  it('rolls the target, deals face up until the total reaches it, and settles', () => {
    const state = play([3, 4], '3H 4S 9D', ALL);
    expect(state.phase).toBe('settled');
    expect(state.options).toEqual([]);
    expect(state.events.map(describeEvent)).toEqual([
      'round-started',
      'dice 3-4',
      `deal 3H to ${MOVING_TARGET_DEALER} up`,
      `deal 4S to ${MOVING_TARGET_DEALER} up`,
      'exact-hit win 550',
      'first-card lose 0',
      'three-plus-cards lose 0',
      'round-settled',
    ]);
    expect(state.events.at(-1)).toEqual({
      type: 'round-settled',
      totalStake: 300,
      totalPayout: 550,
      net: 250,
    });
    expect(state.settlement['exact-hit']).toEqual({
      stake: 100,
      payout: 550,
      net: 450,
      outcome: 'win',
      entryId: 'target-7',
    });
  });

  it('pays 3+ Cards when a third card is needed, and First Card on a first-card hit', () => {
    expect(play([3, 4], '2C 2D 3S', ALL).settlement).toMatchObject({
      'exact-hit': { payout: 550, outcome: 'win' },
      'first-card': { payout: 0, outcome: 'lose' },
      'three-plus-cards': { payout: 500, outcome: 'win', entryId: 'three-or-more' },
    });
    expect(play([1, 4], '5H', ALL).settlement).toMatchObject({
      'exact-hit': { payout: 650, entryId: 'target-5' },
      'first-card': { payout: 1000, entryId: 'first-card' },
      'three-plus-cards': { payout: 0 },
    });
  });

  it('pays 15 to 2 on a target of 2 and loses everything past the target', () => {
    expect(play([1, 1], 'AS AH', { 'exact-hit': 200 }).settlement['exact-hit']).toMatchObject({
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
    expect(state.settlement['exact-hit']).toMatchObject({ payout: 600, outcome: 'win' });
    expect(state.settlement['three-plus-cards']).toMatchObject({ outcome: 'win' });
  });

  it('requires the Exact Hit bet for side bets, and enforces the limits', () => {
    const code = (bets: Bets) => {
      try {
        play([3, 4], '7S', bets);
      } catch (error) {
        return error instanceof EngineError ? error.code : String(error);
      }
      return 'ok';
    };
    expect(code({ 'three-plus-cards': 100 })).toBe('MAIN_BET_REQUIRED');
    expect(code({ 'exact-hit': 25 })).toBe('STAKE_BELOW_MIN');
    expect(code({ 'exact-hit': 100, 'first-card': 5_000 })).toBe('STAKE_ABOVE_MAX');
    expect(code({ 'exact-hit': 100, nope: 100 })).toBe('UNKNOWN_BET');
    expect(code({ 'exact-hit': 25_000, 'first-card': 2_500 })).toBe('ok');
  });

  it('deals from a six-deck shoe of aces to tens by default, shuffling on the first round', () => {
    const shoe = createMovingTargetShoe();
    expect(shoe.size()).toBe(240);
    const game = createMovingTarget({ source: shoe });
    const rng = createSeededRng('moving-target/shoe');
    const first = game.start({ 'exact-hit': 100 }, rng);
    expect(first.events[1]).toEqual({ type: 'shoe-shuffled', cards: 240 });
    const dealt = (events: readonly GameEvent[]) =>
      events.filter((event) => event.type === 'card-dealt').length;
    expect(shoe.remaining()).toBe(240 - dealt(first.events));
    const second = game.start({ 'exact-hit': 100 }, rng);
    expect(second.events.some((event) => event.type === 'shoe-shuffled')).toBe(false);
    expect(shoe.remaining()).toBe(240 - dealt(first.events) - dealt(second.events));
  });

  it('refuses picture cards', () => {
    expect(() => play([3, 4], '2S JH', { 'exact-hit': 100 })).toThrow(RangeError);
  });

  it('never awaits a decision', () => {
    const game = createMovingTarget();
    const state = game.start({ 'exact-hit': 100 }, createSeededRng('x'));
    expect(() => game.decide(state, undefined as never)).toThrow(EngineError);
  });

  it('declares its math from the bet definitions, with Exact Hit broken down by target', () => {
    const summary = movingTargetMathSummary();
    expect(summary.gameId).toBe('moving-target');
    expect(summary.gameName).toBe('Moving Target');
    expect(summary.bets.map((bet) => bet.betId)).toEqual(MOVING_TARGET_BETS.map((bet) => bet.id));
    expect(summary.bets.map((bet) => bet.maxExposure)).toEqual([7.5, 9, 4]);
    const [exactHit, firstCard, threePlus] = summary.bets;
    expect(exactHit!.breakdown?.by).toBe('Target');
    expect(exactHit!.breakdown?.rows.map((row) => row.value)).toEqual([
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
    expect(firstCard).not.toHaveProperty('breakdown');
    expect(threePlus).not.toHaveProperty('breakdown');
    expect(createMovingTarget().mathSummary()).toEqual(summary);
  });
});
