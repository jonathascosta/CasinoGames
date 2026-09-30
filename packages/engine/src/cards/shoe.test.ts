import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../rng/seeded.ts';
import { chiSquareUniform } from '../testing/chi-square.ts';
import { RANK_SETS, cardCode, type Card, type Rank } from './card.ts';
import { DEFAULT_PENETRATION, Shoe, ShoeExhaustedError } from './shoe.ts';

function drawAll(shoe: Shoe, rng = createSeededRng('draw-all')): Card[] {
  shoe.beginRound(rng);
  const cards: Card[] = [];
  while (shoe.remaining() > 0) cards.push(shoe.draw(rng));
  return cards;
}

function countByCode(cards: readonly Card[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(cardCode(card), (counts.get(cardCode(card)) ?? 0) + 1);
  return counts;
}

describe('Shoe composition', () => {
  it.each([
    [1, RANK_SETS.aceToSix, 24],
    [2, RANK_SETS.aceToTen, 80],
    [6, RANK_SETS.aceToKing, 312],
    [8, RANK_SETS.aceToKing, 416],
  ] as const)('%i deck(s) of %j hold %i cards, every card N times', (decks, ranks, size) => {
    const shoe = new Shoe({ decks, ranks });
    expect(shoe.size()).toBe(size);
    const counts = countByCode(drawAll(shoe));
    expect(counts.size).toBe(ranks.length * 4);
    expect([...counts.values()].every((count) => count === decks)).toBe(true);
  });

  it('defaults to A–K and 75% penetration', () => {
    const shoe = new Shoe({ decks: 1 });
    expect(shoe.ranks).toEqual(RANK_SETS.aceToKing);
    expect(shoe.penetration).toBe(DEFAULT_PENETRATION);
  });

  it.each([
    [{ decks: 0 }],
    [{ decks: 1.5 }],
    [{ decks: -2 }],
    [{ decks: Number.NaN }],
    [{ decks: 1, ranks: [] }],
    [{ decks: 1, ranks: [1, 1] as Rank[] }],
    [{ decks: 1, ranks: [0] as unknown as Rank[] }],
    [{ decks: 1, penetration: 0 }],
    [{ decks: 1, penetration: 1.01 }],
  ])('rejects the invalid options %j', (options) => {
    expect(() => new Shoe(options)).toThrow(RangeError);
  });
});

describe('Shoe shuffling', () => {
  it('is deterministic for a given seed and differs across seeds', () => {
    const order = (seed: string) => drawAll(new Shoe({ decks: 2 }), createSeededRng(seed));
    expect(order('a')).toEqual(order('a'));
    expect(order('a')).not.toEqual(order('b'));
  });

  it('puts every card first equally often (chi-square over 52k shuffles)', () => {
    const rng = createSeededRng('first-card');
    const shoe = new Shoe({ decks: 1 });
    const counts = new Map<string, number>();
    for (let i = 0; i < 52_000; i++) {
      shoe.shuffle(rng);
      const code = cardCode(shoe.draw(rng));
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    expect(counts.size).toBe(52);
    expect(chiSquareUniform([...counts.values()]).pValue).toBeGreaterThan(0.001);
  });

  it('shuffles before the first round and counts shuffles', () => {
    const rng = createSeededRng('first-round');
    const shoe = new Shoe({ decks: 1 });
    expect(shoe.needsShuffle()).toBe(true);
    expect(shoe.shuffleCount()).toBe(0);
    expect(shoe.beginRound(rng)).toBe(true);
    expect(shoe.shuffleCount()).toBe(1);
    expect(shoe.beginRound(rng)).toBe(false);
  });

  it('shuffles lazily if a card is drawn before any round began', () => {
    const shoe = new Shoe({ decks: 1 });
    shoe.draw(createSeededRng('lazy'));
    expect(shoe.shuffleCount()).toBe(1);
    expect(shoe.remaining()).toBe(51);
  });
});

describe('Shoe cut card and penetration', () => {
  it('comes out once the penetration is dealt (52 cards × 75% = 39)', () => {
    const rng = createSeededRng('cut');
    const shoe = new Shoe({ decks: 1 });
    shoe.beginRound(rng);
    for (let i = 0; i < 38; i++) shoe.draw(rng);
    expect(shoe.isCutCardOut()).toBe(false);
    shoe.draw(rng);
    expect(shoe.isCutCardOut()).toBe(true);
    expect(shoe.remaining()).toBe(13);
  });

  it.each([
    [6, 0.75, 234],
    [6, 0.5, 156],
    [1, 1, 52],
  ])('with %i deck(s) at %d penetration, cuts after %i cards', (decks, penetration, cut) => {
    const rng = createSeededRng('cut-position');
    const shoe = new Shoe({ decks, penetration });
    // Where it sits is known before the shoe is shuffled.
    expect(shoe.cutCardPosition()).toBe(cut);
    shoe.beginRound(rng);
    let dealt = 0;
    while (!shoe.isCutCardOut()) {
      shoe.draw(rng);
      dealt++;
    }
    expect(dealt).toBe(cut);
  });

  it('never interrupts a round: it reshuffles at the start of the next one', () => {
    const rng = createSeededRng('auto-reshuffle');
    const shoe = new Shoe({ decks: 1 });
    shoe.beginRound(rng);
    for (let i = 0; i < 45; i++) shoe.draw(rng); // past the cut card, same round
    expect(shoe.shuffleCount()).toBe(1);
    expect(shoe.remaining()).toBe(7);

    expect(shoe.beginRound(rng)).toBe(true);
    expect(shoe.shuffleCount()).toBe(2);
    expect(shoe.remaining()).toBe(52);
    expect(shoe.isCutCardOut()).toBe(false);
  });

  it('keeps dealing rounds until the cut card comes out, then reshuffles', () => {
    const rng = createSeededRng('rounds');
    const shoe = new Shoe({ decks: 1, ranks: RANK_SETS.aceToSix }); // 24 cards, cut after 18
    const reshuffledAt: number[] = [];
    for (let round = 0; round < 12; round++) {
      if (shoe.beginRound(rng)) reshuffledAt.push(round);
      for (let i = 0; i < 5; i++) shoe.draw(rng);
    }
    // 5 cards per round: rounds 0–3 deal 20 cards (cut at 18) → reshuffle at 4, 8.
    expect(reshuffledAt).toEqual([0, 4, 8]);
  });
});

describe('Shoe exhaustion mid-round', () => {
  it('reshuffles only the discards, never the cards in play', () => {
    const rng = createSeededRng('emergency');
    const shoe = new Shoe({ decks: 1, ranks: RANK_SETS.aceToSix }); // 24 unique cards
    shoe.beginRound(rng);
    const firstRound = Array.from({ length: 10 }, () => shoe.draw(rng));
    shoe.beginRound(rng); // cut card (after 18) not out yet: no reshuffle
    const secondRound = Array.from({ length: 20 }, () => shoe.draw(rng));

    expect(shoe.shuffleCount()).toBe(2);
    // 14 cards emptied the shoe; the other 6 came from round one's discards.
    const secondCodes = secondRound.map(cardCode);
    expect(new Set(secondCodes).size).toBe(20);
    const firstCodes = new Set(firstRound.map(cardCode));
    expect(secondCodes.slice(14).every((code) => firstCodes.has(code))).toBe(true);
    expect(shoe.remaining()).toBe(4);
    // The short stack is replaced by a full reshuffle before the next round.
    expect(shoe.beginRound(rng)).toBe(true);
    expect(shoe.remaining()).toBe(24);
  });

  it('throws when a single round needs more cards than the shoe holds', () => {
    const rng = createSeededRng('too-many');
    const shoe = new Shoe({ decks: 1, ranks: RANK_SETS.aceToSix });
    shoe.beginRound(rng);
    for (let i = 0; i < 24; i++) shoe.draw(rng);
    expect(() => shoe.draw(rng)).toThrow(ShoeExhaustedError);
  });
});

describe('infinite shoe', () => {
  it('never runs out and never reshuffles', () => {
    const rng = createSeededRng('infinite');
    const shoe = new Shoe({ decks: Infinity, ranks: RANK_SETS.aceToSix });
    expect(shoe.infinite).toBe(true);
    expect(shoe.size()).toBe(Infinity);
    expect(shoe.beginRound(rng)).toBe(false);
    for (let i = 0; i < 1_000; i++) shoe.draw(rng);
    expect(shoe.remaining()).toBe(Infinity);
    expect(shoe.isCutCardOut()).toBe(false);
    expect(shoe.cutCardPosition()).toBe(Infinity);
    expect(shoe.shuffleCount()).toBe(0);
  });

  it('draws each card independently and uniformly (chi-square, 240k draws)', () => {
    const rng = createSeededRng('infinite-uniform');
    const shoe = new Shoe({ decks: Infinity, ranks: RANK_SETS.aceToSix });
    const counts = countByCode(Array.from({ length: 240_000 }, () => shoe.draw(rng)));
    expect(counts.size).toBe(24);
    expect(chiSquareUniform([...counts.values()]).pValue).toBeGreaterThan(0.001);
  });

  it('uses exactly one Rng draw per card', () => {
    let draws = 0;
    const seeded = createSeededRng('one-draw');
    const counting = {
      next: () => {
        draws++;
        return seeded.next();
      },
    };
    const shoe = new Shoe({ decks: Infinity });
    for (let i = 0; i < 100; i++) shoe.draw(counting);
    expect(draws).toBe(100);
  });
});
