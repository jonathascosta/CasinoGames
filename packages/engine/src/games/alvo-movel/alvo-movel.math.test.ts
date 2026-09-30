/**
 * Monte Carlo verification of Alvo Móvel's declared figures (run with
 * `pnpm test:math`).
 *
 * The declared math assumes an infinite shoe, so this run deals from one,
 * through the production game and RNG: every RTP must land within ±0.15 pp
 * of its declared value. The run is sized so that ±0.15 pp is 3.29 standard
 * errors for the most volatile bet (Primeira Carta, σ ≈ 2.89): about 40
 * million rounds. The real six-deck shoe returns slightly different figures;
 * six-deck.math.test.ts measures by how much.
 */
import { describe, expect, it } from 'vitest';
import { RANK_SETS } from '../../cards/card.ts';
import { Shoe } from '../../cards/shoe.ts';
import { roundsForTolerance, simulate } from '../../math/simulate.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import { ALVO_MOVEL_BETS } from './bets.ts';
import { alvoMovelMathSummary, createAlvoMovel } from './game.ts';

const TOLERANCE = 0.0015;
const MIN_ROUNDS = 2_000_000;
const Z = 3.29;

describe('Alvo Móvel — Monte Carlo against the declared figures (infinite shoe)', () => {
  it('lands every bet within ±0.15 pp of its declared RTP', () => {
    const volatility = Math.max(...ALVO_MOVEL_BETS.map((bet) => bet.standardDeviation));
    const rounds = Math.max(MIN_ROUNDS, roundsForTolerance(volatility, TOLERANCE, Z));
    const bets = Object.fromEntries(ALVO_MOVEL_BETS.map((bet) => [bet.id, bet.min]));
    const infiniteShoe = new Shoe({ decks: Infinity, ranks: RANK_SETS.aceToTen });

    const report = simulate(createAlvoMovel({ source: infiniteShoe }), {
      rounds,
      rng: createSeededRng('alvo-movel/infinite-shoe'),
      bets,
    });

    expect(report.rounds).toBeGreaterThan(40_000_000);
    for (const bet of alvoMovelMathSummary().bets) {
      const measured = report.bets[bet.betId]!;
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
    }
  });
});
