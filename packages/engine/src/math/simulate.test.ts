import { describe, expect, it } from 'vitest';
import { Shoe } from '../cards/shoe.ts';
import { createDiceFixture } from '../fixtures/dice-fixture.ts';
import { createWarFixture, raiseOnEightOrBetter } from '../fixtures/war-fixture.ts';
import { createSeededRng } from '../rng/seeded.ts';
import { roundsForTolerance, simulate } from './simulate.ts';

describe('simulate', () => {
  const run = (seed: string, rounds = 20_000) =>
    simulate(createDiceFixture(), {
      rounds,
      rng: createSeededRng(seed),
      bets: { over: 200, doubles: 100 },
    });

  it('is deterministic for a seed', () => {
    expect(run('sim')).toEqual(run('sim'));
    expect(run('sim')).not.toEqual(run('other'));
  });

  it('accounts every round and every cent', () => {
    const report = run('ledger');
    const over = report.bets.over!;
    expect(report.rounds).toBe(20_000);
    expect(over.rounds).toBe(20_000);
    expect(over.staked).toBe(20_000 * 200);
    expect(report.total.staked).toBe(20_000 * 300);
    expect(report.total.returned).toBe(over.returned + report.bets.doubles!.returned);
    expect(over.rtp).toBe(over.returned / over.staked);
    expect(over.houseEdge).toBeCloseTo(1 - over.rtp, 15);
  });

  it('estimates volatility and standard error consistently with the exact values', () => {
    const over = run('volatility', 200_000).bets.over!;
    expect(over.standardDeviation).toBeCloseTo(Math.sqrt(35 / 36), 2);
    expect(over.standardError).toBeCloseTo(over.standardDeviation / Math.sqrt(200_000), 12);
    expect(over.hitFrequency).toBeCloseTo(15 / 36, 2);
  });

  it('measures bets that are only sometimes made (raises)', () => {
    const report = simulate(createWarFixture(new Shoe({ decks: Infinity })), {
      rounds: 20_000,
      rng: createSeededRng('war-sim'),
      bets: { ante: 100 },
      strategy: raiseOnEightOrBetter,
    });
    expect(report.bets.ante!.rounds).toBe(20_000);
    expect(report.bets.play!.rounds / 20_000).toBeCloseTo(6 / 13, 1);
    // The ante pushes when the player raises and the ranks tie: 6/13 × 1/13.
    expect(report.bets.ante!.pushFrequency).toBeCloseTo(6 / 169, 2);
  });

  it('rejects silly round counts', () => {
    expect(() => run('x', 1)).toThrow(RangeError);
  });
});

describe('roundsForTolerance', () => {
  it('sizes a run so ±0.15 pp is 3.29 standard errors', () => {
    expect(roundsForTolerance(1)).toBe(Math.ceil((3.29 / 0.0015) ** 2)); // ≈ 4.8M
    expect(roundsForTolerance(0.5)).toBe(Math.ceil(((3.29 * 0.5) / 0.0015) ** 2));
    expect(() => roundsForTolerance(0)).toThrow(RangeError);
  });
});
