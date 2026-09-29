import { describe, expect, it } from 'vitest';
import {
  RANK_SETS,
  SUITS,
  cardCode,
  cardLabel,
  isRank,
  isRed,
  parseCardCode,
  rankLabel,
  rankRange,
  type Card,
} from './card.ts';

describe('card model', () => {
  it('builds rank ranges', () => {
    expect(rankRange(1, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(RANK_SETS.aceToSix).toHaveLength(6);
    expect(RANK_SETS.aceToTen).toHaveLength(10);
    expect(RANK_SETS.aceToKing).toHaveLength(13);
    expect(() => rankRange(5, 2)).toThrow(RangeError);
  });

  it('labels ranks and cards', () => {
    expect([1, 10, 11, 12, 13].map((rank) => rankLabel(rank as 1))).toEqual([
      'A',
      '10',
      'J',
      'Q',
      'K',
    ]);
    expect(cardLabel({ rank: 10, suit: 'hearts' })).toBe('10♥');
    expect(cardLabel({ rank: 1, suit: 'spades' })).toBe('A♠');
  });

  it('knows red suits', () => {
    expect(SUITS.filter(isRed)).toEqual(['hearts', 'diamonds']);
  });

  it('validates ranks', () => {
    expect(isRank(1) && isRank(13)).toBe(true);
    expect([0, 14, 2.5, '3'].some(isRank)).toBe(false);
  });

  it('round-trips every card through its two-character code', () => {
    const all: Card[] = SUITS.flatMap((suit) =>
      RANK_SETS.aceToKing.map((rank) => ({ rank, suit })),
    );
    const codes = all.map(cardCode);
    expect(new Set(codes).size).toBe(52);
    expect(codes.every((code) => code.length === 2)).toBe(true);
    expect(codes.map(parseCardCode)).toEqual(all);
    expect(cardCode({ rank: 10, suit: 'clubs' })).toBe('TC');
  });

  it.each(['', 'A', '1S', 'AX', 'ASS', 'as'])('rejects the malformed code %j', (code) => {
    expect(() => parseCardCode(code)).toThrow(SyntaxError);
  });
});
