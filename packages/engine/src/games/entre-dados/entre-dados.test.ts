/**
 * Exact math of Entre Dados: the real game is run over every possible draw
 * and each declared figure must equal the enumerated fraction. The card is
 * uniform over ace to six, as in an infinite shoe; the Monte Carlo suite
 * (entre-dados.math.test.ts) plays the real six-deck shoe.
 */
import { describe, expect, it } from 'vitest';
import { RANK_SETS } from '../../cards/card.ts';
import { Shoe } from '../../cards/shoe.ts';
import type { PaytableEntry } from '../../game/types.ts';
import { exactReturns, type ExactReturn } from '../../math/exact.ts';
import { Fraction } from '../../math/fraction.ts';
import { createUniformRankSource } from '../../testing/uniform-ranks.ts';
import { ENTRE_DADOS_BETS } from './bets.ts';
import { createEntreDados } from './game.ts';
import type { EntreDadosBetId } from './rules.ts';

const ALL_BETS = { entre: 100, exato: 100, 'olho-de-boi': 100, dobros: 100, triplo: 100 };

/** 36 rolls × 6 card values: the card source draws only the rank. */
const byValue = exactReturns(
  () => createEntreDados({ source: createUniformRankSource(RANK_SETS.aceToSix) }),
  ALL_BETS,
);
/** 36 rolls × 24 cards: an infinite shoe, suits included. */
const byCard = exactReturns(
  () => createEntreDados({ source: new Shoe({ decks: Infinity, ranks: RANK_SETS.aceToSix }) }),
  ALL_BETS,
);

interface Expected {
  readonly rtp: string;
  readonly houseEdge: string;
  readonly hit: string;
  readonly push: string;
  /** σ² of the net result per unit staked. */
  readonly variance: string;
}

const EXPECTED: Readonly<Record<EntreDadosBetId, Expected>> = {
  entre: { rtp: '26/27', houseEdge: '1/27', hit: '5/27', push: '4/9', variance: '3641/2916' },
  exato: { rtp: '11/12', houseEdge: '1/12', hit: '11/36', push: '0', variance: '275/144' },
  'olho-de-boi': { rtp: '23/27', houseEdge: '4/27', hit: '1/27', push: '0', variance: '13754/729' },
  dobros: { rtp: '5/6', houseEdge: '1/6', hit: '1/6', push: '0', variance: '125/36' },
  triplo: { rtp: '31/36', houseEdge: '5/36', hit: '1/36', push: '0', variance: '33635/1296' },
};

function measured(betId: EntreDadosBetId, report = byValue): ExactReturn {
  return report.bets[betId]!;
}

describe('Entre Dados — exact math', () => {
  it('enumerates the 36 dice outcomes × 6 card values', () => {
    expect(byValue.outcomes).toBe(36 * 6);
  });

  describe.each(ENTRE_DADOS_BETS.map((bet) => [bet.id, bet] as const))('%s', (id, bet) => {
    const exact = measured(id);
    const expected = EXPECTED[id];

    it('has exactly the declared RTP and house edge', () => {
      expect(exact.rtp.toString()).toBe(expected.rtp);
      expect(exact.rtp.toNumber()).toBe(bet.rtp);
      expect(Fraction.ONE.sub(exact.rtp).toString()).toBe(expected.houseEdge);
    });

    it('wins, pushes and pays each paytable line with the declared probability', () => {
      expect(exact.hitFrequency.toString()).toBe(expected.hit);
      expect(exact.pushFrequency.toString()).toBe(expected.push);
      const declared = Object.fromEntries(
        bet.paytable.map((entry: PaytableEntry) => [entry.id, entry.probability]),
      );
      const enumerated = Object.fromEntries(
        Object.entries(exact.entries).map(([entryId, p]) => [entryId, p.toNumber()]),
      );
      expect(enumerated).toEqual(declared);
    });

    it('has the declared volatility index (σ of the net result per unit staked)', () => {
      expect(exact.variance.toString()).toBe(expected.variance);
      expect(exact.standardDeviation).toBeCloseTo(bet.standardDeviation, 12);
    });
  });

  it('reproduces the published figures', () => {
    const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
    const edge = (id: EntreDadosBetId) => pct(1 - measured(id).rtp.toNumber());
    const hit = (id: EntreDadosBetId) => pct(measured(id).hitFrequency.toNumber());
    expect([edge('entre'), pct(measured('entre').rtp.toNumber())]).toEqual(['3.70%', '96.30%']);
    expect([hit('exato'), edge('exato')]).toEqual(['30.56%', '8.33%']);
    expect([hit('olho-de-boi'), edge('olho-de-boi')]).toEqual(['3.70%', '14.81%']);
    expect([hit('dobros'), edge('dobros')]).toEqual(['16.67%', '16.67%']);
    expect([hit('triplo'), edge('triplo')]).toEqual(['2.78%', '13.89%']);
  });

  it('treats suits as cosmetic: an infinite shoe gives the same fractions', () => {
    expect(byCard.outcomes).toBe(36 * 24);
    for (const { id } of ENTRE_DADOS_BETS) {
      const a = measured(id);
      const b = measured(id, byCard);
      expect(b.rtp.equals(a.rtp)).toBe(true);
      expect(b.variance.equals(a.variance)).toBe(true);
      expect(b.hitFrequency.equals(a.hitFrequency)).toBe(true);
      expect(b.pushFrequency.equals(a.pushFrequency)).toBe(true);
    }
  });

  it('returns 239/270 of everything staked when all five bets are played equally', () => {
    // Informational: the five house edges add up to 31/54 of a unit per 5 staked.
    expect(byValue.total.rtp.toString()).toBe('239/270');
  });
});
