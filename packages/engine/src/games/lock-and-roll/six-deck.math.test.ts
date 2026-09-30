/**
 * Lock & Roll on its real six-deck shoe (run with `pnpm test:math`).
 *
 * finite-shoe.test.ts computes, exactly, what every round of the six-deck
 * shoe returns: two cards a round and 54 rounds a shoe make each round's
 * cards a uniform draw from the full shoe. This seeded run of the
 * production game, with its cut card and reshuffles and the reference
 * strategy deciding, confirms that the long run returns that figure, and
 * measures what a card counter could make of the shoe's composition: by
 * betting more when the cards left favour the dice, and by deciding with
 * the cards left in mind.
 *
 * It is sized like the infinite-shoe run: ±0.15 pp is 3.29 standard errors.
 */
import { describe, expect, it } from 'vitest';
import { DIE_FACES } from '../../dice/dice.ts';
import { roundsForTolerance, simulate } from '../../math/simulate.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import {
  describeShoe,
  recordFigures,
  simulationRecord,
  verification,
} from '../../testing/record.ts';
import { LOCK_AND_ROLL_BETS, LOCK_AND_ROLL_SIX_DECK } from './bets.ts';
import { LOCK_AND_ROLL_CONFIG } from './config.ts';
import { createLockAndRoll, createLockAndRollShoe, lockAndRollStrategy } from './game.ts';
import { DISTINCT_ROLLS, feeRate, referenceStrategy } from './strategy.ts';

const TOLERANCE = 0.0015;
const Z = 3.29;
const SEED = 'lock-and-roll/six-deck-shoe';
const { decks, rules } = LOCK_AND_ROLL_CONFIG;

const pct = (ratio: number, digits = 3) => `${(ratio * 100).toFixed(digits)}%`.padStart(digits + 5);
const pp = (ratio: number) => {
  const text = Math.abs(ratio * 100).toFixed(3);
  return `${ratio < 0 && Number(text) !== 0 ? '−' : '+'}${text} pp`;
};

/** The 21 rolls: their chance, the fee a re-roll costs, and whether the reference strategy re-rolls. */
const ROLLS = DISTINCT_ROLLS.map(({ dice, probability }) => ({
  low: dice[0],
  high: dice[1],
  chance: probability.toNumber(),
  fee: feeRate(dice, rules).toNumber(),
  rerolls: referenceStrategy(rules)(dice) !== 'stand',
}));

/**
 * What one unit returns net, on average, with `left[v]` cards of each value
 * v still in the shoe: with the reference strategy, and with the best
 * choice on each roll for these cards (a counter's decisions).
 */
function expectation(left: Float64Array): { readonly fixed: number; readonly counter: number } {
  let cards = 0;
  for (let value = 1; value <= 6; value++) cards += left[value]!;
  const pairs = cards * (cards - 1);
  const dealer = new Float64Array(13);
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      dealer[a + b]! += (left[a]! * (left[b]! - (a === b ? 1 : 0))) / pairs;
    }
  }
  // stand[t]: standing on a total t, 2·P(dealer < t) − 1.
  const stand = new Float64Array(13);
  let below = 0;
  for (let total = 2; total <= 12; total++) {
    stand[total] = 2 * below - 1;
    below += dealer[total]!;
  }
  const reroll = (kept: number) => {
    let sum = 0;
    for (const face of DIE_FACES) sum += stand[kept + face]!;
    return sum / 6;
  };
  let fixed = 0;
  let counter = 0;
  for (const roll of ROLLS) {
    const standing = stand[roll.low + roll.high]!;
    const rerolling = reroll(roll.high) - roll.fee;
    fixed += roll.chance * (roll.rerolls ? rerolling : standing);
    counter += roll.chance * Math.max(standing, rerolling);
  }
  return { fixed, counter };
}

describe('Lock & Roll — the six-deck shoe in the long run', () => {
  it('returns the exact six-deck figures, and reports the counting exposure', async () => {
    const bet = LOCK_AND_ROLL_BETS[0];
    const rounds = Math.max(2_000_000, roundsForTolerance(bet.standardDeviation, TOLERANCE, Z));
    expect(rounds).toBe(5_144_842);

    const left = new Float64Array(7);
    const kinds = ['fixed', 'counter'] as const;
    const favourable = { fixed: 0, counter: 0 };
    const gained = { fixed: 0, counter: 0 };
    const overall = { fixed: 0, counter: 0 };
    let shuffles = 0;
    let rerolls = 0;
    const shoe = createLockAndRollShoe();
    const report = simulate(createLockAndRoll({ source: shoe }), {
      rounds,
      rng: createSeededRng(SEED),
      bets: { 'lock-and-roll': 100 },
      strategy: lockAndRollStrategy(),
      observe(round) {
        let counted = false;
        for (const event of round.events) {
          if (event.type === 'shoe-shuffled') {
            shuffles++;
            left.fill(4 * decks);
          } else if (event.type === 'die-rerolled') {
            rerolls++;
          } else if (event.type === 'card-dealt') {
            if (!counted) {
              const expected = expectation(left);
              for (const kind of kinds) {
                overall[kind] += expected[kind];
                if (expected[kind] > 0) {
                  favourable[kind]++;
                  gained[kind] += expected[kind];
                }
              }
            }
            counted = true;
            left[event.card.rank]!--;
          }
        }
      },
    });

    const measured = report.bets['lock-and-roll']!;
    const exact = LOCK_AND_ROLL_SIX_DECK.rtp.toNumber();
    expect(exact).toBe(bet.finiteShoe.rtp);
    const lines = [
      `Lock & Roll on the six-deck shoe, ${rounds.toLocaleString('en-US')} rounds (seed ${SEED}), ` +
        `${shuffles.toLocaleString('en-US')} shuffles`,
      'RTP        declared  six decks  simulated   difference  standard error',
      `Lock & Roll${pct(bet.rtp)}  ${pct(exact)}  ${pct(measured.rtp)}   ` +
        `${pp(measured.rtp - exact)}  ${(measured.standardError * 100).toFixed(3)} pp`,
    ];
    // Against the exact six-deck figure, to ±0.15 pp and 3.29 standard errors.
    expect(Math.abs(measured.rtp - exact)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(measured.rtp - exact)).toBeLessThanOrEqual(Z * measured.standardError);
    const win = LOCK_AND_ROLL_SIX_DECK.hitFrequency.toNumber();
    expect(Math.abs(measured.hitFrequency - win)).toBeLessThanOrEqual(
      Z * Math.sqrt((win * (1 - win)) / rounds),
    );
    // 54 rounds a shoe: the cut card comes out after 108 of the 144 cards.
    expect(shuffles).toBe(Math.ceil(rounds / 54));
    // The strategy does not look at the cards: it re-rolls as often as on any shoe.
    const reroll = LOCK_AND_ROLL_SIX_DECK.rerollFrequency.toNumber();
    expect(Math.abs(rerolls / rounds - reroll)).toBeLessThanOrEqual(
      Z * Math.sqrt((reroll * (1 - reroll)) / rounds),
    );

    lines.push(
      'Card counting: rounds in which a perfect counter has the edge, the edge then, and the bet ' +
        'spread at which the counter breaks even (one unit in the other rounds)',
    );
    const labels = { fixed: 'The reference strategy', counter: 'Deciding with the count' };
    const counting: Record<string, object> = {};
    for (const kind of kinds) {
      const share = favourable[kind] / rounds;
      const edge = favourable[kind] === 0 ? 0 : gained[kind] / favourable[kind];
      const lost = gained[kind] - overall[kind];
      const spread =
        gained[kind] <= 0
          ? '—'
          : lost <= 0
            ? 'none needed'
            : `1 to ${(lost / gained[kind]).toFixed(1)}`;
      lines.push(
        `  ${labels[kind].padEnd(24)} ${pct(share, 2)} of rounds, edge ${pct(edge, 1)} in them, ` +
          `break-even spread ${spread}; ${pct(overall[kind] / rounds + 1, 3)} RTP at one unit`,
      );
      counting[kind] = {
        favourable: share,
        edgeWhenFavourable: edge,
        breakEvenSpread: gained[kind] <= 0 ? null : lost / gained[kind],
        flatRtp: overall[kind] / rounds + 1,
      };
    }
    // Deciding with the count can only help, and the fixed strategy averages the exact figure.
    expect(overall.counter).toBeGreaterThanOrEqual(overall.fixed);
    expect(Math.abs(overall.fixed / rounds + 1 - exact)).toBeLessThan(0.0005);
    process.stdout.write(`${lines.join('\n')}\n`);
    await recordFigures('six-deck-shoe', {
      simulation: simulationRecord({
        rounds,
        seed: SEED,
        source: describeShoe(shoe),
        stakes: { 'lock-and-roll': 100 },
        strategy: 'reference',
        z: Z,
        tolerance: TOLERANCE,
      }),
      statistics: measured,
      shuffles,
      rerolls,
      rtp: {
        declared: bet.rtp,
        ...verification(
          exact,
          measured.rtp,
          measured.standardError,
          Math.min(TOLERANCE, Z * measured.standardError),
        ),
      },
      hitFrequency: verification(
        win,
        measured.hitFrequency,
        Math.sqrt((win * (1 - win)) / rounds),
        Z * Math.sqrt((win * (1 - win)) / rounds),
      ),
      counting,
    });
  });
});
