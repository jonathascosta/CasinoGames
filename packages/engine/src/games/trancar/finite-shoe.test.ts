/**
 * Trancar on its real shoe, exactly.
 *
 * The declared figures assume the dealer's cards come from an infinite
 * shoe. From six decks the second card is less likely to match the first
 * (23 of the 143 cards left rather than 1 in 6), which moves the dealer's
 * totals toward the middle.
 *
 * Trancar deals exactly two cards a round and a fixed number of rounds per
 * shoe (54 between shuffles), whatever the dice and the decisions, so the
 * two cards of any round sit at fixed positions of a uniformly shuffled
 * shoe: a uniform draw of two cards from the full 144. This suite runs the
 * game with the reference strategy over every roll, every re-roll and every
 * pair of cards from a full shoe, and checks the six-deck figures the bet
 * declares (six-deck.math.test.ts confirms the long run on the real shoe).
 */
import { describe, expect, it } from 'vitest';
import { exactReturns } from '../../math/exact.ts';
import { createFullShoePairSource } from '../../testing/full-shoe-pairs.ts';
import { TRANCAR_BETS, TRANCAR_MATH, TRANCAR_SIX_DECK } from './bets.ts';
import { TRANCAR_CONFIG } from './config.ts';
import { createTrancar, trancarStrategy } from './game.ts';

describe('Trancar — every round of the six-deck shoe, exactly', () => {
  const report = exactReturns(
    () => createTrancar({ source: createFullShoePairSource(TRANCAR_CONFIG.decks) }),
    { trancar: 100 },
    trancarStrategy(),
  );
  const trancar = report.bets.trancar!;
  const declared = TRANCAR_BETS[0].finiteShoe;

  it('covers every roll, re-roll and pair of cards from a full shoe', () => {
    // 19 rolls stand, 17 re-roll (6 faces); the first card as one of 6 values, the second one of 143 cards.
    expect(report.outcomes).toBe((19 + 17 * 6) * 6 * 143);
  });

  it('returns exactly what the bet declares for the shoe', () => {
    expect(trancar.rtp.toString()).toBe('148219/154440');
    expect(trancar.rtp.equals(TRANCAR_SIX_DECK.rtp)).toBe(true);
    expect(trancar.rtp.toNumber()).toBe(declared.rtp);
    expect(trancar.hitFrequency.equals(TRANCAR_SIX_DECK.hitFrequency)).toBe(true);
    expect(trancar.hitFrequency.toNumber()).toBe(declared.hitFrequency);
    expect(trancar.variance.equals(TRANCAR_SIX_DECK.variance)).toBe(true);
  });

  it('favours the player a little: the dealer pairs less often', () => {
    // House edge 6221/154440 = 4.03% against 791/19440 = 4.07%: 0.04 pp.
    expect(trancar.rtp.sub(TRANCAR_MATH.rtp).toString()).toBe('227/555984');
    // The fees are the same: the strategy, and so the re-rolls, do not depend on the cards.
    expect(trancar.expectedFee.toString()).toBe('160/9');
  });
});
