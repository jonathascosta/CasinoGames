/**
 * Lock & Roll on its real shoe, exactly.
 *
 * The declared figures assume the dealer's cards come from an infinite
 * shoe. From six decks the second card is less likely to match the first
 * (23 of the 143 cards left rather than 1 in 6), which moves the dealer's
 * totals toward the middle.
 *
 * Lock & Roll deals exactly two cards a round and a fixed number of rounds per
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
import { describeShoe, exact, exactFigures, recordFigures } from '../../testing/record.ts';
import { LOCK_AND_ROLL_BETS, LOCK_AND_ROLL_MATH, LOCK_AND_ROLL_SIX_DECK } from './bets.ts';
import { LOCK_AND_ROLL_CONFIG } from './config.ts';
import { createLockAndRoll, createLockAndRollShoe, lockAndRollStrategy } from './game.ts';

describe('Lock & Roll — every round of the six-deck shoe, exactly', () => {
  const report = exactReturns(
    () => createLockAndRoll({ source: createFullShoePairSource(LOCK_AND_ROLL_CONFIG.decks) }),
    { 'lock-and-roll': 100 },
    lockAndRollStrategy(),
  );
  const mainBet = report.bets['lock-and-roll']!;
  const declared = LOCK_AND_ROLL_BETS[0].finiteShoe;

  it('covers every roll, re-roll and pair of cards from a full shoe', () => {
    // 19 rolls stand, 17 re-roll (6 faces); the first card as one of 6 values, the second one of 143 cards.
    expect(report.outcomes).toBe((19 + 17 * 6) * 6 * 143);
  });

  it('returns exactly what the bet declares for the shoe', () => {
    expect(mainBet.rtp.toString()).toBe('148219/154440');
    expect(mainBet.rtp.equals(LOCK_AND_ROLL_SIX_DECK.rtp)).toBe(true);
    expect(mainBet.rtp.toNumber()).toBe(declared.rtp);
    expect(mainBet.hitFrequency.equals(LOCK_AND_ROLL_SIX_DECK.hitFrequency)).toBe(true);
    expect(mainBet.hitFrequency.toNumber()).toBe(declared.hitFrequency);
    expect(mainBet.variance.equals(LOCK_AND_ROLL_SIX_DECK.variance)).toBe(true);
  });

  it('records the six-deck figures of the reference strategy', async () => {
    expect(mainBet.rtp.equals(LOCK_AND_ROLL_SIX_DECK.rtp)).toBe(true);
    await recordFigures('six-deck-exact', {
      shoe: describeShoe(createLockAndRollShoe()),
      sampleSpace: { rolls: 36, firstCard: 6, secondCard: 143, outcomes: report.outcomes },
      bet: {
        ...exactFigures(mainBet),
        averageFee: exact(mainBet.expectedFee.div(mainBet.expectedStake)),
        elementOfRisk: exact(LOCK_AND_ROLL_SIX_DECK.elementOfRisk),
        rerollFrequency: exact(LOCK_AND_ROLL_SIX_DECK.rerollFrequency),
      },
      shift: exact(mainBet.rtp.sub(LOCK_AND_ROLL_MATH.rtp)),
    });
  });

  it('favours the player a little: the dealer pairs less often', () => {
    // House edge 6221/154440 = 4.03% against 791/19440 = 4.07%: 0.04 pp.
    expect(mainBet.rtp.sub(LOCK_AND_ROLL_MATH.rtp).toString()).toBe('227/555984');
    // The fees are the same: the strategy, and so the re-rolls, do not depend on the cards.
    expect(mainBet.expectedFee.toString()).toBe('160/9');
  });
});
