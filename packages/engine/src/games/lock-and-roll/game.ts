import { RANK_SETS, cardLabel } from '../../cards/card.ts';
import { Shoe, type CardSource } from '../../cards/shoe.ts';
import { diceTotal, rollDie, type DicePair, type DieFace } from '../../dice/dice.ts';
import { summarizeMath } from '../../game/math-summary.ts';
import type { Cents } from '../../game/money.ts';
import type { Strategy } from '../../game/play.ts';
import { continueRound, startRound } from '../../game/round.ts';
import type { DecisionOption, Game, MathSummary, RoundState } from '../../game/types.ts';
import { LOCK_AND_ROLL_BETS, LOCK_AND_ROLL_DECISIONS } from './bets.ts';
import { LOCK_AND_ROLL_CONFIG, type LockAndRollRules } from './config.ts';
import {
  LOCK_AND_ROLL_BET,
  lockChoice,
  lockedDie,
  otherDie,
  lockFee,
  lockAndRollWins,
  withDie,
  type DieIndex,
  type LockAndRollChoice,
} from './rules.ts';
import { referenceStrategy } from './strategy.ts';

export const LOCK_AND_ROLL_ID = 'lock-and-roll';
export const LOCK_AND_ROLL_NAME = 'Lock & Roll';
/** The hand the cards are dealt to, in card-dealt events. */
export const LOCK_AND_ROLL_DEALER = 'dealer';

/**
 * The unlocked die thrown again after a Lock: its position in the roll, the
 * face it landed on and the roll it makes with the locked die.
 */
export interface DieRerolledEvent {
  readonly type: 'die-rerolled';
  readonly index: DieIndex;
  readonly value: DieFace;
  readonly dice: DicePair;
}

/** The roll: the one the decision is made on, then, once settled, the one that played. */
export interface LockAndRollData {
  readonly dice: DicePair;
}

export type LockAndRollState = RoundState<LockAndRollChoice, LockAndRollData, DieRerolledEvent>;

export type LockAndRollGame = Game<LockAndRollChoice, LockAndRollData, DieRerolledEvent> & {
  /** The re-roll's rules this table plays. */
  readonly rules: LockAndRollRules;
};

export interface LockAndRollOptions {
  /** Where the dealer's cards come from. Defaults to {@link createLockAndRollShoe}. */
  readonly source?: CardSource;
  /** The re-roll's rules. Defaults to the table's, LOCK_AND_ROLL_CONFIG.rules. */
  readonly rules?: LockAndRollRules;
}

/** The table's shoe: six decks of aces to sixes (144 cards), cut card at 25% remaining. */
export function createLockAndRollShoe(): Shoe {
  return new Shoe({ decks: LOCK_AND_ROLL_CONFIG.decks, ranks: RANK_SETS.aceToSix });
}

/** The declared math, the strategy card included, as shown in the paytable and the game sheet. */
export function lockAndRollMathSummary(): MathSummary {
  return summarizeMath({
    id: LOCK_AND_ROLL_ID,
    name: LOCK_AND_ROLL_NAME,
    bets: LOCK_AND_ROLL_BETS,
    finiteShoe: `${String(LOCK_AND_ROLL_CONFIG.decks)}-deck shoe`,
    decisions: LOCK_AND_ROLL_DECISIONS,
  });
}

/**
 * What the player may choose after `dice` on a bet of `stake` cents: Stand,
 * or Lock with either die locked. Both Lock options carry the Lock fee, charged
 * when chosen (none on a free re-roll).
 */
export function lockAndRollOptions(
  dice: DicePair,
  stake: Cents,
  rules: LockAndRollRules,
): DecisionOption<LockAndRollChoice>[] {
  const fee = lockFee(stake, dice, rules);
  const lock = (index: DieIndex): DecisionOption<LockAndRollChoice> => ({
    choice: lockChoice(index),
    label: `Lock the ${String(dice[index])}, re-roll the ${String(dice[otherDie(index)])}`,
    ...(fee === 0 ? {} : { fee: { betId: LOCK_AND_ROLL_BET, amount: fee } }),
  });
  // Extension point: "Lock & Double" would add its options here (see LockAndRollChoice).
  return [{ choice: 'stand', label: 'Stand' }, lock(0), lock(1)];
}

/**
 * The reference strategy as a player (the best choice on every roll): what
 * autoplay, the simulations and the exact tests play.
 */
export function lockAndRollStrategy(
  rules: LockAndRollRules = LOCK_AND_ROLL_CONFIG.rules,
): Strategy<LockAndRollChoice, LockAndRollData, DieRerolledEvent> {
  const choose = referenceStrategy(rules);
  return (state) => choose(state.data.dice);
}

/**
 * Lock & Roll. The player bets and rolls two dice, then decides once: Stand,
 * or Lock (keep one die and roll the other once more, for the Lock fee of
 * 40% of the bet, free on 1-1). The dealer then deals two cards, and
 * the bet wins 1 to 1 if the dice add up to more; a tie loses.
 *
 *   start():  round-started → [shoe-shuffled] → dice-rolled
 *             → decision-requested (phase 'awaiting-decision')
 *   decide(): decision-made → [fee-charged → die-rerolled]
 *             → card-dealt × 2 (face up) → bet-settled → round-settled
 *
 * Create one game per table; it owns the shoe, which persists across rounds.
 */
export function createLockAndRoll(options: LockAndRollOptions = {}): LockAndRollGame {
  const source = options.source ?? createLockAndRollShoe();
  const rules = options.rules ?? LOCK_AND_ROLL_CONFIG.rules;
  const game: LockAndRollGame = {
    id: LOCK_AND_ROLL_ID,
    name: LOCK_AND_ROLL_NAME,
    bets: LOCK_AND_ROLL_BETS,
    rules,
    start(bets, rng) {
      const round = startRound<LockAndRollChoice, LockAndRollData, DieRerolledEvent>(
        game,
        bets,
        rng,
      );
      round.prepareCards(source);
      const dice = round.rollDice();
      return round.awaitDecision(
        lockAndRollOptions(dice, round.stakeOf(LOCK_AND_ROLL_BET), rules),
        {
          dice,
        },
      );
    },
    decide(state, choice) {
      // Records the choice and charges its fee, if it has one.
      const round = continueRound(state, choice);
      let dice = state.data.dice;
      const locked = lockedDie(choice);
      if (locked !== null) {
        const index = otherDie(locked);
        const value = rollDie(round.rng);
        dice = withDie(dice, index, value);
        round.emit({ type: 'die-rerolled', index, value, dice });
      }
      const first = round.dealCard(source, LOCK_AND_ROLL_DEALER);
      const second = round.dealCard(source, LOCK_AND_ROLL_DEALER);
      for (const card of [first, second]) {
        if (card.rank > 6) {
          throw new RangeError(`Lock & Roll deals aces to sixes, got ${cardLabel(card)}`);
        }
      }
      if (lockAndRollWins(diceTotal(dice), first.rank + second.rank)) {
        round.win(LOCK_AND_ROLL_BET, LOCK_AND_ROLL_CONFIG.odds, 'higher');
      } else {
        round.lose(LOCK_AND_ROLL_BET);
      }
      return round.finish({ dice });
    },
    mathSummary: lockAndRollMathSummary,
  };
  return game;
}
