/**
 * Exact math of Moving Target, with every card value from 1 to 10 equally likely
 * (an infinite shoe). Three independent routes must agree:
 *  1. a memoised recursion over the dealer's running total, written here
 *     from the rules alone, whose figures must reproduce the published table;
 *  2. the closed forms declared in bets.ts;
 *  3. the real game, run over every roll and every card sequence.
 * The Monte Carlo suite (moving-target.math.test.ts) plays the real six-deck shoe.
 */
import { describe, expect, it } from 'vitest';
import { RANK_SETS } from '../../cards/card.ts';
import { DIE_FACES } from '../../dice/dice.ts';
import type { Odds } from '../../game/money.ts';
import type { PaytableEntry } from '../../game/types.ts';
import { exactReturns } from '../../math/exact.ts';
import { Fraction } from '../../math/fraction.ts';
import { createUniformRankSource } from '../../testing/uniform-ranks.ts';
import { MOVING_TARGET_BETS } from './bets.ts';
import { movingTargetMathSummary, createMovingTarget } from './game.ts';
import {
  EXACT_HIT_ODDS,
  FIRST_CARD_ODDS,
  TARGETS,
  THREE_PLUS_MIN_CARDS,
  THREE_PLUS_CARDS_ODDS,
  targetOf,
  type MovingTargetBetId,
  type Target,
} from './rules.ts';

const CARD_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TENTH = Fraction.of(1, 10);

/**
 * The chance that a deal towards `target` stops in a state where `stops`
 * holds, dealing from a running total and a card count: every card value
 * with chance 1/10, until the total reaches the target. Memoised on (total,
 * cards), so each target takes a few hundred steps.
 */
function dealChance(target: Target, stops: (total: number, cards: number) => boolean): Fraction {
  const memo = new Map<string, Fraction>();
  const from = (total: number, cards: number): Fraction => {
    if (total >= target) return stops(total, cards) ? Fraction.ONE : Fraction.ZERO;
    const key = `${total}/${cards}`;
    let chance = memo.get(key);
    if (chance === undefined) {
      chance = Fraction.ZERO;
      for (const value of CARD_VALUES) chance = chance.add(from(total + value, cards + 1));
      chance = chance.mul(TENTH);
      memo.set(key, chance);
    }
    return chance;
  };
  return from(0, 0);
}

/** How many card sequences a deal towards `target` can take (memoised the same way). */
function dealCount(target: Target): number {
  const memo = new Map<number, number>();
  const from = (total: number): number => {
    if (total >= target) return 1;
    let count = memo.get(total);
    if (count === undefined) {
      count = CARD_VALUES.reduce((sum, value) => sum + from(total + value), 0);
      memo.set(total, count);
    }
    return count;
  };
  return from(0);
}

/** The 36 rolls, grouped by target. */
const ROLLS = new Map<Target, number>();
for (const a of DIE_FACES) {
  for (const b of DIE_FACES) ROLLS.set(targetOf([a, b]), (ROLLS.get(targetOf([a, b])) ?? 0) + 1);
}

const BY_TARGET = TARGETS.map((target) => ({
  target,
  roll: Fraction.of(ROLLS.get(target)!, 36),
  /** The total lands exactly on the target. */
  hit: dealChance(target, (total) => total === target),
  /** The first card alone is the target. */
  first: dealChance(target, (total, cards) => total === target && cards === 1),
  /** Three cards or more were needed. */
  three: dealChance(target, (_, cards) => cards >= THREE_PLUS_MIN_CARDS),
}));

const multiplier = ({ to, per }: Odds) => Fraction.of(to + per, per);

interface BetFigures {
  /** Per round: the chance of each winning paytable line. */
  readonly lines: Readonly<Record<string, Fraction>>;
  readonly hit: Fraction;
  readonly rtp: Fraction;
  /** σ² of the net result per unit staked. */
  readonly variance: Fraction;
}

/** A bet's figures from its winning lines: chance and return per unit staked. */
function figures(lines: readonly { id: string; chance: Fraction; pays: Fraction }[]): BetFigures {
  let hit = Fraction.ZERO;
  let rtp = Fraction.ZERO;
  let square = Fraction.ZERO;
  const byLine: Record<string, Fraction> = {};
  for (const { id, chance, pays } of lines) {
    byLine[id] = (byLine[id] ?? Fraction.ZERO).add(chance);
    hit = hit.add(chance);
    rtp = rtp.add(chance.mul(pays));
    square = square.add(chance.mul(pays).mul(pays));
  }
  return { lines: byLine, hit, rtp, variance: square.sub(rtp.mul(rtp)) };
}

const RECURSION: Readonly<Record<MovingTargetBetId, BetFigures>> = {
  'exact-hit': figures(
    BY_TARGET.map(({ target, roll, hit }) => ({
      id: `target-${target}`,
      chance: roll.mul(hit),
      pays: multiplier(EXACT_HIT_ODDS[target]),
    })),
  ),
  'first-card': figures(
    BY_TARGET.map(({ roll, first }) => ({
      id: 'first-card',
      chance: roll.mul(first),
      pays: multiplier(FIRST_CARD_ODDS),
    })),
  ),
  'three-plus-cards': figures(
    BY_TARGET.map(({ roll, three }) => ({
      id: 'three-or-more',
      chance: roll.mul(three),
      pays: multiplier(THREE_PLUS_CARDS_ODDS),
    })),
  ),
};

const pct = (value: Fraction, digits = 2) => `${(value.toNumber() * 100).toFixed(digits)}%`;
const edge = (rtp: Fraction) => Fraction.ONE.sub(rtp);

describe('Moving Target — exact math', () => {
  describe('the memoised recursion reproduces the published table', () => {
    it('hits each target with the published chance', () => {
      expect(Object.fromEntries(BY_TARGET.map(({ target, hit }) => [target, pct(hit)]))).toEqual({
        2: '11.00%',
        3: '12.10%',
        4: '13.31%',
        5: '14.64%',
        6: '16.11%',
        7: '17.72%',
        8: '19.49%',
        9: '21.44%',
        10: '23.58%',
        11: '15.94%',
        12: '16.53%',
      });
    });

    it('gives Exact Hit the published house edge per target, and 3.85% over the dice', () => {
      const perTarget = BY_TARGET.map(({ target, hit }) =>
        pct(edge(hit.mul(multiplier(EXACT_HIT_ODDS[target]))), 1),
      );
      expect(perTarget).toEqual([
        '6.5%',
        '3.2%',
        '6.8%',
        '4.8%',
        '3.4%',
        '2.6%',
        '2.6%',
        '3.5%',
        '5.7%',
        '4.4%',
        '0.8%',
      ]);
      expect(pct(edge(RECURSION['exact-hit'].rtp))).toBe('3.85%');
    });

    it('gives the side bets their published chances and house edges', () => {
      const firstCard = RECURSION['first-card'];
      const threePlus = RECURSION['three-plus-cards'];
      expect([pct(firstCard.hit), pct(edge(firstCard.rtp))]).toEqual(['9.17%', '8.33%']);
      expect([pct(threePlus.hit), pct(edge(threePlus.rtp), 1)]).toEqual(['17.92%', '10.4%']);
      // Exactly: 11/120 at 9 to 1, and 43/240 at 4 to 1.
      expect([firstCard.hit.toString(), firstCard.rtp.toString()]).toEqual(['11/120', '11/12']);
      expect([threePlus.hit.toString(), threePlus.rtp.toString()]).toEqual(['43/240', '43/48']);
    });
  });

  describe.each(MOVING_TARGET_BETS.map((bet) => [bet.id, bet] as const))(
    '%s: the declared figures equal the recursion',
    (id, bet) => {
      const exact = RECURSION[id];

      it('RTP and volatility index', () => {
        expect(bet.rtp).toBe(exact.rtp.toNumber());
        expect(bet.standardDeviation).toBeCloseTo(Math.sqrt(exact.variance.toNumber()), 12);
      });

      it('every paytable line, with the chance of its target', () => {
        expect(
          Object.fromEntries(bet.paytable.map((entry) => [entry.id, entry.probability])),
        ).toEqual(
          Object.fromEntries(
            Object.entries(exact.lines).map(([line, chance]) => [line, chance.toNumber()]),
          ),
        );
        const lines: readonly PaytableEntry[] = bet.paytable;
        for (const { given } of lines) {
          if (given === undefined) continue;
          const row = BY_TARGET.find(({ target }) => String(target) === given.value);
          expect(given.probability).toBe(row?.roll.toNumber());
        }
      });
    },
  );

  it("breaks Exact Hit down by target with the recursion's hit chances", () => {
    const rows = movingTargetMathSummary().bets[0]!.breakdown!.rows;
    for (const [index, { target, hit }] of BY_TARGET.entries()) {
      const row = rows[index]!;
      expect(row.value).toBe(String(target));
      expect(row.hitFrequency).toBeCloseTo(hit.toNumber(), 14);
      expect(row.houseEdge).toBeCloseTo(
        edge(hit.mul(multiplier(EXACT_HIT_ODDS[target]))).toNumber(),
        14,
      );
    }
  });

  describe('the real game over every roll and card sequence', () => {
    const report = exactReturns(
      () => createMovingTarget({ source: createUniformRankSource(RANK_SETS.aceToTen) }),
      { 'exact-hit': 100, 'first-card': 100, 'three-plus-cards': 100 },
    );

    it('enumerates the 36 rolls and every card sequence each can deal: 71,469 outcomes', () => {
      const sequences = TARGETS.reduce(
        (sum, target) => sum + ROLLS.get(target)! * dealCount(target),
        0,
      );
      expect(report.outcomes).toBe(sequences);
      expect(sequences).toBe(71_469);
    });

    it.each(MOVING_TARGET_BETS.map((bet) => bet.id))(
      '%s: RTP, hit frequency, lines and variance equal the recursion exactly',
      (id) => {
        const game = report.bets[id]!;
        const exact = RECURSION[id];
        expect(game.rtp.toString()).toBe(exact.rtp.toString());
        expect(game.hitFrequency.equals(exact.hit)).toBe(true);
        expect(game.pushFrequency.equals(Fraction.ZERO)).toBe(true);
        expect(game.variance.equals(exact.variance)).toBe(true);
        expect(Object.keys(game.entries).sort()).toEqual(Object.keys(exact.lines).sort());
        for (const [line, chance] of Object.entries(exact.lines)) {
          expect(game.entries[line]?.equals(chance), line).toBe(true);
        }
      },
    );
  });
});
