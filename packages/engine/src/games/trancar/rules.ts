/**
 * The rulebook of Trancar as pure functions: the roll, the choice after it,
 * its price and the comparison with the dealer's two cards. No RNG, no
 * state. The game (game.ts) plays through these and the strategy
 * (strategy.ts) values every choice with them, so the rules exist once.
 */
import type { DicePair, DieFace } from '../../dice/dice.ts';
import type { Cents } from '../../game/money.ts';
import type { TrancarRules } from './config.ts';

/** The only bet: the dice's total against the dealer's two cards. */
export const TRANCAR_BET = 'trancar';
export type TrancarBetId = typeof TRANCAR_BET;

/** A die of the roll, by position: the first (0) or the second (1). */
export type DieIndex = 0 | 1;

/**
 * What the player may do once the dice have landed, exactly once a round:
 *  - 'ficar' (stand): keep the roll;
 *  - 'trancar-0', 'trancar-1': lock that die and roll the other once more,
 *    for the fee (rerollFee), which is taken at once and never returned.
 *
 * EXTENSION POINT: "Trancar e Dobrar" (lock, re-roll and double the bet) is
 * not offered in this version. Adding it takes:
 *  1. the choices 'dobrar-0' | 'dobrar-1' here, understood by lockedDie();
 *  2. an option for each in trancarOptions() (game.ts): it re-rolls like
 *     Trancar and doubles the bet with `additionalStake: { betId:
 *     TRANCAR_BET, amount: stake }`, plus `fee` if the rules charge one; the
 *     round then settles the doubled stake by the same comparison;
 *  3. its value on each roll in rollValues() (strategy.ts): twice the
 *     re-roll's value, less the fee. The strategy, the declared figures and
 *     the game sheet then take it into account by themselves;
 *  4. a button on the table.
 */
export type TrancarChoice = 'ficar' | `trancar-${DieIndex}`;

/** The choice that locks die `index` and re-rolls the other. */
export function lockChoice(index: DieIndex): TrancarChoice {
  return index === 0 ? 'trancar-0' : 'trancar-1';
}

/** The die a choice locks, or null for Ficar. */
export function lockedDie(choice: TrancarChoice): DieIndex | null {
  return choice === 'ficar' ? null : choice === 'trancar-0' ? 0 : 1;
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
export function isFreeReroll(dice: DicePair, rules: TrancarRules): boolean {
  return rules.freeOneOne && dice[0] === 1 && dice[1] === 1;
}

/**
 * What a re-roll of `dice` costs on a main bet of `stake` cents: the fee
 * rate of the stake, rounded up to the cent (exact on the table's chips,
 * which are multiples of 50 cents), or nothing on a free re-roll.
 */
export function rerollFee(stake: Cents, dice: DicePair, rules: TrancarRules): Cents {
  if (isFreeReroll(dice, rules)) return 0;
  const { numerator, denominator } = rules.fee;
  return Math.ceil((stake * numerator) / denominator);
}

/** The bet wins when the dice add up to more than the dealer's two cards; a tie loses. */
export function trancarWins(diceTotal: number, cardsTotal: number): boolean {
  return diceTotal > cardsTotal;
}

/** A roll as the strategy card names it, the higher die first: "6-2". */
export function rollLabel(dice: DicePair): string {
  const [a, b] = dice;
  return a >= b ? `${a}-${b}` : `${b}-${a}`;
}
