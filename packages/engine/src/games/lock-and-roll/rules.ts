/**
 * The rulebook of Lock & Roll as pure functions: the roll, the choice after it,
 * its price and the comparison with the dealer's two cards. No RNG, no
 * state. The game (game.ts) plays through these and the strategy
 * (strategy.ts) values every choice with them, so the rules exist once.
 */
import type { DicePair, DieFace } from '../../dice/dice.ts';
import type { Cents } from '../../game/money.ts';
import type { LockAndRollRules } from './config.ts';

/** The only bet: the dice's total against the dealer's two cards. */
export const LOCK_AND_ROLL_BET = 'lock-and-roll';
export type LockAndRollBetId = typeof LOCK_AND_ROLL_BET;

/** A die of the roll, by position: the first (0) or the second (1). */
export type DieIndex = 0 | 1;

/**
 * What the player may do once the dice have landed, exactly once a round:
 *  - 'stand': keep the roll;
 *  - 'lock-0', 'lock-1': lock that die and roll the other once more,
 *    for the Lock fee (lockFee), which is taken at once and never returned.
 *
 * EXTENSION POINT: "Lock & Double" (lock, re-roll and double the bet) is
 * not offered in this version. Adding it takes:
 *  1. the choices 'double-0' | 'double-1' here, understood by lockedDie();
 *  2. an option for each in lockAndRollOptions() (game.ts): it re-rolls like
 *     Lock and doubles the bet with `additionalStake: { betId:
 *     LOCK_AND_ROLL_BET, amount: stake }`, plus `fee` if the rules charge one; the
 *     round then settles the doubled stake by the same comparison;
 *  3. its value on each roll in rollValues() (strategy.ts): twice the
 *     re-roll's value, less the fee. The strategy, the declared figures and
 *     the game sheet then take it into account by themselves;
 *  4. a button on the table.
 */
export type LockAndRollChoice = 'stand' | `lock-${DieIndex}`;

/** The choice that locks die `index` and re-rolls the other. */
export function lockChoice(index: DieIndex): LockAndRollChoice {
  return index === 0 ? 'lock-0' : 'lock-1';
}

/** The die a choice locks, or null for Stand. */
export function lockedDie(choice: LockAndRollChoice): DieIndex | null {
  return choice === 'stand' ? null : choice === 'lock-0' ? 0 : 1;
}

/** The other die: the one a re-roll throws again when `index` is locked. */
export function otherDie(index: DieIndex): DieIndex {
  return index === 0 ? 1 : 0;
}

/** The roll after die `index` was thrown again and landed on `value`. */
export function withDie(dice: DicePair, index: DieIndex, value: DieFace): DicePair {
  return index === 0 ? [value, dice[1]] : [dice[0], value];
}

/** Whether a re-roll of this roll is free: 1-1, when the rules say so. */
export function isFreeReroll(dice: DicePair, rules: LockAndRollRules): boolean {
  return rules.freeOneOne && dice[0] === 1 && dice[1] === 1;
}

/**
 * The fee of a paid re-roll on a main bet of `stake` cents: the fee rate of
 * the stake, rounded up to the cent (exact on the table's chips, which are
 * multiples of 50 cents). The most a round takes beyond its bet.
 */
export function paidLockFee(stake: Cents, rules: LockAndRollRules): Cents {
  const { numerator, denominator } = rules.fee;
  return Math.ceil((stake * numerator) / denominator);
}

/** What a re-roll of `dice` costs on a main bet of `stake` cents: nothing on a free re-roll. */
export function lockFee(stake: Cents, dice: DicePair, rules: LockAndRollRules): Cents {
  return isFreeReroll(dice, rules) ? 0 : paidLockFee(stake, rules);
}

/** The bet wins when the dice add up to more than the dealer's two cards; a tie loses. */
export function lockAndRollWins(diceTotal: number, cardsTotal: number): boolean {
  return diceTotal > cardsTotal;
}

/** A roll as the strategy card names it, the higher die first: "6-2". */
export function rollLabel(dice: DicePair): string {
  const [a, b] = dice;
  return a >= b ? `${a}-${b}` : `${b}-${a}`;
}
