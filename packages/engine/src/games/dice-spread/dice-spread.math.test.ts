/**
 * Monte Carlo verification of Dice Spread (run with `pnpm test:math`).
 *
 * One seeded run of the full layout, all five bets, dealt from the real
 * six-deck shoe with its cut card, not an infinite shoe. Removing cards does
 * not change the long-run RTP here: each round deals one card, and the
 * rounds a shoe deals do not depend on the cards, so every dealt card is
 * uniform over ace to six on average. This run checks that claim together
 * with the whole production path (shoe, reshuffles, RNG, settlement).
 *
 * The run is sized for the most volatile bet (Triple, σ ≈ 5.09) so that
 * ±0.15 pp is 3.29 standard errors: about 125 million rounds.
 */
import { describe, expect, it } from 'vitest';
import { roundsForTolerance, simulate } from '../../math/simulate.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import {
  describeShoe,
  recordFigures,
  simulationRecord,
  verification,
} from '../../testing/record.ts';
import { DICE_SPREAD_BETS } from './bets.ts';
import { createDiceSpread, createDiceSpreadShoe, diceSpreadMathSummary } from './game.ts';

const TOLERANCE = 0.0015;
const MIN_ROUNDS = 2_000_000;
const Z = 3.29;
const SEED = 'dice-spread/monte-carlo';

describe('Dice Spread — Monte Carlo against the real six-deck shoe', () => {
  it('lands every bet within ±0.15 pp of its declared RTP', async () => {
    const volatility = Math.max(...DICE_SPREAD_BETS.map((bet) => bet.standardDeviation));
    const rounds = Math.max(MIN_ROUNDS, roundsForTolerance(volatility, TOLERANCE, Z));
    const bets = Object.fromEntries(DICE_SPREAD_BETS.map((bet) => [bet.id, bet.min]));
    const shoe = createDiceSpreadShoe();

    const report = simulate(createDiceSpread({ source: shoe }), {
      rounds,
      rng: createSeededRng(SEED),
      bets,
    });

    expect(report.rounds).toBeGreaterThan(120_000_000);
    const results: Record<string, object> = {};
    for (const bet of diceSpreadMathSummary().bets) {
      const measured = report.bets[bet.betId]!;
      expect(measured.rounds).toBe(rounds);
      expect(
        Math.abs(measured.rtp - bet.rtp),
        `${bet.betId}: simulated RTP ${measured.rtp} vs declared ${bet.rtp} ` +
          `(standard error ${measured.standardError})`,
      ).toBeLessThanOrEqual(TOLERANCE);

      // Hit and push frequencies: within 3.29 binomial standard errors.
      const frequencies = [
        ['hit', measured.hitFrequency, bet.hitFrequency],
        ['push', measured.pushFrequency, bet.pushFrequency ?? 0],
      ] as const;
      for (const [name, simulated, declared] of frequencies) {
        expect(declared, `${bet.betId} declares its ${name} frequency`).toBeDefined();
        const p = declared ?? Number.NaN;
        const bound = Z * Math.sqrt((p * (1 - p)) / rounds);
        expect(
          Math.abs(simulated - p),
          `${bet.betId} ${name} frequency: simulated ${simulated} vs declared ${p}`,
        ).toBeLessThanOrEqual(bound);
      }
      const binomial = (p: number) => Z * Math.sqrt((p * (1 - p)) / rounds);
      const hit = bet.hitFrequency!;
      const push = bet.pushFrequency ?? 0;
      results[bet.betId] = {
        statistics: measured,
        rtp: verification(bet.rtp, measured.rtp, measured.standardError, TOLERANCE),
        hitFrequency: verification(
          hit,
          measured.hitFrequency,
          Math.sqrt((hit * (1 - hit)) / rounds),
          binomial(hit),
        ),
        pushFrequency: verification(
          push,
          measured.pushFrequency,
          Math.sqrt((push * (1 - push)) / rounds),
          binomial(push),
        ),
      };
    }
    await recordFigures('monte-carlo', {
      simulation: simulationRecord({
        rounds,
        seed: SEED,
        source: describeShoe(shoe),
        stakes: bets,
        z: Z,
        tolerance: TOLERANCE,
      }),
      bets: results,
    });
  });
});
