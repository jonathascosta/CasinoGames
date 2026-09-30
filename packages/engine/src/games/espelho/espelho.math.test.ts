/**
 * Monte Carlo check of Espelho's declared figures (run with `pnpm test:math`).
 *
 * The declared figures assume an infinite shoe, so this run deals from one,
 * through the production game: all six bets every round, with 6-6 vs 6-6
 * staked at 0.50, 1.00, 5.00 and 25.00 in turn and its meter live.
 *
 * It is sized so that ±0.15 pp is 3.29 standard errors for every bet that
 * size can hold: Par vs Par (σ 5.09) sets it at 124,852,059 rounds.
 * Espelho Perfeito (σ 13.6) and 6-6 vs 6-6 (σ 33.3 with the meter at its
 * seed) would need about 0.9 and 5.4 billion rounds for that, so they are
 * held to 3.29 of their own standard errors instead; their exact test
 * (espelho.test.ts) is the proof. For 6-6 vs 6-6 the run checks the fixed
 * pays, the RTP excluding the seed (the declared 87.24%), the hit
 * frequency, and the meter's accounts to the millionth of a cent.
 */
import { describe, expect, it } from 'vitest';
import { RANK_SETS } from '../../cards/card.ts';
import { Shoe } from '../../cards/shoe.ts';
import type { Bets } from '../../game/types.ts';
import { roundsForTolerance, simulate } from '../../math/simulate.ts';
import type { ExactAmount } from '../../progressive/progressive.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import { ESPELHO_BETS, SEIS_SEIS_FIXED_RTP } from './bets.ts';
import { createEspelho, espelhoMathSummary } from './game.ts';

const TOLERANCE = 0.0015;
const Z = 3.29;
/** The most rounds a bet's tolerance may call for; beyond it, 3.29 of its standard errors. */
const BUDGET = 200_000_000;
const SEED = 'espelho/infinite-shoe';
const JACKPOT_STAKES = [50, 100, 500, 2_500].map((stake) =>
  Object.freeze({
    espelho: 100,
    empate: 50,
    'somas-iguais': 50,
    'par-vs-par': 50,
    'espelho-perfeito': 50,
    'seis-seis': stake,
  } satisfies Bets),
);

const pct = (ratio: number) => `${(ratio * 100).toFixed(3)}%`.padStart(8);
const pp = (ratio: number) => {
  const text = Math.abs(ratio * 100).toFixed(3);
  return `${ratio < 0 && Number(text) !== 0 ? '−' : '+'}${text} pp`;
};
const cents = (amount: ExactAmount) => amount.cents + amount.micros / 1e6;

/** Σ payout ÷ Σ stake with its delta-method standard error (stakes vary from round to round). */
class Ratio {
  n = 0;
  x = 0;
  y = 0;
  xx = 0;
  yy = 0;
  xy = 0;

  add(stake: number, returned: number): void {
    const [x, y] = [stake / 100, returned / 100];
    this.n++;
    this.x += x;
    this.y += y;
    this.xx += x * x;
    this.yy += y * y;
    this.xy += x * y;
  }

  get value(): number {
    return this.y / this.x;
  }

  get standardError(): number {
    const r = this.value;
    const residual = (this.yy - 2 * r * this.xy + r * r * this.xx) / (this.n - 1);
    return Math.sqrt(Math.max(0, residual)) / (this.x / this.n) / Math.sqrt(this.n);
  }
}

describe('Espelho — Monte Carlo on an infinite shoe against the declared figures', () => {
  it('lands every bet on its declared RTP and hit frequency', () => {
    const summary = espelhoMathSummary();
    const required = ESPELHO_BETS.map((bet) =>
      roundsForTolerance(bet.standardDeviation!, TOLERANCE, Z),
    );
    const rounds = Math.max(2_000_000, ...required.filter((count) => count <= BUDGET));
    expect(rounds).toBe(124_852_059);

    const game = createEspelho({
      source: new Shoe({ decks: Infinity, ranks: RANK_SETS.aceToSix }),
    });
    const start = game.jackpot.state();
    const fixed = new Ratio();
    const excludingSeed = new Ratio();
    let seedFunding = cents(start.seedFunding);
    let meterAtHits = 0;
    const report = simulate(game, {
      rounds,
      rng: createSeededRng(SEED),
      bets: (round) => JACKPOT_STAKES[round % JACKPOT_STAKES.length]!,
      observe(round) {
        const line = round.settlement['seis-seis']!;
        let share = 0;
        let topUp = 0;
        // Only a hit moves the meter down, so only a hit can need a top-up.
        if (line.outcome === 'win') {
          for (const event of round.events) {
            if (event.type === 'jackpot-won') share = event.amount;
            else if (event.type === 'jackpot-meter' && event.cause === 'contribution') {
              meterAtHits += event.amount;
            }
          }
          const funded = cents(game.jackpot.state().seedFunding);
          topUp = funded - seedFunding;
          seedFunding = funded;
        }
        fixed.add(line.stake, line.payout - share);
        excludingSeed.add(line.stake, line.payout - topUp);
      },
    });

    const lines = [
      `Espelho on an infinite shoe, ${rounds.toLocaleString('en-US')} rounds (seed ${SEED})`,
      'RTP                    declared  simulated   difference  standard error  allowed',
    ];
    const row = (
      label: string,
      declared: number,
      measured: number,
      error: number,
      allowed: number,
    ) => {
      lines.push(
        `${label.padEnd(21)} ${pct(declared)}  ${pct(measured)}   ${pp(measured - declared)}  ` +
          `${(error * 100).toFixed(3)} pp        ±${(allowed * 100).toFixed(3)} pp`,
      );
      expect(
        Math.abs(measured - declared),
        `${label}: ${measured} vs ${declared}`,
      ).toBeLessThanOrEqual(allowed);
    };

    for (const bet of summary.bets) {
      const measured = report.bets[bet.betId]!;
      expect(measured.rounds).toBe(rounds);
      // Hit frequency within 3.29 binomial standard errors.
      const p = bet.hitFrequency!;
      expect(Math.abs(measured.hitFrequency - p), `${bet.betId} hit frequency`).toBeLessThanOrEqual(
        Z * Math.sqrt((p * (1 - p)) / rounds),
      );
      expect(measured.pushFrequency).toBe(0);
      if (bet.progressive !== undefined) continue;
      const error = bet.standardDeviation! / Math.sqrt(rounds);
      row(bet.label, bet.rtp, measured.rtp, measured.standardError, Math.max(TOLERANCE, Z * error));
    }

    // 6-6 vs 6-6: the fixed pays, and the RTP excluding the seed (what the players' own stakes return).
    const jackpot = report.bets['seis-seis']!;
    const meter = game.jackpot.state();
    const hits = meter.hits - start.hits;
    row(
      '6-6 vs 6-6, fixed',
      SEIS_SEIS_FIXED_RTP.toNumber(),
      fixed.value,
      fixed.standardError,
      Z * fixed.standardError,
    );
    row(
      '6-6 vs 6-6, excl. seed',
      ESPELHO_BETS.at(-1)!.rtp,
      excludingSeed.value,
      excludingSeed.standardError,
      Z * excludingSeed.standardError,
    );
    // The accounts balance exactly: the meter paid out the seed, the contributions and the
    // top-ups, less what it still holds.
    const toMicros = (amount: ExactAmount) => amount.cents * 1e6 + amount.micros;
    expect(meter.pool).toBe(
      start.pool +
        toMicros(meter.contributed) -
        (meter.awarded - start.awarded) * 1e6 +
        toMicros(meter.seedFunding),
    );
    expect(toMicros(meter.contributed)).toBe((jackpot.staked * 1e6) / 10);
    // Top-ups are the house's money: the RTP including them differs by exactly their share.
    const topUps = seedFunding - cents(start.seedFunding);
    expect(topUps).toBeGreaterThan(0);
    expect(jackpot.rtp - excludingSeed.value).toBeCloseTo(topUps / jackpot.staked, 12);
    lines.push(
      `Meter: ${hits.toLocaleString('en-US')} hits (1 in ${Math.round(rounds / hits).toLocaleString('en-US')} rounds), ` +
        `${(meterAtHits / hits / 100).toFixed(2)} on average at a hit; top-ups ` +
        `${(topUps / 100 / rounds).toFixed(2)} per round; RTP with them ${pct(jackpot.rtp)}`,
    );
    process.stdout.write(`${lines.join('\n')}\n`);
  });
});
