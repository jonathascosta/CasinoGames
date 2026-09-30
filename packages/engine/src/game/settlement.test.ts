import { describe, expect, it } from 'vitest';
import { EngineError } from './errors.ts';
import { odds } from './money.ts';
import {
  settleLoss,
  settlePush,
  settleWin,
  settleWithPayout,
  settlementTotals,
  withFee,
} from './settlement.ts';

describe('settlement lines', () => {
  it('pays stake plus winnings on a win', () => {
    expect(settleWin(200, odds(3, 2), 'blackjack')).toEqual({
      stake: 200,
      payout: 500,
      net: 300,
      outcome: 'win',
      entryId: 'blackjack',
    });
  });

  it('returns nothing on a loss and the stake on a push', () => {
    expect(settleLoss(100)).toEqual({ stake: 100, payout: 0, net: -100, outcome: 'lose' });
    expect(settlePush(100)).toEqual({ stake: 100, payout: 100, net: 0, outcome: 'push' });
  });

  it('omits entryId when there is none', () => {
    expect(settleLoss(100)).not.toHaveProperty('entryId');
  });

  it('derives the outcome from the net for explicit payouts', () => {
    expect(settleWithPayout(100, 50).outcome).toBe('lose'); // e.g. a surrender
    expect(settleWithPayout(100, 100).outcome).toBe('push');
    expect(settleWithPayout(100, 101).outcome).toBe('win');
  });

  it.each([
    [0, 0],
    [-100, 0],
    [100.5, 0],
    [100, -1],
    [100, 0.5],
  ])('rejects stake %d with payout %d', (stake, payout) => {
    expect(() => settleWithPayout(stake, payout)).toThrow(EngineError);
  });
});

describe('fees', () => {
  it('charges a fee against a line: the net and the outcome count it', () => {
    expect(withFee(settleWin(100, odds(1), 'higher'), 40)).toEqual({
      stake: 100,
      payout: 200,
      fee: 40,
      net: 60,
      outcome: 'win',
      entryId: 'higher',
    });
    expect(withFee(settleLoss(100), 40)).toEqual({
      stake: 100,
      payout: 0,
      fee: 40,
      net: -140,
      outcome: 'lose',
    });
    // The stake came back, the fee did not.
    expect(withFee(settlePush(100), 40).outcome).toBe('lose');
  });

  it('leaves a line without a fee as it was', () => {
    const line = settleWin(100, odds(1));
    expect(withFee(line, 0)).toBe(line);
    expect(withFee(line, 0)).not.toHaveProperty('fee');
  });

  it.each([-1, 0.5, Number.NaN])('rejects a fee of %d', (fee) => {
    expect(() => withFee(settleLoss(100), fee)).toThrow(EngineError);
  });

  it('never charges a line twice', () => {
    expect(() => withFee(withFee(settleLoss(100), 40), 40)).toThrow(EngineError);
  });
});

describe('settlementTotals', () => {
  it('sums stakes, payouts, fees and net', () => {
    expect(
      settlementTotals({
        main: settleWin(100, odds(1)),
        side: settleLoss(50),
        tie: settlePush(25),
      }),
    ).toEqual({ stake: 175, payout: 225, fee: 0, net: 50 });
    expect(settlementTotals({})).toEqual({ stake: 0, payout: 0, fee: 0, net: 0 });
    expect(settlementTotals({ main: withFee(settleWin(100, odds(1)), 40) })).toEqual({
      stake: 100,
      payout: 200,
      fee: 40,
      net: 60,
    });
  });
});
