/**
 * The removal effect, exactly: the first round after a shuffle, dealt from a
 * full six-deck shoe (24 cards of each value) without replacement. Only this
 * round's cards matter, so a recursion over the values drawn so far gives
 * exact fractions. Pairs of equal cards become rarer than in an infinite
 * shoe (23/239 instead of 1/10 for the second of a pair), which makes the
 * even targets, reached by pairs more often, a little harder to hit.
 *
 * Over a whole shoe the rounds interact (the cut card, the cards earlier
 * rounds took), and the long-run shift differs: moving-target.math.test.ts
 * measures it. The game sheet reports both.
 */
import { describe, expect, it } from 'vitest';
import { DIE_FACES } from '../../dice/dice.ts';
import type { Odds } from '../../game/money.ts';
import { Fraction } from '../../math/fraction.ts';
import { MOVING_TARGET_BETS } from './bets.ts';
import { movingTargetMathSummary } from './game.ts';
import {
  EXACT_HIT_ODDS,
  FIRST_CARD_ODDS,
  TARGETS,
  THREE_PLUS_MIN_CARDS,
  THREE_PLUS_CARDS_ODDS,
  targetOf,
  type Target,
} from './rules.ts';

const PER_VALUE = 24;
const SHOE_SIZE = 240;

interface Chances {
  /** The total lands exactly on the target. */
  readonly hit: Fraction;
  /** The first card alone is the target. */
  readonly first: Fraction;
  /** Three cards or more were needed. */
  readonly three: Fraction;
}

/** Exact chances for a deal towards `target` from a freshly shuffled six-deck shoe. */
function freshShoe(target: Target): Chances {
  const drawn = Array.from({ length: 11 }, () => 0);
  const memo = new Map<string, Chances>();
  const from = (total: number, cards: number): Chances => {
    if (total >= target) {
      const hit = total === target ? Fraction.ONE : Fraction.ZERO;
      return {
        hit,
        first: cards === 1 ? hit : Fraction.ZERO,
        three: cards >= THREE_PLUS_MIN_CARDS ? Fraction.ONE : Fraction.ZERO,
      };
    }
    // The values drawn so far fix the total, the card count and the shoe left.
    const key = drawn.join(',');
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let hit = Fraction.ZERO;
    let first = Fraction.ZERO;
    let three = Fraction.ZERO;
    for (let value = 1; value <= 10; value++) {
      const chance = Fraction.of(PER_VALUE - drawn[value]!, SHOE_SIZE - cards);
      drawn[value]!++;
      const next = from(total + value, cards + 1);
      drawn[value]!--;
      hit = hit.add(chance.mul(next.hit));
      first = first.add(chance.mul(next.first));
      three = three.add(chance.mul(next.three));
    }
    const chances = { hit, first, three };
    memo.set(key, chances);
    return chances;
  };
  return from(0, 0);
}

const rolls = (target: Target) =>
  DIE_FACES.flatMap((a) => DIE_FACES.map((b) => targetOf([a, b]))).filter((t) => t === target)
    .length;

const BY_TARGET = TARGETS.map((target) => ({
  target,
  roll: Fraction.of(rolls(target), 36),
  ...freshShoe(target),
}));

const pays = (odds: Odds) => Fraction.of(odds.to + odds.per, odds.per);
const rtp = (line: (row: (typeof BY_TARGET)[number]) => Fraction) =>
  BY_TARGET.reduce((sum, row) => sum.add(row.roll.mul(line(row))), Fraction.ZERO);

/** Shift from the declared (infinite-shoe) RTP in percentage points: "−0.13 pp". */
const shift = (fresh: Fraction, declared: number) => {
  const points = (fresh.toNumber() - declared) * 100;
  const text = Math.abs(points).toFixed(2);
  return `${points < 0 && Number(text) !== 0 ? '−' : '+'}${text} pp`;
};

describe('Moving Target — the first round of a fresh six-deck shoe, exactly', () => {
  const declared = Object.fromEntries(MOVING_TARGET_BETS.map((bet) => [bet.id, bet.rtp]));

  it('lowers Exact Hit by 0.13 pp and 3+ Cards by 0.20 pp, and leaves First Card alone', () => {
    const exactHit = rtp((row) => row.hit.mul(pays(EXACT_HIT_ODDS[row.target])));
    const firstCard = rtp((row) => row.first.mul(pays(FIRST_CARD_ODDS)));
    const threePlus = rtp((row) => row.three.mul(pays(THREE_PLUS_CARDS_ODDS)));
    expect([
      shift(exactHit, declared['exact-hit']!),
      `${(exactHit.toNumber() * 100).toFixed(2)}%`,
    ]).toEqual(['−0.13 pp', '96.02%']);
    // The first card of a full shoe is uniform: exactly the declared 11/12.
    expect(firstCard.toString()).toBe('11/12');
    expect([
      shift(threePlus, declared['three-plus-cards']!),
      `${(threePlus.toNumber() * 100).toFixed(2)}%`,
    ]).toEqual(['−0.20 pp', '89.38%']);
  });

  it('makes the even targets harder to hit, the odd ones barely', () => {
    const rows = movingTargetMathSummary().bets[0]!.breakdown!.rows;
    const edges = BY_TARGET.map(({ target, hit }, index) => {
      const fresh = Fraction.ONE.sub(hit.mul(pays(EXACT_HIT_ODDS[target])));
      const points = (fresh.toNumber() - rows[index]!.houseEdge) * 100;
      return `${target}: ${(fresh.toNumber() * 100).toFixed(2)}% (${points >= 0 ? '+' : '−'}${Math.abs(points).toFixed(2)})`;
    });
    expect(edges).toEqual([
      '2: 6.82% (+0.32)',
      '3: 3.22% (+0.02)',
      '4: 7.11% (+0.28)',
      '5: 4.87% (+0.03)',
      '6: 3.62% (+0.25)',
      '7: 2.60% (+0.03)',
      '8: 2.78% (+0.21)',
      '9: 3.56% (+0.02)',
      '10: 5.84% (+0.16)',
      '11: 4.38% (+0.01)',
      '12: 1.06% (+0.24)',
    ]);
  });
});
