/**
 * Monte Carlo check of Lock & Roll's declared figures (run with `pnpm test:math`).
 *
 * The declared figures assume the dealer's cards come from an infinite
 * shoe, so this run deals from one, through the production game, with the
 * reference strategy deciding every round (the same bot autoplay uses). The
 * fees count against the return, as in the declared RTP.
 *
 * It is sized so that ±0.15 pp is 3.29 standard errors (σ 1.034 with the
 * fee): 5,144,842 rounds. The frequencies of re-rolls and fees are held to
 * 3.29 binomial standard errors.
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
import { LOCK_AND_ROLL_BETS, LOCK_AND_ROLL_MATH } from './bets.ts';
import { createLockAndRoll, lockAndRollStrategy } from './game.ts';

const TOLERANCE = 0.0015;
const Z = 3.29;
const SEED = 'lock-and-roll/infinite-shoe';

const pct = (ratio: number) => `${(ratio * 100).toFixed(3)}%`.padStart(8);
const pp = (ratio: number) => {
  const text = Math.abs(ratio * 100).toFixed(3);
  return `${ratio < 0 && Number(text) !== 0 ? '−' : '+'}${text} pp`;
};

describe('Lock & Roll — Monte Carlo on an infinite shoe against the declared figures', () => {
  it('lands on the declared RTP, win frequency, re-roll and fee frequencies', async () => {
    const bet = LOCK_AND_ROLL_BETS[0];
    const rounds = Math.max(2_000_000, roundsForTolerance(bet.standardDeviation, TOLERANCE, Z));
    expect(rounds).toBe(5_144_842);

    let rerolls = 0;
    let freeRerolls = 0;
    let paid = 0;
    const infiniteShoe = new Shoe({ decks: Infinity, ranks: RANK_SETS.aceToSix });
    const report = simulate(createLockAndRoll({ source: infiniteShoe }), {
      rounds,
      rng: createSeededRng(SEED),
      bets: { 'lock-and-roll': 100 },
      strategy: lockAndRollStrategy(),
      observe(round) {
        let rerolled = false;
        for (const event of round.events) if (event.type === 'die-rerolled') rerolled = true;
        if (!rerolled) return;
        rerolls++;
        if (round.settlement['lock-and-roll']!.fee === undefined) freeRerolls++;
        else paid++;
      },
    });

    const measured = report.bets['lock-and-roll']!;
    expect(measured.rounds).toBe(rounds);
    const binomial = (p: number) => Z * Math.sqrt((p * (1 - p)) / rounds);
    const lines = [
      `Lock & Roll on an infinite shoe, ${rounds.toLocaleString('en-US')} rounds (seed ${SEED}), ` +
        'the reference strategy deciding',
      'Figure                declared  simulated   difference  allowed',
    ];
    const results: Record<string, object> = {};
    const row = (
      key: string,
      label: string,
      declared: number,
      simulated: number,
      allowed: number,
      standardError: number,
    ) => {
      results[key] = verification(declared, simulated, standardError, allowed);
      lines.push(
        `${label.padEnd(21)} ${pct(declared)}  ${pct(simulated)}   ${pp(simulated - declared)}  ` +
          `±${(allowed * 100).toFixed(3)} pp`,
      );
      expect(
        Math.abs(simulated - declared),
        `${label}: ${simulated} vs ${declared}`,
      ).toBeLessThanOrEqual(allowed);
    };
    const error = (p: number) => Math.sqrt((p * (1 - p)) / rounds);
    row('rtp', 'RTP', bet.rtp, measured.rtp, TOLERANCE, measured.standardError);
    const win = LOCK_AND_ROLL_MATH.hitFrequency.toNumber();
    row('hitFrequency', 'Win frequency', win, measured.hitFrequency, binomial(win), error(win));
    const reroll = LOCK_AND_ROLL_MATH.rerollFrequency.toNumber();
    row(
      'rerollFrequency',
      'Lock (re-rolls)',
      reroll,
      rerolls / rounds,
      binomial(reroll),
      error(reroll),
    );
    row(
      'freeRerollFrequency',
      'Free 1-1 re-rolls',
      1 / 36,
      freeRerolls / rounds,
      binomial(1 / 36),
      error(1 / 36),
    );
    const fee = LOCK_AND_ROLL_MATH.feeFrequency.toNumber();
    row('feeFrequency', 'Fee paid', fee, paid / rounds, binomial(fee), error(fee));
    // Every fee is 40¢ on a 1.00 bet.
    expect(measured.fees).toBe(paid * 40);
    expect(measured.pushFrequency).toBe(0);
    expect(measured.standardDeviation).toBeCloseTo(bet.standardDeviation, 2);
    lines.push(
      `Standard error of the RTP ${(measured.standardError * 100).toFixed(3)} pp; volatility ` +
        `${measured.standardDeviation.toFixed(4)} (declared ${bet.standardDeviation.toFixed(4)})`,
    );
    process.stdout.write(`${lines.join('\n')}\n`);
    await recordFigures('infinite-shoe', {
      simulation: simulationRecord({
        rounds,
        seed: SEED,
        source: describeShoe(infiniteShoe),
        stakes: { 'lock-and-roll': 100 },
        strategy: 'reference',
        z: Z,
        tolerance: TOLERANCE,
      }),
      statistics: measured,
      results,
      counts: { rerolls, freeRerolls, feesPaid: paid },
    });
  });
});
