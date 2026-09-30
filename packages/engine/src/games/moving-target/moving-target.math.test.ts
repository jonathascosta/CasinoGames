/**
 * Monte Carlo verification of Moving Target's declared figures (run with
 * `pnpm test:math`).
 *
 * The declared math assumes an infinite shoe, so this run deals from one,
 * through the production game and RNG: every RTP must land within ±0.15 pp
 * of its declared value. The run is sized so that ±0.15 pp is 3.29 standard
 * errors for the most volatile bet (First Card, σ ≈ 2.89): about 40
 * million rounds. The real six-deck shoe returns slightly different figures;
 * six-deck.math.test.ts measures by how much.
 */
import { describe, expect, it } from 'vitest';
import { RANK_SETS } from '../../cards/card.ts';
import { Shoe } from '../../cards/shoe.ts';
import { roundsForTolerance, simulate } from '../../math/simulate.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import {
  describeShoe,
  recordFigures,
  simulationRecord,
  verification,
} from '../../testing/record.ts';
import { MOVING_TARGET_BETS } from './bets.ts';
import { movingTargetMathSummary, createMovingTarget } from './game.ts';

const TOLERANCE = 0.0015;
const MIN_ROUNDS = 2_000_000;
const Z = 3.29;
const SEED = 'moving-target/infinite-shoe';

const percent = (ratio: number) => `${(ratio * 100).toFixed(3)}%`.padStart(8);
const points = (ratio: number) => {
  const text = Math.abs(ratio * 100).toFixed(3);
  return `${ratio < 0 && Number(text) !== 0 ? '−' : '+'}${text} pp`;
};

describe('Moving Target — Monte Carlo against the declared figures (infinite shoe)', () => {
  it('lands every bet within ±0.15 pp of its declared RTP', async () => {
    const volatility = Math.max(...MOVING_TARGET_BETS.map((bet) => bet.standardDeviation));
    const rounds = Math.max(MIN_ROUNDS, roundsForTolerance(volatility, TOLERANCE, Z));
    const bets = Object.fromEntries(MOVING_TARGET_BETS.map((bet) => [bet.id, bet.min]));
    const infiniteShoe = new Shoe({ decks: Infinity, ranks: RANK_SETS.aceToTen });

    const report = simulate(createMovingTarget({ source: infiniteShoe }), {
      rounds,
      rng: createSeededRng(SEED),
      bets,
    });

    expect(report.rounds).toBeGreaterThan(40_000_000);
    const lines = [
      `Moving Target on an infinite shoe, ${rounds.toLocaleString('en-US')} rounds (seed ${SEED})`,
      'RTP              declared   simulated  difference  standard error',
    ];
    const results: Record<string, object> = {};
    for (const bet of movingTargetMathSummary().bets) {
      const measured = report.bets[bet.betId]!;
      lines.push(
        `${bet.label.padEnd(16)} ${percent(bet.rtp)}   ${percent(measured.rtp)}   ` +
          `${points(measured.rtp - bet.rtp)}   ${(measured.standardError * 100).toFixed(3)} pp`,
      );
      expect(measured.rounds).toBe(rounds);
      expect(
        Math.abs(measured.rtp - bet.rtp),
        `${bet.betId}: simulated RTP ${measured.rtp} vs declared ${bet.rtp} ` +
          `(standard error ${measured.standardError})`,
      ).toBeLessThanOrEqual(TOLERANCE);

      // Hit frequency: within 3.29 binomial standard errors (no bet pushes).
      const p = bet.hitFrequency ?? Number.NaN;
      expect(
        Math.abs(measured.hitFrequency - p),
        `${bet.betId} hit frequency: simulated ${measured.hitFrequency} vs declared ${p}`,
      ).toBeLessThanOrEqual(Z * Math.sqrt((p * (1 - p)) / rounds));
      expect(measured.pushFrequency).toBe(0);
      const binomial = Math.sqrt((p * (1 - p)) / rounds);
      results[bet.betId] = {
        statistics: measured,
        rtp: verification(bet.rtp, measured.rtp, measured.standardError, TOLERANCE),
        hitFrequency: verification(p, measured.hitFrequency, binomial, Z * binomial),
      };
    }
    process.stdout.write(`${lines.join('\n')}\n`);
    await recordFigures('infinite-shoe', {
      simulation: simulationRecord({
        rounds,
        seed: SEED,
        source: describeShoe(infiniteShoe),
        stakes: bets,
        z: Z,
        tolerance: TOLERANCE,
      }),
      bets: results,
    });
  });
});
