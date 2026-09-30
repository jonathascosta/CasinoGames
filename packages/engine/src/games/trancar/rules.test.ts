import { describe, expect, it } from 'vitest';
import type { DicePair } from '../../dice/dice.ts';
import { TRANCAR_CONFIG, type TrancarRules } from './config.ts';
import {
  isFreeReroll,
  lockChoice,
  lockedDie,
  otherDie,
  paidRerollFee,
  rerollFee,
  rollLabel,
  trancarWins,
  withDie,
} from './rules.ts';

const RULES = TRANCAR_CONFIG.rules;
const WITHOUT_FREE: TrancarRules = { ...RULES, freeOneOne: false };

describe('Trancar rules', () => {
  it('names the choices: Ficar, or Trancar locking the first or the second die', () => {
    expect([lockChoice(0), lockChoice(1)]).toEqual(['trancar-0', 'trancar-1']);
    expect([lockedDie('ficar'), lockedDie('trancar-0'), lockedDie('trancar-1')]).toEqual([
      null,
      0,
      1,
    ]);
    expect([otherDie(0), otherDie(1)]).toEqual([1, 0]);
  });

  it('re-rolls only the unlocked die', () => {
    const dice: DicePair = [2, 6];
    expect(withDie(dice, 0, 5)).toEqual([5, 6]);
    expect(withDie(dice, 1, 3)).toEqual([2, 3]);
    expect(dice).toEqual([2, 6]);
  });

  it('charges 40% of the bet for a re-roll, rounded up to the cent', () => {
    expect(rerollFee(100, [2, 5], RULES)).toBe(40);
    expect(rerollFee(50, [2, 5], RULES)).toBe(20); // the smallest chip
    expect(rerollFee(25_000, [2, 5], RULES)).toBe(10_000); // the table maximum
    expect(rerollFee(51, [2, 5], RULES)).toBe(21); // 20.4¢ rounds up
    expect(rerollFee(55, [2, 5], RULES)).toBe(22); // exact on multiples of 5¢
    expect(paidRerollFee(100, RULES)).toBe(40); // whatever the roll
  });

  it('re-rolls 1-1 for free, when the rules say so', () => {
    expect(isFreeReroll([1, 1], RULES)).toBe(true);
    expect(rerollFee(100, [1, 1], RULES)).toBe(0);
    expect(isFreeReroll([1, 2], RULES)).toBe(false);
    expect(isFreeReroll([2, 2], RULES)).toBe(false);
    expect(isFreeReroll([1, 1], WITHOUT_FREE)).toBe(false);
    expect(rerollFee(100, [1, 1], WITHOUT_FREE)).toBe(40);
  });

  it('wins only on a strictly higher total: a tie goes to the house', () => {
    expect(trancarWins(8, 7)).toBe(true);
    expect(trancarWins(7, 7)).toBe(false);
    expect(trancarWins(2, 12)).toBe(false);
  });

  it('names a roll with the higher die first', () => {
    expect(rollLabel([2, 6])).toBe('6-2');
    expect(rollLabel([6, 2])).toBe('6-2');
    expect(rollLabel([3, 3])).toBe('3-3');
  });
});
