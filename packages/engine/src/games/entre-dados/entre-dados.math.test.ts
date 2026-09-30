/**
 * Monte Carlo verification of Entre Dados (run with `pnpm test:math`).
 *
 * One seeded run of the full layout, all five bets, dealt from the real
 * six-deck shoe with its cut card, not an infinite shoe. Removing cards does
 * not change the long-run RTP here: each round deals one card, and the
 * rounds a shoe deals do not depend on the cards, so every dealt card is
 * uniform over ace to six on average. This run checks that claim together
 * with the whole production path (shoe, reshuffles, RNG, settlement).
 *
 * The run is sized for the most volatile bet (Triplo, σ ≈ 5.09) so that
 * ±0.15 pp is 3.29 standard errors: about 125 million rounds.
 */
import { describe, expect, it } from 'vitest';
import { roundsForTolerance, simulate } from '../../math/simulate.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import { ENTRE_DADOS_BETS } from './bets.ts';
import { createEntreDados, entreDadosMathSummary } from './game.ts';

const TOLERANCE = 0.0015;
const MIN_ROUNDS = 2_000_000;
const Z = 3.29;

describe('Entre Dados — Monte Carlo against the real six-deck shoe', () => {
  it('lands every bet within ±0.15 pp of its declared RTP', () => {
    const volatility = Math.max(...ENTRE_DADOS_BETS.map((bet) => bet.standardDeviation));
    const rounds = Math.max(MIN_ROUNDS, roundsForTolerance(volatility, TOLERANCE, Z));
    const bets = Object.fromEntries(ENTRE_DADOS_BETS.map((bet) => [bet.id, bet.min]));

    const report = simulate(createEntreDados(), {
      rounds,
      rng: createSeededRng('entre-dados/monte-carlo'),
      bets,
    });

    expect(report.rounds).toBeGreaterThan(120_000_000);
    for (const bet of entreDadosMathSummary().bets) {
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
    }
  });
});
