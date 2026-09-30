/**
 * Mirror on its real shoe, exactly.
 *
 * The declared figures assume an infinite shoe: the second card as likely
 * to match the first as any other value. From six decks it is not: once a
 * six is out, 23 of the 143 cards left are sixes, not 1 in 6. Pairs of cards
 * get rarer, which moves every bet.
 *
 * The shift is the same in every round, not only the first after a
 * shuffle. Mirror deals exactly two cards a round and a fixed number of
 * rounds per shoe, whatever the cards, so the two cards of any round sit at
 * fixed positions of a uniformly shuffled shoe: a uniform draw of two cards
 * from the full 144. This suite runs the game over every roll and every
 * ordered pair of cards from a full shoe, 36 × 6 × 143 draws, and checks
 * the six-deck figures the bets declare (six-deck.math.test.ts confirms the
 * long run on the real shoe).
 */
import { describe, expect, it } from 'vitest';
import type { Bets } from '../../game/types.ts';
import { exactReturns } from '../../math/exact.ts';
import { Fraction } from '../../math/fraction.ts';
import { ProgressiveJackpot } from '../../progressive/progressive.ts';
import { createFullShoePairSource } from '../../testing/full-shoe-pairs.ts';
import { describeShoe, exact, recordFigures } from '../../testing/record.ts';
import { MIRROR_BETS, MIRROR_MATH, DOUBLE_SIXES_FIXED_RTP } from './bets.ts';
import { MIRROR_CONFIG } from './config.ts';
import { createMirror, createMirrorShoe } from './game.ts';

const BETS: Bets = Object.fromEntries(MIRROR_BETS.map(({ id }) => [id, 100]));
const KEYS: readonly [string, keyof typeof MIRROR_MATH][] = [
  ['mirror', 'mirror'],
  ['tie', 'tie'],
  ['equal-sums', 'equalSums'],
  ['pair-vs-pair', 'pairVsPair'],
  ['perfect-mirror', 'perfectMirror'],
  ['double-sixes', 'doubleSixes'],
];

describe('Mirror — every round of the six-deck shoe, exactly', () => {
  const report = exactReturns(
    () =>
      createMirror({
        source: createFullShoePairSource(MIRROR_CONFIG.decks),
        // The fixed pays alone, as in the declared figures.
        jackpot: new ProgressiveJackpot({ id: 'mirror', seed: 0, contributionRate: 0 }),
      }),
    BETS,
  );

  it('covers 36 rolls × 6 first-card values × 143 second cards', () => {
    expect(report.outcomes).toBe(30_888);
  });

  it.each(KEYS)('%s wins and returns exactly what the bet declares for the shoe', (id, key) => {
    const result = report.bets[id]!;
    const definition = MIRROR_BETS.find((bet) => bet.id === id)!;
    expect(result.hitFrequency.equals(MIRROR_MATH[key].shoe)).toBe(true);
    expect(result.hitFrequency.toNumber()).toBe(definition.finiteShoe!.hitFrequency);
    const fixedRtp =
      id === 'double-sixes'
        ? definition.finiteShoe!.rtp - MIRROR_CONFIG.jackpot.contributionRate
        : definition.finiteShoe!.rtp;
    expect(result.rtp.toNumber()).toBeCloseTo(fixedRtp, 15);
  });

  it('records every bet on the six-deck shoe, and where the meter breaks even there', async () => {
    const contribution = Fraction.of(
      Math.round(MIRROR_CONFIG.jackpot.contributionRate * 1_000_000),
      1_000_000,
    );
    const hit = MIRROR_MATH.doubleSixes.shoe;
    const fixedRtp = report.bets['double-sixes']!.rtp;
    // Break-even on this shoe: fixedRtp + hit × M ÷ SIDE_MAX = 1.
    const breakEven = Fraction.ONE.sub(fixedRtp).mul(Fraction.of(MIRROR_CONFIG.sideMax)).div(hit);
    await recordFigures('six-deck-exact', {
      shoe: describeShoe(createMirrorShoe()),
      sampleSpace: { rolls: 36, firstCard: 6, secondCard: 143, outcomes: report.outcomes },
      bets: Object.fromEntries(
        KEYS.map(([id]) => {
          const result = report.bets[id]!;
          return [
            id,
            {
              hitFrequency: exact(result.hitFrequency),
              rtp: exact(result.rtp),
              houseEdge: exact(Fraction.ONE.sub(result.rtp)),
              variance: exact(result.variance),
              standardDeviation: result.standardDeviation,
            },
          ];
        }),
      ),
      doubleSixes: {
        fixedRtp: exact(fixedRtp),
        rtpExcludingSeed: exact(fixedRtp.add(contribution)),
        cycleRounds: exact(Fraction.ONE.div(hit)),
        breakEvenMeter: exact(breakEven),
      },
      /** A pair of cards against an infinite shoe's 1 in 6: 23/143 as likely per value. */
      pairRatio: exact(MIRROR_MATH.pairVsPair.shoe.div(Fraction.of(1, 6))),
    });
  });

  it('makes pairs of cards rarer: every bet moves', () => {
    const rtp = (id: string) => report.bets[id]!.rtp.toString();
    expect(KEYS.map(([id]) => [id, rtp(id)])).toEqual([
      ['mirror', '4915/5148'], // 95.47%: the dealer pairs less often, so the dice win more
      ['tie', '263/286'],
      ['equal-sums', '1162/1287'],
      ['pair-vs-pair', '713/858'], // 83.10% instead of 31/36 = 86.11%
      ['perfect-mirror', '1541/1716'],
      ['double-sixes', '161/216'], // the fixed pays: 74.54% instead of 77.24%
    ]);
    // A pair of cards: 6 × (24/144)(23/143) = 23/143 instead of 1/6.
    expect(MIRROR_MATH.pairVsPair.shoe.div(Fraction.of(1, 6)).toString()).toBe('23/143');
    expect(report.bets['double-sixes']!.rtp.compare(DOUBLE_SIXES_FIXED_RTP)).toBe(-1);
  });
});
