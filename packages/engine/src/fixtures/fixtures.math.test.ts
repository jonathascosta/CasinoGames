/**
 * Monte Carlo verification of the fixtures (run with `pnpm test:math`).
 * Each demo game ships the same kind of suite: a seeded simulation, in
 * infinite-shoe mode, asserting every bet's RTP within ±0.15 percentage points
 * of its declared value. The round count is at least 2,000,000 and grows with
 * the bet's volatility so that ±0.15 pp is 3.29 standard errors (99.9%).
 */
import { describe, expect, it } from 'vitest';
import { Shoe } from '../cards/shoe.ts';
import type { BetDefinition } from '../game/types.ts';
import { exactReturns } from '../math/exact.ts';
import { roundsForTolerance, simulate, type SimulationReport } from '../math/simulate.ts';
import { createSeededRng } from '../rng/seeded.ts';
import { DICE_FIXTURE_BETS, createDiceFixture } from './dice-fixture.ts';
import { WAR_FIXTURE_BETS, createWarFixture, raiseOnEightOrBetter } from './war-fixture.ts';

const TOLERANCE = 0.0015;
const MIN_ROUNDS = 2_000_000;

function roundsFor(standardDeviations: readonly number[]): number {
  return Math.max(MIN_ROUNDS, roundsForTolerance(Math.max(...standardDeviations), TOLERANCE));
}

function expectDeclaredRtp(report: SimulationReport, bets: readonly BetDefinition[]): void {
  for (const bet of bets) {
    const measured = report.bets[bet.id]!;
    expect(
      Math.abs(measured.rtp - bet.rtp),
      `${bet.id}: simulated ${measured.rtp} vs declared ${bet.rtp}`,
    ).toBeLessThanOrEqual(TOLERANCE);
  }
}

describe('dice fixture — Monte Carlo', () => {
  it('lands every bet within ±0.15 pp of its declared RTP', () => {
    const exact = exactReturns(createDiceFixture, { over: 100, doubles: 100 });
    const rounds = roundsFor(Object.values(exact.bets).map((bet) => bet.standardDeviation));
    const report = simulate(createDiceFixture(), {
      rounds,
      rng: createSeededRng('dice-fixture/monte-carlo'),
      bets: { over: 100, doubles: 100 },
    });
    expect(report.rounds).toBeGreaterThanOrEqual(MIN_ROUNDS);
    expectDeclaredRtp(report, DICE_FIXTURE_BETS);
  });
});

describe('war fixture — Monte Carlo (infinite shoe)', () => {
  it('lands every bet within ±0.15 pp of its declared RTP', () => {
    const createGame = () => createWarFixture(new Shoe({ decks: Infinity }));
    const exact = exactReturns(createGame, { ante: 100 }, raiseOnEightOrBetter);
    // The play bet is only made in 6/13 of rounds: size the run on its count.
    const play = exact.bets.play!;
    const rounds = Math.ceil(
      roundsFor([exact.bets.ante!.standardDeviation, play.standardDeviation]) /
        play.frequency.toNumber(),
    );
    const report = simulate(createGame(), {
      rounds,
      rng: createSeededRng('war-fixture/monte-carlo'),
      bets: { ante: 100 },
      strategy: raiseOnEightOrBetter,
    });
    expectDeclaredRtp(report, WAR_FIXTURE_BETS);
  });
});
