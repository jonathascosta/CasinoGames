/**
 * Mirror on its real six-deck shoe (run with `pnpm test:math`).
 *
 * finite-shoe.test.ts computes, exactly, what every round of the six-deck
 * shoe returns: two cards per round and a fixed number of rounds per shoe
 * make each round a uniform draw of two cards from the full shoe. This
 * seeded run of the production game, with its cut card and reshuffles,
 * confirms that the long run returns those figures, measures the meter's
 * economics with mixed stakes, and measures what a card counter could make
 * of the shoe's composition.
 *
 * It is sized so that ±0.3 pp is 3.29 standard errors for Pair vs Pair; every
 * bet is held to 3.29 of its own standard errors around its exact six-deck
 * figure.
 */
import { describe, expect, it } from 'vitest';
import { oddsMultiplier } from '../../game/money.ts';
import type { Bets } from '../../game/types.ts';
import { roundsForTolerance, simulate } from '../../math/simulate.ts';
import type { ExactAmount } from '../../progressive/progressive.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import { MIRROR_BETS } from './bets.ts';
import { MIRROR_CONFIG } from './config.ts';
import { createMirror, mirrorMathSummary } from './game.ts';
import { MIRROR_BET_IDS, resolveMirrorBet } from './rules.ts';

const Z = 3.29;
const SEED = 'mirror/six-deck-shoe';
const { decks, jackpot: METER, sideMax } = MIRROR_CONFIG;
const JACKPOT_STAKES = [50, 100, 500, 2_500].map((stake) =>
  Object.freeze({
    mirror: 100,
    tie: 50,
    'equal-sums': 50,
    'pair-vs-pair': 50,
    'perfect-mirror': 50,
    'double-sixes': stake,
  } satisfies Bets),
);

const pct = (ratio: number, digits = 3) => `${(ratio * 100).toFixed(digits)}%`.padStart(digits + 5);
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

/**
 * What one unit on each bet returns on average when the dealer's cards are
 * (a, b), over the 36 rolls: a counter's expectation for a round is this,
 * weighted by the chance of each pair of cards from what is left in the shoe.
 */
const RETURN_GIVEN_CARDS = MIRROR_BET_IDS.map((bet) => {
  const table = new Float64Array(49);
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      let total = 0;
      for (let d1 = 1; d1 <= 6; d1++) {
        for (let d2 = 1; d2 <= 6; d2++) {
          const result = resolveMirrorBet(bet, [d1, d2], [a, b]);
          if (result.outcome === 'win') total += oddsMultiplier(result.odds);
        }
      }
      table[a * 7 + b] = total / 36;
    }
  }
  return table;
});

describe('Mirror — the six-deck shoe in the long run', () => {
  it('returns the exact six-deck figures, and reports the meter and the counting exposure', () => {
    const summary = mirrorMathSummary();
    const rounds = roundsForTolerance(MIRROR_BETS[3].standardDeviation!, 0.003, Z);
    expect(rounds).toBe(31_213_015);

    const game = createMirror();
    const start = game.jackpot.state();
    const fixed = new Ratio();
    const excludingSeed = new Ratio();
    let seedFunding = cents(start.seedFunding);
    let meterAtHits = 0;
    // The shoe's composition before each round, and what a counter could expect from it.
    const left = new Float64Array(7);
    const favourable = new Float64Array(MIRROR_BET_IDS.length + 1);
    const edgeWhenFavourable = new Float64Array(MIRROR_BET_IDS.length + 1);
    const expectedOverall = new Float64Array(MIRROR_BET_IDS.length + 1);
    let meter: number = METER.seed;
    const count = () => {
      let cards = 0;
      for (let value = 1; value <= 6; value++) cards += left[value]!;
      const pairs = cards * (cards - 1);
      for (const [index, table] of RETURN_GIVEN_CARDS.entries()) {
        let expected = -1;
        for (let a = 1; a <= 6; a++) {
          for (let b = 1; b <= 6; b++) {
            expected += ((left[a]! * (left[b]! - (a === b ? 1 : 0))) / pairs) * table[a * 7 + b]!;
          }
        }
        expectedOverall[index]! += expected;
        if (expected > 0) {
          favourable[index]!++;
          edgeWhenFavourable[index]! += expected;
        }
      }
      // Double Sixes with the meter as it stands: a hit also pays meter ÷ SIDE_MAX per unit.
      const sixes = (left[6]! * (left[6]! - 1)) / pairs / 36;
      const withMeter =
        sixes * (oddsMultiplier(MIRROR_CONFIG.odds.doubleSixes) + meter / sideMax) - 1;
      expectedOverall[MIRROR_BET_IDS.length]! += withMeter;
      if (withMeter > 0) {
        favourable[MIRROR_BET_IDS.length]!++;
        edgeWhenFavourable[MIRROR_BET_IDS.length]! += withMeter;
      }
    };

    const report = simulate(game, {
      rounds,
      rng: createSeededRng(SEED),
      bets: (round) => JACKPOT_STAKES[round % JACKPOT_STAKES.length]!,
      observe(round) {
        let counted = false;
        for (const event of round.events) {
          if (event.type === 'shoe-shuffled') left.fill(4 * decks);
          else if (event.type === 'card-dealt') {
            if (!counted) count();
            counted = true;
            left[event.card.rank]!--;
          }
        }
        const line = round.settlement['double-sixes']!;
        let share = 0;
        let topUp = 0;
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
        meter = game.jackpot.amount;
      },
    });

    const lines = [
      `Mirror on the six-deck shoe, ${rounds.toLocaleString('en-US')} rounds (seed ${SEED})`,
      'RTP                    declared  six decks  simulated   difference  standard error',
    ];
    const row = (
      label: string,
      declared: number,
      exact: number,
      measured: number,
      error: number,
    ) => {
      lines.push(
        `${label.padEnd(21)} ${pct(declared)}  ${pct(exact)}  ${pct(measured)}   ` +
          `${pp(measured - exact)}  ${(error * 100).toFixed(3)} pp`,
      );
      expect(Math.abs(measured - exact), `${label}: ${measured} vs ${exact}`).toBeLessThanOrEqual(
        Z * error,
      );
    };
    for (const bet of summary.bets) {
      const measured = report.bets[bet.betId]!;
      const shoe = bet.finiteShoe!;
      expect(measured.rounds).toBe(rounds);
      expect(
        Math.abs(measured.hitFrequency - shoe.hitFrequency),
        `${bet.betId} hit frequency`,
      ).toBeLessThanOrEqual(Z * Math.sqrt((shoe.hitFrequency * (1 - shoe.hitFrequency)) / rounds));
      if (bet.progressive === undefined)
        row(bet.label, bet.rtp, shoe.rtp, measured.rtp, measured.standardError);
    }
    const jackpotBet = summary.bets.at(-1)!;
    const contribution = METER.contributionRate;
    row(
      'Double Sixes, fixed',
      jackpotBet.progressive!.fixedRtp,
      jackpotBet.finiteShoe!.rtp - contribution,
      fixed.value,
      fixed.standardError,
    );
    row(
      'Double Sixes, excl. seed',
      jackpotBet.rtp,
      jackpotBet.finiteShoe!.rtp,
      excludingSeed.value,
      excludingSeed.standardError,
    );

    // The meter: its accounts balance exactly, and its economics with these mixed stakes.
    const end = game.jackpot.state();
    const toMicros = (amount: ExactAmount) => amount.cents * 1e6 + amount.micros;
    expect(end.pool).toBe(
      start.pool +
        toMicros(end.contributed) -
        (end.awarded - start.awarded) * 1e6 +
        toMicros(end.seedFunding),
    );
    const jackpot = report.bets['double-sixes']!;
    const hits = end.hits - start.hits;
    const topUps = seedFunding - cents(start.seedFunding);
    expect(jackpot.rtp - excludingSeed.value).toBeCloseTo(topUps / jackpot.staked, 12);
    lines.push(
      `Meter, stakes 0.50 / 1.00 / 5.00 / 25.00 in turn: ${hits.toLocaleString('en-US')} hits ` +
        `(1 in ${Math.round(rounds / hits).toLocaleString('en-US')} rounds), ` +
        `${(meterAtHits / hits / 100).toFixed(2)} on average at a hit; top-ups ` +
        `${(topUps / 100 / rounds).toFixed(2)} per round (${pct(topUps / jackpot.staked, 2)} of the ` +
        `stakes); RTP with them ${pct(jackpot.rtp)}`,
    );

    lines.push(
      'Card counting: rounds in which a perfect counter has the edge, the edge then, and the bet ' +
        'spread at which the counter breaks even (one unit in the other rounds)',
    );
    const labels = [...summary.bets.map((bet) => bet.label), 'Double Sixes with the meter'];
    for (const [index, label] of labels.entries()) {
      const times = favourable[index] ?? 0;
      const share = times / rounds;
      const edge = times === 0 ? 0 : (edgeWhenFavourable[index] ?? 0) / times;
      const gained = edgeWhenFavourable[index] ?? 0;
      const lost = gained - (expectedOverall[index] ?? 0);
      const spread =
        gained <= 0 ? '—' : lost <= 0 ? 'none needed' : `1 to ${(lost / gained).toFixed(1)}`;
      lines.push(
        `  ${label.padEnd(26)} ${pct(share, 2)} of rounds, edge ${pct(edge, 1)} in them, ` +
          `break-even spread ${spread}`,
      );
    }
    process.stdout.write(`${lines.join('\n')}\n`);
  });
});
