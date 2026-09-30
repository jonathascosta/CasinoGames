import { describe, expect, it } from 'vitest';
import { RANK_SETS } from '../cards/card.ts';
import { Shoe } from '../cards/shoe.ts';
import type { DicePair } from '../dice/dice.ts';
import { createDiceFixture } from '../fixtures/dice-fixture.ts';
import { createRerollFixture, type RerollChoice } from '../fixtures/reroll-fixture.ts';
import { createWarFixture } from '../fixtures/war-fixture.ts';
import { createSeededRng } from '../rng/seeded.ts';
import { createScriptedCardSource } from '../testing/scripted-cards.ts';
import { createScriptedRng, scriptForDice } from '../testing/scripted-rng.ts';
import { EngineError, type EngineErrorCode } from './errors.ts';
import { odds } from './money.ts';
import { continueRound, startRound } from './round.ts';
import type { GameEvent } from './types.ts';

function expectEngineError(fn: () => unknown, code: EngineErrorCode): void {
  expect(fn).toThrow(EngineError);
  try {
    fn();
  } catch (error) {
    expect((error as EngineError).code).toBe(code);
  }
}

const types = (events: readonly GameEvent[]) => events.map((event) => event.type);

describe('a round without decisions', () => {
  const game = createDiceFixture();

  it('records the replayable event sequence and settles every bet', () => {
    const state = game.start({ over: 200, doubles: 100 }, createScriptedRng(scriptForDice([5, 5])));

    expect(state.phase).toBe('settled');
    expect(state.options).toEqual([]);
    expect(types(state.events)).toEqual([
      'round-started',
      'dice-rolled',
      'bet-settled',
      'bet-settled',
      'round-settled',
    ]);
    expect(state.events[1]).toEqual({ type: 'dice-rolled', dice: [5, 5] });
    expect(state.settlement).toEqual({
      over: { stake: 200, payout: 400, net: 200, outcome: 'win', entryId: 'eight-plus' },
      doubles: { stake: 100, payout: 550, net: 450, outcome: 'win', entryId: 'double' },
    });
    expect(state.events.at(-1)).toEqual({
      type: 'round-settled',
      totalStake: 300,
      totalPayout: 950,
      net: 650,
    });
  });

  it('settles losing bets', () => {
    const state = game.start({ over: 200 }, createScriptedRng(scriptForDice([1, 2])));
    expect(state.settlement).toEqual({
      over: { stake: 200, payout: 0, net: -200, outcome: 'lose' },
    });
  });

  it('is fully determined by the seed', () => {
    const play = () => {
      const rng = createSeededRng('replay');
      return Array.from({ length: 20 }, () => {
        const { rng: _rng, ...record } = game.start({ over: 100, doubles: 50 }, rng);
        return record;
      });
    };
    expect(play()).toEqual(play());
  });

  it('validates bets before drawing anything', () => {
    const rng = createScriptedRng([]);
    expectEngineError(() => game.start({ doubles: 100 }, rng), 'MAIN_BET_REQUIRED');
    expect(rng.consumed).toBe(0);
  });

  it('refuses decisions on a settled round', () => {
    const state = game.start({ over: 100 }, createSeededRng(1));
    expectEngineError(() => continueRound(state, 'anything'), 'NOT_AWAITING_DECISION');
  });
});

describe('a round with a decision', () => {
  const rng = createSeededRng('war');

  it('pauses with options, then applies the choice and its additional stake', () => {
    const game = createWarFixture(createScriptedCardSource('QS 9H'));
    const pending = game.start({ ante: 500 }, rng);

    expect(pending.phase).toBe('awaiting-decision');
    expect(pending.options.map((option) => option.choice)).toEqual(['raise', 'fold']);
    expect(pending.events.at(-1)).toEqual({ type: 'decision-requested', options: pending.options });
    expect(pending.events).toContainEqual({
      type: 'card-dealt',
      card: { rank: 9, suit: 'hearts' },
      to: 'dealer',
      faceUp: false,
    });
    expect(pending.settlement).toEqual({});

    const settled = game.decide(pending, 'raise');
    expect(settled.phase).toBe('settled');
    expect(settled.bets).toEqual({ ante: 500, play: 500 });
    expect(types(settled.events.slice(pending.events.length))).toEqual([
      'decision-made',
      'stake-added',
      'card-revealed',
      'bet-settled',
      'bet-settled',
      'round-settled',
    ]);
    expect(settled.settlement.play).toEqual({
      stake: 500,
      payout: 1_000,
      net: 500,
      outcome: 'win',
      entryId: 'higher',
    });
  });

  it('leaves the earlier snapshot untouched', () => {
    const game = createWarFixture(createScriptedCardSource('2S KH'));
    const pending = game.start({ ante: 100 }, rng);
    const before = structuredClone({ ...pending, rng: undefined });
    game.decide(pending, 'fold');
    expect({ ...pending, rng: undefined }).toEqual(before);
  });

  it('settles only the ante on a fold', () => {
    const game = createWarFixture(createScriptedCardSource('2S KH'));
    const settled = game.decide(game.start({ ante: 100 }, rng), 'fold');
    expect(settled.bets).toEqual({ ante: 100 });
    expect(settled.settlement).toEqual({
      ante: { stake: 100, payout: 0, net: -100, outcome: 'lose' },
    });
  });

  it('rejects a choice that was not offered', () => {
    const game = createWarFixture(createScriptedCardSource('2S KH'));
    const pending = game.start({ ante: 100 }, rng);
    expectEngineError(() => game.decide(pending, 'double' as 'raise'), 'INVALID_CHOICE');
  });

  it('records shoe shuffles as events', () => {
    const game = createWarFixture(new Shoe({ decks: 1, ranks: RANK_SETS.aceToSix }));
    const first = game.start({ ante: 100 }, rng);
    expect(first.events[1]).toEqual({ type: 'shoe-shuffled', cards: 24 });
    const second = game.start({ ante: 100 }, rng);
    expect(types(second.events)).not.toContain('shoe-shuffled');
  });

  it('records an emergency reshuffle before the card that needed it', () => {
    const shoe = new Shoe({ decks: 1, ranks: RANK_SETS.aceToSix, penetration: 1 });
    const game = createWarFixture(shoe);
    shoe.beginRound(rng);
    shoe.draw(rng); // burn one card so a later round straddles the end of the shoe
    for (let i = 0; i < 11; i++) game.decide(game.start({ ante: 100 }, rng), 'fold'); // 23 dealt

    const state = game.start({ ante: 100 }, rng); // player takes the last card
    expect(types(state.events)).toEqual([
      'round-started',
      'card-dealt',
      'shoe-shuffled',
      'card-dealt',
      'decision-requested',
    ]);
    expect(state.events[2]).toEqual({ type: 'shoe-shuffled', cards: 23 }); // the discards

    const next = game.start({ ante: 100 }, rng); // the short stack is replaced
    expect(next.events[1]).toEqual({ type: 'shoe-shuffled', cards: 24 });
  });
});

describe('a decision with a fee', () => {
  const game = createRerollFixture();
  const play = (dice: DicePair[], choice: RerollChoice) => {
    const rng = createScriptedRng(scriptForDice(dice.flat()));
    const pending = game.start({ main: 100 }, rng);
    return { pending, settled: game.decide(pending, choice) };
  };

  it('takes the fee when the option is chosen and charges it against the bet', () => {
    const { pending, settled } = play(
      [
        [2, 3],
        [6, 6],
      ],
      'reroll',
    );
    expect(pending.fees).toEqual({});
    expect(types(settled.events.slice(pending.events.length))).toEqual([
      'decision-made',
      'fee-charged',
      'dice-rolled',
      'bet-settled',
      'round-settled',
    ]);
    expect(settled.events[pending.events.length + 1]).toEqual({
      type: 'fee-charged',
      betId: 'main',
      amount: 60,
    });
    // A fee is not a stake: the bet still pays 1 to 1 on 1.00.
    expect(settled.bets).toEqual({ main: 100 });
    expect(settled.fees).toEqual({ main: 60 });
    expect(settled.settlement.main).toEqual({
      stake: 100,
      payout: 200,
      fee: 60,
      net: 40,
      outcome: 'win',
      entryId: 'high',
    });
    expect(settled.events.at(-2)).toEqual({
      type: 'bet-settled',
      betId: 'main',
      ...settled.settlement.main,
    });
    expect(settled.events.at(-1)).toEqual({
      type: 'round-settled',
      totalStake: 100,
      totalPayout: 200,
      totalFees: 60,
      net: 40,
    });
  });

  it('keeps the fee whatever the result', () => {
    const { settled } = play(
      [
        [2, 3],
        [1, 2],
      ],
      'reroll',
    );
    expect(settled.settlement.main).toEqual({
      stake: 100,
      payout: 0,
      fee: 60,
      net: -160,
      outcome: 'lose',
    });
  });

  it('charges nothing for a choice without a fee', () => {
    const { settled } = play([[6, 5]], 'keep');
    expect(types(settled.events)).not.toContain('fee-charged');
    expect(settled.fees).toEqual({});
    expect(settled.settlement.main).not.toHaveProperty('fee');
    expect(settled.events.at(-1)).not.toHaveProperty('totalFees');
  });

  it('adds a choice’s stake, then charges its fee', () => {
    const { pending, settled } = play(
      [
        [2, 3],
        [4, 4],
      ],
      'raise',
    );
    expect(types(settled.events.slice(pending.events.length, -3))).toEqual([
      'decision-made',
      'stake-added',
      'fee-charged',
    ]);
    expect(settled.settlement.main).toEqual({
      stake: 200,
      payout: 400,
      fee: 60,
      net: 140,
      outcome: 'win',
      entryId: 'high',
    });
  });

  it('charges fees only against placed, unsettled bets, in whole cents', () => {
    const round = startRound(game, { main: 100 }, createSeededRng('fees'));
    expectEngineError(() => round.chargeFee('side', 10), 'BET_NOT_PLACED');
    expectEngineError(() => round.chargeFee('main', 0), 'INVALID_STAKE');
    expectEngineError(() => round.chargeFee('main', 2.5), 'INVALID_STAKE');
    round.chargeFee('main', 10).chargeFee('main', 15);
    expect(round.feeOf('main')).toBe(25);
    // A line handed to settle() is computed without the fee: the builder charges it.
    expectEngineError(
      () => round.settle('main', { stake: 100, payout: 0, fee: 25, net: -125, outcome: 'lose' }),
      'INVALID_STAKE',
    );
    round.lose('main');
    expect(round.feeOf('main')).toBe(25);
    expectEngineError(() => round.chargeFee('main', 10), 'BET_ALREADY_SETTLED');
    const state = round.finish([1, 1]);
    expect(state.settlement.main).toEqual({
      stake: 100,
      payout: 0,
      fee: 25,
      net: -125,
      outcome: 'lose',
    });
    expectEngineError(() => round.chargeFee('main', 10), 'ROUND_CLOSED');
  });
});

describe('RoundBuilder invariants', () => {
  const game = createDiceFixture();
  const rng = () => createSeededRng('invariants');

  it('requires every placed bet to be settled before finishing', () => {
    const round = startRound(game, { over: 100, doubles: 100 }, rng());
    round.lose('over');
    expect(round.unsettledBets()).toEqual(['doubles']);
    expectEngineError(() => round.finish(undefined), 'UNSETTLED_BETS');
  });

  it('settles each bet exactly once and only if placed', () => {
    const round = startRound(game, { over: 100 }, rng());
    expectEngineError(() => round.lose('doubles'), 'BET_NOT_PLACED');
    round.win('over', odds(1));
    expectEngineError(() => round.lose('over'), 'BET_ALREADY_SETTLED');
    expectEngineError(() => round.addStake('over', 100), 'BET_ALREADY_SETTLED');
  });

  it('treats inherited property names as ordinary, unplaced bet ids', () => {
    const round = startRound(game, { over: 100 }, rng());
    expect(round.stakeOf('toString')).toBe(0);
    expect(round.isSettled('constructor')).toBe(false);
    expectEngineError(() => round.lose('toString'), 'BET_NOT_PLACED');
  });

  it('rejects a settlement line for the wrong stake', () => {
    const round = startRound(game, { over: 100 }, rng());
    expectEngineError(
      () => round.settle('over', { stake: 50, payout: 0, net: -50, outcome: 'lose' }),
      'INVALID_STAKE',
    );
  });

  it('rejects invalid additional stakes', () => {
    const round = startRound(game, { over: 100 }, rng());
    expectEngineError(() => round.addStake('over', 0), 'INVALID_STAKE');
    expectEngineError(() => round.addStake('over', 12.5), 'INVALID_STAKE');
  });

  it('closes after finishing', () => {
    const round = startRound(game, { over: 100 }, rng());
    round.lose('over');
    round.finish(undefined);
    expectEngineError(() => round.rollDice(), 'ROUND_CLOSED');
    expectEngineError(() => round.finish(undefined), 'ROUND_CLOSED');
  });

  it('needs distinct options to await a decision', () => {
    const round = startRound(game, { over: 100 }, rng());
    expectEngineError(() => round.awaitDecision([], undefined), 'INVALID_CHOICE');
    expectEngineError(
      () =>
        round.awaitDecision(
          [
            { choice: 'a', label: 'A' },
            { choice: 'a', label: 'A again' },
          ],
          undefined,
        ),
      'INVALID_CHOICE',
    );
  });
});
