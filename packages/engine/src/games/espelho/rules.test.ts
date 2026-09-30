import { describe, expect, it } from 'vitest';
import {
  ESPELHO_BET_IDS,
  compareHands,
  espelhoOutlook,
  readHand,
  resolveEspelhoBet,
  type EspelhoBetId,
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

describe('resolveEspelhoBet', () => {
  const wins = (bet: EspelhoBetId, dice: HandValues, cards: HandValues) =>
    resolveEspelhoBet(bet, dice, cards).outcome === 'win';

  it('pays Espelho only when the dice outrank the cards: a tie loses', () => {
    expect(resolveEspelhoBet('espelho', [2, 2], [6, 5])).toEqual({
      outcome: 'win',
      odds: { to: 1, per: 1 },
      entryId: 'higher',
      meter: false,
    });
    expect(wins('espelho', [3, 5], [5, 3])).toBe(false);
    expect(wins('espelho', [3, 5], [4, 5])).toBe(false);
  });

  it('settles every side bet on its own condition', () => {
    expect(wins('empate', [3, 5], [5, 3])).toBe(true);
    expect(wins('empate', [2, 6], [3, 5])).toBe(false); // same sum and high card differ
    expect(wins('somas-iguais', [2, 6], [3, 5])).toBe(true);
    expect(wins('somas-iguais', [4, 4], [2, 6])).toBe(true);
    expect(wins('par-vs-par', [2, 2], [5, 5])).toBe(true);
    expect(wins('par-vs-par', [2, 2], [5, 4])).toBe(false);
    expect(wins('espelho-perfeito', [5, 5], [5, 5])).toBe(true);
    expect(wins('espelho-perfeito', [2, 2], [5, 5])).toBe(false);
    expect(wins('seis-seis', [6, 6], [6, 6])).toBe(true);
    expect(wins('seis-seis', [5, 5], [5, 5])).toBe(false);
    expect(resolveEspelhoBet('seis-seis', [6, 6], [6, 6])).toMatchObject({
      odds: { to: 1000, per: 1 },
      entryId: 'six-six',
      meter: true,
    });
  });

  it('counts the winning hands of each bet exactly', () => {
    const count = (bet: EspelhoBetId) =>
      HANDS.reduce((sum, dice) => sum + HANDS.filter((cards) => wins(bet, dice, cards)).length, 0);
    // Out of 36 × 36 ordered hands; see espelho.test.ts for the probabilities.
    expect(ESPELHO_BET_IDS.map((bet) => [bet, count(bet)])).toEqual([
      ['espelho', 615],
      ['empate', 66],
      ['somas-iguais', 146],
      ['par-vs-par', 36],
      ['espelho-perfeito', 6],
      ['seis-seis', 1],
    ]);
  });
});

describe('espelhoOutlook', () => {
  it('knows a bet is lost or won as soon as the dice or the first card decide it', () => {
    expect(espelhoOutlook('par-vs-par', [2, 3], [])).toBe('lost');
    expect(espelhoOutlook('seis-seis', [6, 6], [])).toBe('live');
    expect(espelhoOutlook('seis-seis', [6, 6], [5])).toBe('lost');
    expect(espelhoOutlook('espelho', [6, 6], [5])).toBe('won'); // no card can make 6-6 now
    expect(espelhoOutlook('espelho', [1, 2], [])).toBe('lost'); // the weakest hand cannot win
    expect(espelhoOutlook('somas-iguais', [1, 1], [3])).toBe('lost'); // sum 2 is out of reach
    expect(espelhoOutlook('empate', [3, 5], [5, 3])).toBe('won');
  });

  it('matches brute force over every card that could still come', () => {
    for (const bet of ESPELHO_BET_IDS) {
      for (const dice of HANDS) {
        for (const prefix of [[], ...VALUES.map((value) => [value])]) {
          const completions =
            prefix.length === 0 ? HANDS : VALUES.map((value) => [prefix[0]!, value] as const);
          const results = completions.map((cards) => resolveEspelhoBet(bet, dice, cards).outcome);
          const expected = results.every((r) => r === 'win')
            ? 'won'
            : results.every((r) => r === 'lose')
              ? 'lost'
              : 'live';
          expect(espelhoOutlook(bet, dice, prefix)).toBe(expected);
        }
      }
    }
  });
});
