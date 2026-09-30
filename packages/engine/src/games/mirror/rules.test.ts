import { describe, expect, it } from 'vitest';
import {
  MIRROR_BET_IDS,
  compareHands,
  mirrorOutlook,
  readHand,
  resolveMirrorBet,
  type MirrorBetId,
  type HandValues,
} from './rules.ts';

const VALUES = [1, 2, 3, 4, 5, 6] as const;
const HANDS: HandValues[] = VALUES.flatMap((a) => VALUES.map((b) => [a, b] as const));

/**
 * The ranking written straight from the rules, independently of readHand:
 * pair beats non-pair, higher pair beats lower pair; among non-pairs the
 * higher sum wins, then the higher single value; otherwise a tie.
 */
function spec([a, b]: HandValues, [c, d]: HandValues): 1 | 0 | -1 {
  const sign = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);
  const pairs = [a === b, c === d];
  if (pairs[0] !== pairs[1]) return pairs[0] ? 1 : -1;
  if (pairs[0]) return sign(a - c);
  return sign(a + b - (c + d)) || sign(Math.max(a, b) - Math.max(c, d));
}

describe('readHand', () => {
  it('labels a pair and a non-pair the same way for dice and cards', () => {
    expect(readHand([4, 4])).toMatchObject({
      pair: true,
      high: 4,
      low: 4,
      sum: 8,
      label: 'PAIR 4s',
    });
    expect(readHand([3, 6])).toMatchObject({
      pair: false,
      high: 6,
      low: 3,
      sum: 9,
      label: 'SUM 9 HIGH 6',
    });
    expect(readHand([6, 3]).label).toBe('SUM 9 HIGH 6');
    expect(readHand([1, 1]).label).toBe('PAIR 1s');
  });

  it('refuses values outside 1 to 6', () => {
    expect(() => readHand([0, 3])).toThrow(RangeError);
    expect(() => readHand([7, 3])).toThrow(RangeError);
    expect(() => readHand([2.5, 3])).toThrow(RangeError);
  });
});

describe('compareHands', () => {
  it('ranks pairs over non-pairs, then by value; non-pairs by sum, then by the higher value', () => {
    expect(compareHands([1, 1], [6, 5])).toBe(1); // the lowest pair beats the best non-pair
    expect(compareHands([4, 4], [5, 5])).toBe(-1);
    expect(compareHands([3, 6], [4, 4])).toBe(-1);
    expect(compareHands([3, 6], [4, 5])).toBe(1); // sum 9 each: high 6 beats high 5
    expect(compareHands([2, 6], [3, 4])).toBe(1); // sum 8 beats sum 7
    expect(compareHands([6, 3], [3, 6])).toBe(0);
    expect(compareHands([5, 5], [5, 5])).toBe(0);
  });

  it('agrees with the rules as written for all 1,296 pairs of hands', () => {
    for (const dice of HANDS) {
      for (const cards of HANDS)
        expect(compareHands(dice, cards), `${dice.join('-')} v ${cards.join('-')}`).toBe(
          spec(dice, cards),
        );
    }
  });

  it('ties only identical hands, in either order', () => {
    for (const dice of HANDS) {
      for (const cards of HANDS) {
        const same =
          Math.min(...dice) === Math.min(...cards) && Math.max(...dice) === Math.max(...cards);
        expect(compareHands(dice, cards) === 0).toBe(same);
      }
    }
  });
});

describe('resolveMirrorBet', () => {
  const wins = (bet: MirrorBetId, dice: HandValues, cards: HandValues) =>
    resolveMirrorBet(bet, dice, cards).outcome === 'win';

  it('pays Mirror only when the dice outrank the cards: a tie loses', () => {
    expect(resolveMirrorBet('mirror', [2, 2], [6, 5])).toEqual({
      outcome: 'win',
      odds: { to: 1, per: 1 },
      entryId: 'higher',
      meter: false,
    });
    expect(wins('mirror', [3, 5], [5, 3])).toBe(false);
    expect(wins('mirror', [3, 5], [4, 5])).toBe(false);
  });

  it('settles every side bet on its own condition', () => {
    expect(wins('tie', [3, 5], [5, 3])).toBe(true);
    expect(wins('tie', [2, 6], [3, 5])).toBe(false); // same sum and high card differ
    expect(wins('equal-sums', [2, 6], [3, 5])).toBe(true);
    expect(wins('equal-sums', [4, 4], [2, 6])).toBe(true);
    expect(wins('pair-vs-pair', [2, 2], [5, 5])).toBe(true);
    expect(wins('pair-vs-pair', [2, 2], [5, 4])).toBe(false);
    expect(wins('perfect-mirror', [5, 5], [5, 5])).toBe(true);
    expect(wins('perfect-mirror', [2, 2], [5, 5])).toBe(false);
    expect(wins('double-sixes', [6, 6], [6, 6])).toBe(true);
    expect(wins('double-sixes', [5, 5], [5, 5])).toBe(false);
    expect(resolveMirrorBet('double-sixes', [6, 6], [6, 6])).toMatchObject({
      odds: { to: 1000, per: 1 },
      entryId: 'six-six',
      meter: true,
    });
  });

  it('counts the winning hands of each bet exactly', () => {
    const count = (bet: MirrorBetId) =>
      HANDS.reduce((sum, dice) => sum + HANDS.filter((cards) => wins(bet, dice, cards)).length, 0);
    // Out of 36 × 36 ordered hands; see mirror.test.ts for the probabilities.
    expect(MIRROR_BET_IDS.map((bet) => [bet, count(bet)])).toEqual([
      ['mirror', 615],
      ['tie', 66],
      ['equal-sums', 146],
      ['pair-vs-pair', 36],
      ['perfect-mirror', 6],
      ['double-sixes', 1],
    ]);
  });
});

describe('mirrorOutlook', () => {
  it('knows a bet is lost or won as soon as the dice or the first card decide it', () => {
    expect(mirrorOutlook('pair-vs-pair', [2, 3], [])).toBe('lost');
    expect(mirrorOutlook('double-sixes', [6, 6], [])).toBe('live');
    expect(mirrorOutlook('double-sixes', [6, 6], [5])).toBe('lost');
    expect(mirrorOutlook('mirror', [6, 6], [5])).toBe('won'); // no card can make 6-6 now
    expect(mirrorOutlook('mirror', [1, 2], [])).toBe('lost'); // the weakest hand cannot win
    expect(mirrorOutlook('equal-sums', [1, 1], [3])).toBe('lost'); // sum 2 is out of reach
    expect(mirrorOutlook('tie', [3, 5], [5, 3])).toBe('won');
  });

  it('matches brute force over every card that could still come', () => {
    for (const bet of MIRROR_BET_IDS) {
      for (const dice of HANDS) {
        for (const prefix of [[], ...VALUES.map((value) => [value])]) {
          const completions =
            prefix.length === 0 ? HANDS : VALUES.map((value) => [prefix[0]!, value] as const);
          const results = completions.map((cards) => resolveMirrorBet(bet, dice, cards).outcome);
          const expected = results.every((r) => r === 'win')
            ? 'won'
            : results.every((r) => r === 'lose')
              ? 'lost'
              : 'live';
          expect(mirrorOutlook(bet, dice, prefix)).toBe(expected);
        }
      }
    }
  });
});
