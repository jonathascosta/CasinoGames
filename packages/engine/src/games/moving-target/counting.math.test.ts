/**
 * Card counting on Moving Target's six-deck shoe (run with `pnpm test:math`).
 *
 * The cards are dealt face up, so a player who tracks them knows what is
 * left in the shoe before every round. This seeded run of the production
 * game, with its cut card and reshuffles, computes each bet's exact
 * expectation for that composition, round by round, and measures how often
 * it favours the player, by how much, and the bet spread a perfect counter
 * needs to break even (one unit in the other rounds): the same measure the
 * Dice Spread, Mirror and Lock & Roll suites report.
 *
 * With c_v cards of each value v left out of N, the first k cards dealt are
 * a uniform k-subset of the shoe, so they hold the values of a multiset D of
 * k values with chance Π C(c_v, D_v) ÷ C(N, k). The total lands exactly on
 * the target T when some first k cards add up to T, and those events are
 * disjoint (the total only grows): the chance of a hit is that sum over the
 * multisets D of values from 1 to 10 adding up to T. The test checks this
 * against a direct recursion over the cards dealt, on the full shoe and on
 * depleted ones.
 */
import { describe, expect, it } from 'vitest';
import { DIE_FACES } from '../../dice/dice.ts';
import { oddsMultiplier } from '../../game/money.ts';
import { simulate } from '../../math/simulate.ts';
import { createSeededRng } from '../../rng/seeded.ts';
import { describeShoe, recordFigures, simulationRecord } from '../../testing/record.ts';
import { MOVING_TARGET_BETS } from './bets.ts';
import { createMovingTarget, createMovingTargetShoe } from './game.ts';
import {
  EXACT_HIT_ODDS,
  FIRST_CARD_ODDS,
  MAX_CARD_VALUE,
  TARGETS,
  THREE_PLUS_CARDS_ODDS,
  THREE_PLUS_MIN_CARDS,
  targetOf,
  type Target,
} from './rules.ts';

const SEED = 'moving-target/counting';
const ROUNDS = 5_000_000;
const MAX_TARGET = Math.max(...TARGETS);

/** Chance of each target: its rolls out of 36. */
const TARGET_CHANCE = new Float64Array(MAX_TARGET + 1);
for (const a of DIE_FACES) for (const b of DIE_FACES) TARGET_CHANCE[targetOf([a, b])]! += 1 / 36;

/** Every multiset of card values adding up to each target, as counts per value. */
const PARTITIONS: readonly (readonly { counts: readonly [number, number][]; cards: number }[])[] =
  TARGETS.reduce<{ counts: [number, number][]; cards: number }[][]>((all, target) => {
    const found: { counts: [number, number][]; cards: number }[] = [];
    const walk = (left: number, largest: number, parts: number[]) => {
      if (left === 0) {
        const counts = new Map<number, number>();
        for (const part of parts) counts.set(part, (counts.get(part) ?? 0) + 1);
        found.push({ counts: [...counts], cards: parts.length });
        return;
      }
      for (let value = Math.min(largest, left, MAX_CARD_VALUE); value >= 1; value--) {
        walk(left - value, value, [...parts, value]);
      }
    };
    walk(target, MAX_CARD_VALUE, []);
    all[target] = found;
    return all;
  }, []);

/** Binomial coefficients C(n, k) as doubles, for n up to the shoe's size and k up to 12. */
function binomialTable(size: number): Float64Array[] {
  const rows: Float64Array[] = [];
  for (let n = 0; n <= size; n++) {
    const row = new Float64Array(MAX_TARGET + 1);
    row[0] = 1;
    for (let k = 1; k <= Math.min(n, MAX_TARGET); k++) {
      row[k] = rows[n - 1]![k - 1]! + (k < n ? rows[n - 1]![k]! : 0);
    }
    rows.push(row);
  }
  return rows;
}

/** Chance that the total lands exactly on each target, with `left[v]` cards of each value left. */
function hitChances(left: Float64Array, cards: number, choose: Float64Array[]): Float64Array {
  const hits = new Float64Array(MAX_TARGET + 1);
  for (const target of TARGETS) {
    let chance = 0;
    for (const { counts, cards: k } of PARTITIONS[target]!) {
      let ways = 1;
      for (const [value, count] of counts) ways *= choose[left[value]!]![count]!;
      chance += ways / choose[cards]![k]!;
    }
    hits[target] = chance;
  }
  return hits;
}

/** The same chances by a direct recursion over the cards dealt, for the check. */
function hitChancesByRecursion(left: Float64Array, target: Target): number {
  const counts = Float64Array.from(left);
  let cards = 0;
  for (let value = 1; value <= MAX_CARD_VALUE; value++) cards += counts[value]!;
  const from = (total: number, dealt: number): number => {
    if (total >= target) return total === target ? 1 : 0;
    let chance = 0;
    for (let value = 1; value <= MAX_CARD_VALUE; value++) {
      if (counts[value] === 0) continue;
      const p = counts[value]! / (cards - dealt);
      counts[value]!--;
      chance += p * from(total + value, dealt + 1);
      counts[value]!++;
    }
    return chance;
  };
  return from(0, 0);
}

const BETS = ['exact-hit', 'first-card', 'three-plus-cards'] as const;

/** Each bet's expected net per unit, for the round about to be dealt from `left`. */
function expectation(
  left: Float64Array,
  choose: Float64Array[],
): Record<(typeof BETS)[number], number> {
  let cards = 0;
  for (let value = 1; value <= MAX_CARD_VALUE; value++) cards += left[value]!;
  const hits = hitChances(left, cards, choose);
  // Two-card totals, for 3+ Cards: it wins when the first two cards stay below the target.
  const pairs = cards * (cards - 1);
  const twoCards = new Float64Array(2 * MAX_CARD_VALUE + 1);
  for (let a = 1; a <= MAX_CARD_VALUE; a++) {
    for (let b = 1; b <= MAX_CARD_VALUE; b++) {
      twoCards[a + b]! += (left[a]! * (left[b]! - (a === b ? 1 : 0))) / pairs;
    }
  }
  let exactHit = -1;
  let firstCard = -1;
  let threePlus = -1;
  for (const target of TARGETS) {
    const chance = TARGET_CHANCE[target]!;
    exactHit += chance * hits[target]! * oddsMultiplier(EXACT_HIT_ODDS[target]);
    if (target <= MAX_CARD_VALUE) {
      firstCard += (chance * left[target]! * oddsMultiplier(FIRST_CARD_ODDS)) / cards;
    }
    let below = 0;
    for (let total = 2; total < target; total++) below += twoCards[total]!;
    threePlus += chance * below * oddsMultiplier(THREE_PLUS_CARDS_ODDS);
  }
  return { 'exact-hit': exactHit, 'first-card': firstCard, 'three-plus-cards': threePlus };
}

describe('Moving Target — card counting on the six-deck shoe', () => {
  it('computes the hit chances of any composition exactly', () => {
    const shoe = createMovingTargetShoe();
    const choose = binomialTable(shoe.size());
    const perValue = shoe.size() / MAX_CARD_VALUE;
    const full = new Float64Array(MAX_CARD_VALUE + 1).fill(perValue);
    full[0] = 0;
    // Depleted shoes: low cards gone, high cards gone, one value nearly exhausted.
    const depleted = [
      Float64Array.from(full, (count, value) => (value <= 3 ? count - 12 : count)),
      Float64Array.from(full, (count, value) => (value >= 8 ? count - 15 : count)),
      Float64Array.from(full, (count, value) => (value === 4 ? 1 : value === 6 ? 3 : count)),
    ];
    for (const left of [full, ...depleted]) {
      let cards = 0;
      for (let value = 1; value <= MAX_CARD_VALUE; value++) cards += left[value]!;
      const hits = hitChances(left, cards, choose);
      for (const target of TARGETS) {
        expect(hits[target]).toBeCloseTo(hitChancesByRecursion(left, target), 13);
      }
    }
    // expectation() counts 3+ Cards as the first two cards staying below the target.
    expect(THREE_PLUS_MIN_CARDS).toBe(3);
  });

  it('measures how often the cards left favour each bet, and the spread a counter needs', async () => {
    const shoe = createMovingTargetShoe();
    const choose = binomialTable(shoe.size());
    const perValue = shoe.size() / MAX_CARD_VALUE;
    const left = new Float64Array(MAX_CARD_VALUE + 1);
    const tally = Object.fromEntries(
      BETS.map((bet) => [bet, { favourable: 0, gained: 0, overall: 0 }]),
    ) as Record<(typeof BETS)[number], { favourable: number; gained: number; overall: number }>;
    let shuffles = 0;
    const stakes = Object.fromEntries(MOVING_TARGET_BETS.map((bet) => [bet.id, bet.min]));
    const report = simulate(createMovingTarget({ source: shoe }), {
      rounds: ROUNDS,
      rng: createSeededRng(SEED),
      bets: stakes,
      observe(round) {
        let counted = false;
        for (const event of round.events) {
          if (event.type === 'shoe-shuffled') {
            shuffles++;
            left.fill(perValue);
            left[0] = 0;
          } else if (event.type === 'card-dealt') {
            if (!counted) {
              const expected = expectation(left, choose);
              for (const bet of BETS) {
                const value = expected[bet];
                tally[bet].overall += value;
                if (value > 0) {
                  tally[bet].favourable++;
                  tally[bet].gained += value;
                }
              }
              counted = true;
            }
            left[event.card.rank]!--;
          }
        }
      },
    });
    expect(report.rounds).toBe(ROUNDS);
    // A round deals 1 to 12 cards, and a shoe deals its cards down to the cut card.
    const dealt = shoe.cutCardPosition();
    expect(shuffles).toBeGreaterThan(ROUNDS / dealt);
    expect(shuffles).toBeLessThan(ROUNDS / (dealt / 12));

    const bets = Object.fromEntries(
      BETS.map((bet) => {
        const { favourable, gained, overall } = tally[bet];
        const lost = gained - overall;
        const measured = report.bets[bet]!;
        // A flat bettor's average expectation is the shoe's long-run return, which the
        // run also measures directly: the two agree within the run's own noise.
        expect(Math.abs(overall / ROUNDS + 1 - measured.rtp)).toBeLessThan(
          3.29 * measured.standardError,
        );
        return [
          bet,
          {
            favourable: favourable / ROUNDS,
            edgeWhenFavourable: favourable === 0 ? 0 : gained / favourable,
            breakEvenSpread: gained <= 0 ? null : lost / gained,
            flatRtp: overall / ROUNDS + 1,
            observedRtp: measured.rtp,
          },
        ];
      }),
    );
    await recordFigures('counting', {
      simulation: simulationRecord({
        rounds: ROUNDS,
        seed: SEED,
        source: describeShoe(shoe),
        stakes,
        z: 3.29,
      }),
      shuffles,
      bets,
    });
  });
});
