/**
 * Espelho on its real shoe, exactly.
 *
 * The declared figures assume an infinite shoe: the second card as likely
 * to match the first as any other value. From six decks it is not: once a
 * six is out, 23 of the 143 cards left are sixes, not 1 in 6. Pairs of cards
 * get rarer, which moves every bet.
 *
 * The shift is the same in every round, not only the first after a
 * shuffle. Espelho deals exactly two cards a round and a fixed number of
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
import { ESPELHO_BETS, ESPELHO_MATH, SEIS_SEIS_FIXED_RTP } from './bets.ts';
import { ESPELHO_CONFIG } from './config.ts';
import { createEspelho } from './game.ts';

const BETS: Bets = Object.fromEntries(ESPELHO_BETS.map(({ id }) => [id, 100]));
const KEYS: readonly [string, keyof typeof ESPELHO_MATH][] = [
  ['espelho', 'espelho'],
  ['empate', 'empate'],
  ['somas-iguais', 'somasIguais'],
  ['par-vs-par', 'parVsPar'],
  ['espelho-perfeito', 'espelhoPerfeito'],
  ['seis-seis', 'seisSeis'],
];

describe('Espelho — every round of the six-deck shoe, exactly', () => {
  const report = exactReturns(
    () =>
      createEspelho({
        source: createFullShoePairSource(ESPELHO_CONFIG.decks),
        // The fixed pays alone, as in the declared figures.
        jackpot: new ProgressiveJackpot({ id: 'espelho', seed: 0, contributionRate: 0 }),
      }),
    BETS,
  );

  it('covers 36 rolls × 6 first-card values × 143 second cards', () => {
    expect(report.outcomes).toBe(30_888);
  });

  it.each(KEYS)('%s wins and returns exactly what the bet declares for the shoe', (id, key) => {
    const result = report.bets[id]!;
    const definition = ESPELHO_BETS.find((bet) => bet.id === id)!;
    expect(result.hitFrequency.equals(ESPELHO_MATH[key].shoe)).toBe(true);
    expect(result.hitFrequency.toNumber()).toBe(definition.finiteShoe!.hitFrequency);
    const fixedRtp =
      id === 'seis-seis'
        ? definition.finiteShoe!.rtp - ESPELHO_CONFIG.jackpot.contributionRate
        : definition.finiteShoe!.rtp;
    expect(result.rtp.toNumber()).toBeCloseTo(fixedRtp, 15);
  });

  it('makes pairs of cards rarer: every bet moves', () => {
    const rtp = (id: string) => report.bets[id]!.rtp.toString();
    expect(KEYS.map(([id]) => [id, rtp(id)])).toEqual([
      ['espelho', '4915/5148'], // 95.47%: the dealer pairs less often, so the dice win more
      ['empate', '263/286'],
      ['somas-iguais', '1162/1287'],
      ['par-vs-par', '713/858'], // 83.10% instead of 31/36 = 86.11%
      ['espelho-perfeito', '1541/1716'],
      ['seis-seis', '161/216'], // the fixed pays: 74.54% instead of 77.24%
    ]);
    // A pair of cards: 6 × (24/144)(23/143) = 23/143 instead of 1/6.
    expect(ESPELHO_MATH.parVsPar.shoe.div(Fraction.of(1, 6)).toString()).toBe('23/143');
    expect(report.bets['seis-seis']!.rtp.compare(SEIS_SEIS_FIXED_RTP)).toBe(-1);
  });
});
