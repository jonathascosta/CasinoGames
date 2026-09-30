/**
 * How much the real six-deck shoe shifts Moving Target's edges (run with
 * `pnpm test:math`).
 *
 * The declared figures assume an infinite shoe. The table deals from six
 * decks of aces to tens with a cut card, and there the long run differs: a
 * round draws several cards without replacement (finite-shoe.test.ts shows
 * that effect exactly for the first round after a shuffle), the card that
 * ends a round tends to be a high one, which tilts what the next round
 * draws, and how many rounds a shoe deals depends on its cards.
 *
 * This seeded run of the production game measures each bet's long-run house
 * edge and Exact Hit's per target, prints the shifts from the declared figures
 * (docs/games/moving-target.md reports them) and bounds them. It is sized so
 * that each bet's shift is measured to ±0.07 pp at 3.29 standard errors:
 * about 184 million rounds.
 */
import { describe, expect, it } from 'vitest';
import { oddsMultiplier } from '../../game/money.ts';
import { roundsForTolerance, simulate } from '../../math/simulate.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import { MOVING_TARGET_BETS } from './bets.ts';
import { movingTargetMathSummary, createMovingTarget } from './game.ts';
import { EXACT_HIT_ODDS, TARGETS, targetOf } from './rules.ts';

/** Precision of each bet's measured shift, at Z standard errors. */
const PRECISION = 0.0007;
const Z = 3.29;
/** No edge moves further than this on the six-deck shoe (none moves more than about 0.1 pp per bet). */
const MAX_SHIFT = 0.0025;
const SEED = 'moving-target/six-deck-shoe';

const pct = (ratio: number) => `${(ratio * 100).toFixed(2)}%`.padStart(7);
const pp = (ratio: number) => {
  const text = Math.abs(ratio * 100).toFixed(2);
  return `${ratio < 0 && Number(text) !== 0 ? '−' : '+'}${text} pp`;
};

describe('Moving Target — the six-deck shoe against the declared (infinite-shoe) figures', () => {
  it('shifts no edge by more than a quarter of a point, and reports each shift', () => {
    const volatility = Math.max(...MOVING_TARGET_BETS.map((bet) => bet.standardDeviation));
    const rounds = roundsForTolerance(volatility, PRECISION, Z);
    const bets = Object.fromEntries(MOVING_TARGET_BETS.map((bet) => [bet.id, bet.min]));
    // Exact Hit per target: rounds with that target, and wins among them.
    const byTarget = { rounds: new Float64Array(13), hits: new Float64Array(13) };

    const report = simulate(createMovingTarget(), {
      rounds,
      rng: createSeededRng(SEED),
      bets,
      observe(round) {
        for (const event of round.events) {
          if (event.type !== 'dice-rolled') continue;
          const target = targetOf(event.dice);
          byTarget.rounds[target]!++;
          if (round.settlement['exact-hit']?.outcome === 'win') byTarget.hits[target]!++;
          return;
        }
      },
    });

    const summary = movingTargetMathSummary();
    const lines = [
      `Moving Target on the six-deck shoe, ${rounds.toLocaleString('en-US')} rounds (seed ${SEED})`,
      'House edge       declared  six-deck  shift     standard error',
    ];
    for (const bet of summary.bets) {
      const measured = report.bets[bet.betId]!;
      expect(measured.rounds).toBe(rounds);
      const shift = measured.houseEdge - bet.houseEdge;
      lines.push(
        `${bet.label.padEnd(16)} ${pct(bet.houseEdge)}   ${pct(measured.houseEdge)}   ` +
          `${pp(shift)}  ${(measured.standardError * 100).toFixed(3)} pp`,
      );
      expect(Math.abs(shift), `${bet.betId}: house edge shift ${shift}`).toBeLessThanOrEqual(
        MAX_SHIFT,
      );
    }

    lines.push('Exact Hit by target: hit chance and house edge, declared → six-deck');
    const rows = summary.bets[0]!.breakdown!.rows;
    for (const [index, target] of TARGETS.entries()) {
      const declared = rows[index]!;
      const n = byTarget.rounds[target]!;
      const hit = byTarget.hits[target]! / n;
      const pays = oddsMultiplier(EXACT_HIT_ODDS[target]);
      const edge = 1 - hit * pays;
      const standardError = pays * Math.sqrt((hit * (1 - hit)) / n);
      const shift = edge - declared.houseEdge;
      lines.push(
        `  ${String(target).padStart(2)}  hit ${pct(declared.hitFrequency)} → ${pct(hit)}   ` +
          `edge ${pct(declared.houseEdge)} → ${pct(edge)}  ${pp(shift)}  ` +
          `± ${(standardError * 100).toFixed(3)} pp`,
      );
      expect(
        Math.abs(shift),
        `target ${target}: house edge shift ${shift} (standard error ${standardError})`,
      ).toBeLessThanOrEqual(MAX_SHIFT + Z * standardError);
    }
    process.stdout.write(`${lines.join('\n')}\n`);
  });
});
