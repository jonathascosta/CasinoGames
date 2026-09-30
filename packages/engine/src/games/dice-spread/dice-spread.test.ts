/**
 * Exact math of Dice Spread: the real game is run over every possible draw
 * and each declared figure must equal the enumerated fraction. The card is
 * uniform over ace to six, as in an infinite shoe; the Monte Carlo suite
 * (dice-spread.math.test.ts) plays the real six-deck shoe.
 */
import { describe, expect, it } from 'vitest';
import { RANK_SETS } from '../../cards/card.ts';
import { Shoe } from '../../cards/shoe.ts';
import { DIE_FACES } from '../../dice/dice.ts';
import type { PaytableEntry } from '../../game/types.ts';
import { exactReturns, type ExactReturn } from '../../math/exact.ts';
import { Fraction } from '../../math/fraction.ts';
import {
  exact,
  exactFigures,
  exposure,
  oddsRecord,
  outcomeTable,
  recordFigures,
} from '../../testing/record.ts';
import { createUniformRankSource } from '../../testing/uniform-ranks.ts';
import { DICE_SPREAD_BETS } from './bets.ts';
import { createDiceSpread, diceSpreadMathSummary } from './game.ts';
import {
  DICE_SPREAD_BET_IDS,
  readDiceSpreadRoll,
  resolveDiceSpreadBet,
  type DiceSpreadBetId,
} from './rules.ts';

const ALL_BETS = { between: 100, match: 100, bullseye: 100, doubles: 100, triple: 100 };

/** 36 rolls × 6 card values: the card source draws only the rank. */
const byValue = exactReturns(
  () => createDiceSpread({ source: createUniformRankSource(RANK_SETS.aceToSix) }),
  ALL_BETS,
);
/** 36 rolls × 24 cards: an infinite shoe, suits included. */
const byCard = exactReturns(
  () => createDiceSpread({ source: new Shoe({ decks: Infinity, ranks: RANK_SETS.aceToSix }) }),
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

const EXPECTED: Readonly<Record<DiceSpreadBetId, Expected>> = {
  between: { rtp: '26/27', houseEdge: '1/27', hit: '5/27', push: '4/9', variance: '3641/2916' },
  match: { rtp: '11/12', houseEdge: '1/12', hit: '11/36', push: '0', variance: '275/144' },
  bullseye: { rtp: '23/27', houseEdge: '4/27', hit: '1/27', push: '0', variance: '13754/729' },
  doubles: { rtp: '5/6', houseEdge: '1/6', hit: '1/6', push: '0', variance: '125/36' },
  triple: { rtp: '31/36', houseEdge: '5/36', hit: '1/36', push: '0', variance: '33635/1296' },
};

function measured(betId: DiceSpreadBetId, report = byValue): ExactReturn {
  return report.bets[betId]!;
}

describe('Dice Spread — exact math', () => {
  it('enumerates the 36 dice outcomes × 6 card values', () => {
    expect(byValue.outcomes).toBe(36 * 6);
  });

  describe.each(DICE_SPREAD_BETS.map((bet) => [bet.id, bet] as const))('%s', (id, bet) => {
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
    const edge = (id: DiceSpreadBetId) => pct(1 - measured(id).rtp.toNumber());
    const hit = (id: DiceSpreadBetId) => pct(measured(id).hitFrequency.toNumber());
    expect([edge('between'), pct(measured('between').rtp.toNumber())]).toEqual(['3.70%', '96.30%']);
    expect([hit('match'), edge('match')]).toEqual(['30.56%', '8.33%']);
    expect([hit('bullseye'), edge('bullseye')]).toEqual(['3.70%', '14.81%']);
    expect([hit('doubles'), edge('doubles')]).toEqual(['16.67%', '16.67%']);
    expect([hit('triple'), edge('triple')]).toEqual(['2.78%', '13.89%']);
  });

  it('treats suits as cosmetic: an infinite shoe gives the same fractions', () => {
    expect(byCard.outcomes).toBe(36 * 24);
    for (const { id } of DICE_SPREAD_BETS) {
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

describe('Dice Spread — the figures of the Math Report', () => {
  const uniform = () => createDiceSpread({ source: createUniformRankSource(RANK_SETS.aceToSix) });

  it("adds up each bet's outcomes to its declared figures, and finds the most a round can pay", async () => {
    const bets = Object.fromEntries(
      diceSpreadMathSummary().bets.map((bet) => {
        const result = measured(bet.betId as DiceSpreadBetId);
        expect(result.rtp.toNumber()).toBe(bet.rtp);
        expect(result.hitFrequency.toNumber()).toBeCloseTo(bet.hitFrequency!, 15);
        return [
          bet.betId,
          { outcomes: outcomeTable(bet.paytable, result), ...exactFigures(result) },
        ];
      }),
    );
    // Every bet at its maximum, over every roll and card.
    const atMax = exposure(
      uniform,
      Object.fromEntries(DICE_SPREAD_BETS.map((bet) => [bet.id, bet.max])),
    );
    for (const bet of diceSpreadMathSummary().bets) {
      expect(atMax.bets[bet.betId]!.win).toBe(bet.maxExposure! * bet.max);
    }
    await recordFigures('exact', {
      sampleSpace: {
        rolls: DIE_FACES.length ** 2,
        cardValues: RANK_SETS.aceToSix.length,
        outcomes: byValue.outcomes,
        withSuits: byCard.outcomes,
      },
      source: { kind: 'uniform ranks', ranks: RANK_SETS.aceToSix },
      bets,
      allBets: exact(byValue.total.rtp),
      maxExposure: atMax,
    });
  });

  it('settles every roll and card as the rules state: the enumeration adds up to every RTP', async () => {
    // The 21 distinct rolls, lower die first, each with the 6 card values.
    const rows = DIE_FACES.flatMap((low) =>
      DIE_FACES.filter((high) => high >= low).flatMap((high) =>
        RANK_SETS.aceToSix.map((card) => {
          const ways = low === high ? 1 : 2;
          const net = Object.fromEntries(
            DICE_SPREAD_BET_IDS.map((bet) => {
              const result = resolveDiceSpreadBet(bet, [low, high], card);
              const value =
                result.outcome === 'win'
                  ? Fraction.of(result.odds.to, result.odds.per)
                  : result.outcome === 'push'
                    ? Fraction.ZERO
                    : Fraction.of(-1);
              return [bet, value];
            }),
          ) as Record<DiceSpreadBetId, Fraction>;
          return { low, high, ways, card, probability: Fraction.of(ways, 216), net };
        }),
      ),
    );
    expect(rows).toHaveLength(126);
    const total = rows.reduce((sum, row) => sum.add(row.probability), Fraction.ZERO);
    expect(total.equals(Fraction.ONE)).toBe(true);
    // Each bet's return over the table is the enumerated RTP of the game itself.
    for (const bet of DICE_SPREAD_BET_IDS) {
      const rtp = rows.reduce(
        (sum, row) => sum.add(row.probability.mul(Fraction.ONE.add(row.net[bet]))),
        Fraction.ZERO,
      );
      expect(rtp.equals(measured(bet).rtp), bet).toBe(true);
    }
    await recordFigures('enumeration', {
      bets: DICE_SPREAD_BET_IDS,
      // Per row: the dice (higher first), how many of the 36 rolls show them, the
      // card, the row's chance, and each bet's net result per unit staked.
      rows: rows.map(({ low, high, ways, card, probability, net }) => ({
        dice: [high, low],
        spread: readDiceSpreadRoll([low, high]).spread,
        ways,
        card,
        probability: probability.toString(),
        net: Object.fromEntries(DICE_SPREAD_BET_IDS.map((bet) => [bet, net[bet].toString()])),
      })),
      odds: Object.fromEntries(
        DICE_SPREAD_BETS.map((bet) => [
          bet.id,
          bet.paytable.flatMap((entry) => ('odds' in entry ? [oddsRecord(entry.odds)] : [])),
        ]),
      ),
    });
  });
});
