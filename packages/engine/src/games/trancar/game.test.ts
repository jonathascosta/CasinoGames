import { describe, expect, it } from 'vitest';
import { cardCode } from '../../cards/card.ts';
import type { DieFace } from '../../dice/dice.ts';
import { EngineError, type EngineErrorCode } from '../../game/errors.ts';
import { playRound } from '../../game/play.ts';
import { settlementTotals } from '../../game/settlement.ts';
import type { GameEvent } from '../../game/types.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import { createScriptedCardSource } from '../../testing/scripted-cards.ts';
import { createScriptedRng, scriptForDice } from '../../testing/scripted-rng.ts';
import { WITHOUT_FREE_ONE_ONE } from './bets.ts';
import {
  TRANCAR_DEALER,
  createTrancar,
  trancarStrategy,
  type DieRerolledEvent,
  type TrancarState,
} from './game.ts';
import type { TrancarChoice } from './rules.ts';

/** Starts a round with a scripted roll (and re-roll) and scripted dealer cards. */
function start(
  dice: readonly DieFace[],
  cards: string,
  stake = 100,
  game = createTrancar({ source: createScriptedCardSource(cards === '' ? [] : cards) }),
) {
  return { game, pending: game.start({ trancar: stake }, createScriptedRng(scriptForDice(dice))) };
}

function describeEvent(event: GameEvent | DieRerolledEvent): string {
  if (event.type === 'dice-rolled') return `dice ${event.dice.join('-')}`;
  if (event.type === 'decision-made') return `choose ${event.choice}`;
  if (event.type === 'fee-charged') return `fee ${String(event.amount)}`;
  if (event.type === 'die-rerolled') {
    return `re-roll die ${String(event.index)}: ${String(event.value)} → ${event.dice.join('-')}`;
  }
  if (event.type === 'card-dealt') {
    return `deal ${cardCode(event.card)} ${event.faceUp ? 'up' : 'down'} to ${event.to}`;
  }
  if (event.type === 'bet-settled')
    return `${event.betId} ${event.outcome} ${String(event.payout)}`;
  return event.type;
}

const log = (state: TrancarState, from = 0) => state.events.slice(from).map(describeEvent);

function expectEngineError(fn: () => unknown, code: EngineErrorCode): void {
  expect(fn).toThrow(EngineError);
  try {
    fn();
  } catch (error) {
    expect((error as EngineError).code).toBe(code);
  }
}

describe('Trancar — a round', () => {
  it('pauses after the roll: Ficar, or Trancar locking either die for the fee', () => {
    const { pending } = start([2, 5], '3S 4H');
    expect(pending.phase).toBe('awaiting-decision');
    expect(log(pending)).toEqual(['round-started', 'dice 2-5', 'decision-requested']);
    const fee = { betId: 'trancar', amount: 40 };
    expect(pending.options).toEqual([
      { choice: 'ficar', label: 'Ficar' },
      { choice: 'trancar-0', label: 'Lock the 2, re-roll the 5', fee },
      { choice: 'trancar-1', label: 'Lock the 5, re-roll the 2', fee },
    ]);
    expect(pending.data).toEqual({ dice: [2, 5] });
    // Nothing is settled, taken or dealt before the decision.
    expect(pending.settlement).toEqual({});
    expect(pending.fees).toEqual({});
    expect(pending.bets).toEqual({ trancar: 100 });
  });

  it('Ficar: the dealer deals two cards face up, and the higher total wins 1 to 1', () => {
    const { game, pending } = start([2, 5], '3S 3H');
    const settled = game.decide(pending, 'ficar');
    expect(log(settled, pending.events.length)).toEqual([
      'choose ficar',
      'deal 3S up to dealer',
      'deal 3H up to dealer',
      'trancar win 200',
      'round-settled',
    ]);
    expect(settled.settlement.trancar).toEqual({
      stake: 100,
      payout: 200,
      net: 100,
      outcome: 'win',
      entryId: 'higher',
    });
    expect(settled.data).toEqual({ dice: [2, 5] });
    expect(settled.options).toEqual([]);
  });

  it('Trancar: the fee is taken at once, the other die thrown again, and the fee kept', () => {
    // Lock the 5, re-roll the 2: it lands on 6, for 11 against the dealer's 5 + 6.
    const { game, pending } = start([2, 5, 6], '5S 6H');
    const settled = game.decide(pending, 'trancar-1');
    expect(log(settled, pending.events.length)).toEqual([
      'choose trancar-1',
      'fee 40',
      're-roll die 0: 6 → 6-5',
      'deal 5S up to dealer',
      'deal 6H up to dealer',
      'trancar lose 0', // a tie goes to the house
      'round-settled',
    ]);
    expect(settled.settlement.trancar).toEqual({
      stake: 100,
      payout: 0,
      fee: 40,
      net: -140,
      outcome: 'lose',
    });
    expect(settled.events.at(-1)).toEqual({
      type: 'round-settled',
      totalStake: 100,
      totalPayout: 0,
      totalFees: 40,
      net: -140,
    });
    // The fee is not a stake: the bet is still 1.00, and it pays 1 to 1 on that alone.
    expect(settled.bets).toEqual({ trancar: 100 });
    expect(settled.data).toEqual({ dice: [6, 5] });
  });

  it('pays the bet alone when a re-roll wins: 1 to 1 on 1.00, the fee spent', () => {
    const { game, pending } = start([1, 4, 6], '2S 3H');
    const settled = game.decide(pending, 'trancar-1'); // lock the 4: the 1 becomes a 6
    expect(settled.settlement.trancar).toEqual({
      stake: 100,
      payout: 200,
      fee: 40,
      net: 60,
      outcome: 'win',
      entryId: 'higher',
    });
    expect(settlementTotals(settled.settlement)).toEqual({
      stake: 100,
      payout: 200,
      fee: 40,
      net: 60,
    });
  });

  it('re-rolls 1-1 for free', () => {
    const { game, pending } = start([1, 1, 5], '2S 2H');
    expect(pending.options.map((option) => option.fee)).toEqual([undefined, undefined, undefined]);
    const settled = game.decide(pending, 'trancar-0');
    expect(log(settled, pending.events.length).slice(0, 2)).toEqual([
      'choose trancar-0',
      're-roll die 1: 5 → 1-5',
    ]);
    expect(settled.settlement.trancar).toEqual({
      stake: 100,
      payout: 200,
      net: 100,
      outcome: 'win',
      entryId: 'higher',
    });
  });

  it('charges 1-1 like any roll under the rules without the free re-roll', () => {
    const game = createTrancar({
      source: createScriptedCardSource('2S 2H'),
      rules: WITHOUT_FREE_ONE_ONE,
    });
    const { pending } = start([1, 1], '', 100, game);
    expect(pending.options[1]!.fee).toEqual({ betId: 'trancar', amount: 40 });
    expect(game.rules).toBe(WITHOUT_FREE_ONE_ONE);
  });

  it('prices the fee from the bet: 20¢ on 0.50, 100.00 on the 250.00 maximum', () => {
    expect(start([2, 5], '', 50).pending.options[1]!.fee!.amount).toBe(20);
    expect(start([2, 5], '', 25_000).pending.options[1]!.fee!.amount).toBe(10_000);
  });

  it('refuses choices it did not offer, and decisions on a settled round', () => {
    const { game, pending } = start([2, 5], '3S 4H');
    expectEngineError(() => game.decide(pending, 'dobrar-0' as TrancarChoice), 'INVALID_CHOICE');
    const settled = game.decide(pending, 'ficar');
    expectEngineError(() => game.decide(settled, 'ficar'), 'NOT_AWAITING_DECISION');
  });

  it('leaves the snapshot it decided on untouched', () => {
    const { game, pending } = start([2, 5, 3], '3S 4H');
    const before = structuredClone({ ...pending, rng: undefined });
    game.decide(pending, 'trancar-1');
    expect({ ...pending, rng: undefined }).toEqual(before);
  });

  it('validates the bet before drawing anything, and refuses cards above six', () => {
    const rng = createScriptedRng([]);
    expectEngineError(() => createTrancar().start({ trancar: 25 }, rng), 'STAKE_BELOW_MIN');
    expect(rng.consumed).toBe(0);
    const { game, pending } = start([2, 5], '3S TH');
    expect(() => game.decide(pending, 'ficar')).toThrow(/aces to sixes, got 10♥/);
  });
});

describe('Trancar — a table', () => {
  it('deals from its own six-deck shoe: 54 rounds between shuffles', () => {
    const game = createTrancar();
    const rng = createSeededRng('trancar/shoe');
    const shuffles: number[] = [];
    for (let round = 0; round < 120; round++) {
      const state = playRound(game, { trancar: 100 }, rng, trancarStrategy());
      if (state.events.some((event) => event.type === 'shoe-shuffled')) shuffles.push(round);
      expect(state.events.filter((event) => event.type === 'card-dealt')).toHaveLength(2);
    }
    expect(shuffles).toEqual([0, 54, 108]);
  });

  it('plays the reference strategy and settles every cent over many rounds', () => {
    const game = createTrancar();
    const rng = createSeededRng('trancar/ledger');
    const strategy = trancarStrategy();
    let rounds = 0;
    let rerolls = 0;
    let fees = 0;
    for (; rounds < 20_000; rounds++) {
      const pending = game.start({ trancar: 100 }, rng);
      const choice = strategy(pending);
      const settled = game.decide(pending, choice);
      const line = settled.settlement.trancar!;
      const option = pending.options.find((candidate) => candidate.choice === choice)!;
      expect(line.fee ?? 0).toBe(option.fee?.amount ?? 0);
      expect(line.net).toBe(line.payout - line.stake - (line.fee ?? 0));
      expect([0, 200]).toContain(line.payout);
      if (choice !== 'ficar') rerolls++;
      fees += line.fee ?? 0;
    }
    // 17/36 of rounds re-roll; 16/36 pay 40¢.
    expect(rerolls / rounds).toBeCloseTo(17 / 36, 2);
    expect(fees / 40 / rounds).toBeCloseTo(16 / 36, 2);
  });

  it('reads the dealer as the hand the cards are dealt to', () => {
    const { game, pending } = start([6, 6], '2S 2H');
    const settled = game.decide(pending, 'ficar');
    const dealt = settled.events.filter((event) => event.type === 'card-dealt');
    expect(dealt.map((event) => event.to)).toEqual([TRANCAR_DEALER, TRANCAR_DEALER]);
  });
});
