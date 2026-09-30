import { describe, expect, it } from 'vitest';
import { cardCode } from '../../cards/card.ts';
import type { DieFace } from '../../dice/dice.ts';
import { EngineError } from '../../game/errors.ts';
import type { Bets, GameEvent } from '../../game/types.ts';
import { playRound } from '../../game/play.ts';
import type { ProgressiveState } from '../../progressive/progressive.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import { createScriptedCardSource } from '../../testing/scripted-cards.ts';
import { createScriptedRng, scriptForDice } from '../../testing/scripted-rng.ts';
import { MIRROR_CONFIG } from './config.ts';
import {
  createMirror,
  createMirrorJackpot,
  createMirrorShoe,
  mirrorMathSummary,
  type JackpotMeterEvent,
} from './game.ts';

const { seed: SEED } = MIRROR_CONFIG.jackpot;

/** Plays one round with the given dice and card codes, on a fresh meter unless one is given. */
function play(
  dice: readonly [DieFace, DieFace],
  cards: string,
  bets: Bets,
  game = createMirror({ source: createScriptedCardSource(cards) }),
) {
  return game.start(bets, createScriptedRng(scriptForDice(dice)));
}

function describeEvent(event: GameEvent | JackpotMeterEvent): string {
  if (event.type === 'dice-rolled') return `dice ${event.dice.join('-')}`;
  if (event.type === 'card-dealt')
    return `deal ${cardCode(event.card)} ${event.faceUp ? 'up' : 'down'}`;
  if (event.type === 'card-revealed') return `reveal ${cardCode(event.card)} #${event.index}`;
  if (event.type === 'bet-settled') return `${event.betId} ${event.outcome} ${event.payout}`;
  if (event.type === 'jackpot-meter') return `meter ${event.amount} (${event.cause})`;
  if (event.type === 'jackpot-won') return `jackpot ${event.amount}`;
  return event.type;
}

describe('Mirror round', () => {
  it('rolls, deals two cards face down, reveals them and settles every placed bet', () => {
    const state = play([3, 6], '4H 5S', { mirror: 100, tie: 50, 'equal-sums': 50 });
    expect(state.phase).toBe('settled');
    expect(state.events.map(describeEvent)).toEqual([
      'round-started',
      'dice 3-6',
      'deal 4H down',
      'deal 5S down',
      'reveal 4H #0',
      'reveal 5S #1',
      // SUM 9 HIGH 6 beats SUM 9 HIGH 5; the sums match.
      'mirror win 200',
      'tie lose 0',
      'equal-sums win 400',
      'round-settled',
    ]);
  });

  it('gives a tie to the house and pays Tie 17 to 1', () => {
    const state = play([2, 5], '5D 2C', { mirror: 100, tie: 100 });
    expect(state.settlement.mirror).toMatchObject({ outcome: 'lose', payout: 0 });
    expect(state.settlement.tie).toMatchObject({
      outcome: 'win',
      payout: 1_800,
      entryId: 'tie',
    });
  });

  it('pays the pair bets, and a pair of aces beats 6 and 5', () => {
    const state = play([1, 1], 'AS AH', {
      mirror: 100,
      'pair-vs-pair': 100,
      'perfect-mirror': 100,
    });
    expect(state.settlement.mirror!.outcome).toBe('lose'); // same pair: a tie
    expect(state.settlement['pair-vs-pair']!.payout).toBe(3_100);
    expect(state.settlement['perfect-mirror']!.payout).toBe(20_100);
    expect(play([1, 1], '6S 5H', { mirror: 100 }).settlement.mirror!.outcome).toBe('win');
  });

  it('feeds the meter with 10% of the Double Sixes stake as the bet is accepted', () => {
    const game = createMirror({ source: createScriptedCardSource('2S 3H') });
    const state = play([4, 4], '', { mirror: 100, 'double-sixes': 250 }, game);
    expect(state.events.slice(0, 2).map(describeEvent)).toEqual([
      'round-started',
      `meter ${SEED + 25} (contribution)`,
    ]);
    expect(state.settlement['double-sixes']).toMatchObject({ outcome: 'lose', payout: 0 });
    expect(game.jackpot.amount).toBe(SEED + 25);
  });

  it("pays 1000 to 1 plus the stake's share of the meter on 6-6 against 6-6", () => {
    const game = createMirror({ source: createScriptedCardSource('6S 6D') });
    const state = play([6, 6], '', { mirror: 100, 'double-sixes': 500 }, game);
    // The meter holds 5,000.00 + 0.50; a 5.00 stake takes a fifth: 1,000.10.
    expect(state.events.map(describeEvent).slice(-5)).toEqual([
      'mirror lose 0',
      'jackpot 100010',
      'double-sixes win 600510',
      `meter ${SEED} (award)`,
      'round-settled',
    ]);
    expect(state.settlement['double-sixes']).toMatchObject({
      payout: 500 + 500_000 + 100_010,
      entryId: 'six-six',
    });
    // 4,000.40 was left, topped up to the seed by the house.
    expect(game.jackpot.snapshot()).toMatchObject({
      hits: 1,
      awarded: 100_010,
      seedFunding: 99_960,
    });
  });

  it('takes the whole meter at 25.00, and keeps what a smaller share leaves above the seed', () => {
    const game = createMirror({
      source: createScriptedCardSource('6S 6D 6H 6C'),
      jackpot: createMirrorJackpot(),
    });
    for (let i = 0; i < 1_000; i++) game.jackpot.contribute(2_500); // +2.50 a time: 7,500.00
    const whole = play([6, 6], '', { mirror: 100, 'double-sixes': 2_500 }, game);
    // The round's own 2.50 goes in first: the whole 7,502.50 is paid.
    expect(whole.settlement['double-sixes']!.payout).toBe(2_500 + 2_500_000 + 750_250);
    expect(game.jackpot.amount).toBe(SEED);
    for (let i = 0; i < 1_000; i++) game.jackpot.contribute(2_500);
    play([6, 6], '', { mirror: 100, 'double-sixes': 50 }, game); // 2% of 7,500.05: 150.00
    expect(game.jackpot.amount).toBe(735_005); // the other 98% stays: 7,350.05
  });

  it('owns a six-deck shoe of aces to sixes and refuses picture cards', () => {
    expect(createMirrorShoe().size()).toBe(144);
    expect(() => play([1, 2], '7S 2H', { mirror: 100 })).toThrow(RangeError);
  });

  it('enforces the limits: side bets up to 25.00, and only beside Mirror', () => {
    const game = createMirror();
    const rng = createSeededRng('limits');
    const code = (bets: Bets) => {
      try {
        game.start(bets, rng);
      } catch (error) {
        return error instanceof EngineError ? error.code : 'other';
      }
      return 'ok';
    };
    expect(code({ mirror: 100, 'double-sixes': 2_550 })).toBe('STAKE_ABOVE_MAX');
    expect(code({ 'double-sixes': 100 })).toBe('MAIN_BET_REQUIRED');
    expect(code({ mirror: 25_050 })).toBe('STAKE_ABOVE_MAX');
    expect(code({ mirror: 25_000, 'double-sixes': 2_500 })).toBe('ok');
    expect(() => game.decide({} as never, 'x' as never)).toThrow(EngineError);
  });

  it('carries the meter on from a stored state', () => {
    const game = createMirror({ source: createScriptedCardSource('AS 2S') });
    play([3, 4], '', { mirror: 100, 'double-sixes': 2_500 }, game);
    const stored = JSON.parse(JSON.stringify(game.jackpot.state())) as ProgressiveState;
    const again = createMirrorJackpot(stored);
    expect(again.amount).toBe(SEED + 250);
    expect(again.state()).toEqual(game.jackpot.state());
  });

  it('summarises its math with the meter, and names its shoe', () => {
    const summary = mirrorMathSummary();
    expect(summary.finiteShoe).toBe('6-deck shoe');
    expect(summary.bets.map((bet) => bet.betId)).toEqual([
      'mirror',
      'tie',
      'equal-sums',
      'pair-vs-pair',
      'perfect-mirror',
      'double-sixes',
    ]);
    const jackpot = summary.bets.at(-1)!;
    expect(jackpot.maxExposure).toBeUndefined();
    expect(jackpot.progressive).toMatchObject({
      seed: SEED,
      contributionRate: 0.1,
      fullShareStake: 2_500,
    });
    expect(summary.bets.slice(0, -1).map((bet) => bet.maxExposure)).toEqual([1, 17, 7, 30, 200]);
  });
});

describe('Mirror — the meter keeps exact accounts', () => {
  it('balances every cent over a long run of mixed stakes', () => {
    const game = createMirror();
    const rng = createSeededRng('mirror/meter-ledger');
    const stakes = [50, 100, 500, 2_500];
    const start = game.jackpot.state();
    let staked = 0;
    let shares = 0;
    let hits = 0;
    let lowest = Infinity;
    for (let round = 0; round < 200_000; round++) {
      const stake = stakes[round % stakes.length]!;
      const state = playRound(game, { mirror: 50, 'double-sixes': stake }, rng);
      staked += stake;
      for (const event of state.events) {
        if (event.type === 'jackpot-won') {
          shares += event.amount;
          hits++;
        }
      }
      lowest = Math.min(lowest, game.jackpot.amount);
    }
    const end = game.jackpot.state();
    const micros = (amount: { cents: number; micros: number }) =>
      amount.cents * 1e6 + amount.micros;
    expect(hits).toBeGreaterThan(100); // about 1 in 1,343 rounds on the six-deck shoe
    expect(lowest).toBeGreaterThanOrEqual(SEED);
    // meter_end = meter_start + contributions − shares paid + top-ups, to the millionth of a cent.
    expect(end.pool).toBe(
      start.pool + micros(end.contributed) - shares * 1e6 + micros(end.seedFunding),
    );
    expect(end.awarded).toBe(shares);
    // stakes = contributions + house pool: 10% to the meter, 90% to the house.
    const contributions = micros(end.contributed);
    const housePool = staked * 900_000;
    expect(contributions).toBe(staked * 100_000);
    expect(contributions + housePool).toBe(staked * 1e6);
  });
});
