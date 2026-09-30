/**
 * Lock & Roll's declared figures, proven on the game itself: exactReturns runs
 * the production game with the reference strategy over every roll, every
 * face of a re-rolled die and every pair of cards from an infinite shoe of
 * aces to sixes (36 rolls; 6 faces after each of the 17 re-rolls; 24 × 24
 * cards), and the result must equal the bet's declared figures, which
 * strategy.ts computes on its own.
 */
import { describe, expect, it } from 'vitest';
import { RANK_SETS } from '../../cards/card.ts';
import { Shoe } from '../../cards/shoe.ts';
import { exactReturns } from '../../math/exact.ts';
import { Fraction } from '../../math/fraction.ts';
import { createUniformRankSource } from '../../testing/uniform-ranks.ts';
import {
  LOCK_AND_ROLL_BETS,
  LOCK_AND_ROLL_DECISIONS,
  LOCK_AND_ROLL_MATH,
  LOCK_AND_ROLL_SIX_DECK,
  LOCK_AND_ROLL_WITHOUT_FREE,
  WITHOUT_FREE_ONE_ONE,
} from './bets.ts';
import { LOCK_AND_ROLL_CONFIG } from './config.ts';
import {
  createLockAndRoll,
  lockAndRollMathSummary,
  lockAndRollStrategy,
  type LockAndRollState,
} from './game.ts';
import type { LockAndRollChoice } from './rules.ts';

const BET = LOCK_AND_ROLL_BETS[0];
const infinite = () => new Shoe({ decks: Infinity, ranks: RANK_SETS.aceToSix });

describe('Lock & Roll — the declared figures, exactly, on the game', () => {
  const report = exactReturns(
    () => createLockAndRoll({ source: infinite() }),
    { 'lock-and-roll': 100 },
    lockAndRollStrategy(),
  );
  const mainBet = report.bets['lock-and-roll']!;

  it('covers every roll, re-roll and pair of cards', () => {
    // 19 rolls stand, 17 re-roll one die (6 faces); then 24 × 24 cards.
    expect(report.outcomes).toBe((19 + 17 * 6) * 24 * 24);
  });

  it('returns the declared RTP: a house edge of 791/19440 (4.07%)', () => {
    expect(mainBet.rtp.toString()).toBe('18649/19440');
    expect(mainBet.rtp.equals(LOCK_AND_ROLL_MATH.rtp)).toBe(true);
    expect(mainBet.rtp.toNumber()).toBe(BET.rtp);
    expect(report.total.rtp.equals(mainBet.rtp)).toBe(true);
  });

  it('charges the fee in 4/9 of rounds, 40% of the bet each time', () => {
    expect(mainBet.expectedStake.toString()).toBe('100');
    expect(mainBet.expectedFee.toString()).toBe('160/9'); // 40¢ × 4/9
    expect(
      mainBet.expectedFee.div(mainBet.expectedStake).equals(LOCK_AND_ROLL_MATH.averageFee),
    ).toBe(true);
    // RTP = (payout − fees) ÷ stake: the fees are part of the loss, not of the stake.
    const payout = mainBet.expectedPayout.div(mainBet.expectedStake);
    expect(payout.sub(LOCK_AND_ROLL_MATH.averageFee).equals(mainBet.rtp)).toBe(true);
  });

  it('wins 4421/7776 of rounds, and its volatility is the declared one', () => {
    expect(mainBet.hitFrequency.toString()).toBe('4421/7776');
    expect(mainBet.hitFrequency.toNumber()).toBe(BET.paytable[0].probability);
    expect(mainBet.entries.higher!.equals(mainBet.hitFrequency)).toBe(true);
    expect(mainBet.pushFrequency.toString()).toBe('0'); // a tie loses
    expect(mainBet.variance.equals(LOCK_AND_ROLL_MATH.variance)).toBe(true);
    expect(mainBet.standardDeviation).toBe(BET.standardDeviation);
  });

  it('prices the rules without the free 1-1 at 161/3240 (4.97%)', () => {
    const without = exactReturns(
      () =>
        createLockAndRoll({
          source: createUniformRankSource(RANK_SETS.aceToSix),
          rules: WITHOUT_FREE_ONE_ONE,
        }),
      { 'lock-and-roll': 100 },
      lockAndRollStrategy(WITHOUT_FREE_ONE_ONE),
    ).bets['lock-and-roll']!;
    expect(Fraction.ONE.sub(without.rtp).toString()).toBe('161/3240');
    expect(without.rtp.equals(LOCK_AND_ROLL_WITHOUT_FREE.rtp)).toBe(true);
    expect(without.expectedFee.toString()).toBe('160/9'); // 1-1 now stands: the same fees
  });

  it('returns less with any other strategy', () => {
    const rtpOf = (choose: (state: LockAndRollState) => LockAndRollChoice) =>
      exactReturns(
        () => createLockAndRoll({ source: createUniformRankSource(RANK_SETS.aceToSix) }),
        { 'lock-and-roll': 100 },
        choose,
      ).bets['lock-and-roll']!.rtp;
    const best = rtpOf(lockAndRollStrategy());
    expect(best.equals(mainBet.rtp)).toBe(true);
    // Always standing: two dice against two cards, ties lose, and no fee.
    expect(rtpOf(() => 'stand').toString()).toBe('575/648'); // 2 × (1 − 146/1296) ÷ 2
    // Re-rolling every time, keeping the higher die.
    const alwaysLockHigh = (state: LockAndRollState): LockAndRollChoice =>
      state.data.dice[0] >= state.data.dice[1] ? 'lock-0' : 'lock-1';
    expect(rtpOf(alwaysLockHigh).compare(best)).toBe(-1);
    // Locking the lower die instead of the higher one when re-rolling.
    const lockLow = (state: LockAndRollState): LockAndRollChoice => {
      const choice = lockAndRollStrategy()(state);
      return choice === 'stand' ? choice : choice === 'lock-0' ? 'lock-1' : 'lock-0';
    };
    expect(rtpOf(lockLow).compare(best)).toBe(-1);
  });
});

describe('Lock & Roll — the math summary and the strategy card', () => {
  const summary = lockAndRollMathSummary();

  it('declares one main bet, its six-deck figures and the decisions', () => {
    expect(summary.gameId).toBe('lock-and-roll');
    expect(summary.finiteShoe).toBe('6-deck shoe');
    expect(summary.bets).toHaveLength(1);
    const [bet] = summary.bets;
    expect(bet!.houseEdge).toBeCloseTo(791 / 19440, 15);
    expect(bet!.hitFrequency).toBe(4421 / 7776);
    expect(bet!.maxExposure).toBe(1);
    expect(bet!.finiteShoe!.rtp).toBe(LOCK_AND_ROLL_SIX_DECK.rtp.toNumber());
    expect(summary.decisions).toBe(LOCK_AND_ROLL_DECISIONS);
  });

  it('writes the card from the computed strategy: 21 rolls, 9 re-rolls', () => {
    const { card } = LOCK_AND_ROLL_DECISIONS;
    expect(card.choices).toEqual(['Stand', 'Lock']);
    expect(card.rows).toHaveLength(21);
    const locked = card.rows.filter((row) => row.best === 1).map((row) => row.situation);
    expect(locked).toEqual(['1-1', '2-1', '3-1', '4-1', '5-1', '6-1', '3-2', '4-2', '5-2']);
    expect(card.rows.find((row) => row.situation === '1-1')!.play).toBe(
      'Lock a 1, re-roll the other (free)',
    );
    expect(card.rows.find((row) => row.situation === '6-1')!.play).toBe(
      'Lock the 6, re-roll the 1',
    );
    const sixTwo = card.rows.find((row) => row.situation === '6-2')!;
    expect(sixTwo.play).toBe('Stand');
    expect(sixTwo.values).toEqual([1 / 6, 11 / 135]);
    expect(LOCK_AND_ROLL_DECISIONS.description).toContain(
      're-rolls on 1-1, 2-1, 3-1, 4-1, 5-1, 6-1, 3-2, 4-2, 5-2 and stands on the other 12 rolls',
    );
  });

  it('compares the rules with and without the free 1-1, and on the six-deck shoe', () => {
    const [played, without, shoe] = LOCK_AND_ROLL_DECISIONS.figures;
    expect([played!.label, without!.label, shoe!.label]).toEqual([
      'These rules',
      'Without the free 1-1',
      'These rules, 6-deck shoe',
    ]);
    expect(played!.houseEdge).toBeCloseTo(791 / 19440, 15);
    expect(without!.houseEdge).toBeCloseTo(161 / 3240, 15);
    expect(played!.choiceFrequencies).toEqual([{ choice: 'Lock', frequency: 17 / 36 }]);
    expect(without!.choiceFrequencies).toEqual([{ choice: 'Lock', frequency: 4 / 9 }]);
    expect(played!.feeFrequency).toBe(4 / 9);
    expect(played!.averageFee).toBe(8 / 45);
    expect(played!.elementOfRisk).toBe(791 / 22896);
    expect(played!.standardDeviation).toBe(BET.standardDeviation);
    expect(shoe!.rtp).toBe(BET.finiteShoe.rtp);
  });

  it('describes the Lock fee and the free 1-1 from the configuration', () => {
    expect(LOCK_AND_ROLL_CONFIG.rules).toEqual({
      fee: { numerator: 2, denominator: 5 },
      freeOneOne: true,
    });
    expect(BET.description).toContain(
      'for the Lock fee of 40% of the bet, taken at once and never returned',
    );
    expect(BET.description).toContain('(a roll of 1-1 re-rolls for free)');
  });
});
