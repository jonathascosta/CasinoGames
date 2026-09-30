import { RANK_SETS, cardLabel } from '../../cards/card.ts';
import { Shoe, type CardSource } from '../../cards/shoe.ts';
import { diceTotal, rollDie, type DicePair, type DieFace } from '../../dice/dice.ts';
import { summarizeMath } from '../../game/math-summary.ts';
import type { Cents } from '../../game/money.ts';
import type { Strategy } from '../../game/play.ts';
import { continueRound, startRound } from '../../game/round.ts';
import type { DecisionOption, Game, MathSummary, RoundState } from '../../game/types.ts';
import { TRANCAR_BETS, TRANCAR_DECISIONS } from './bets.ts';
import { TRANCAR_CONFIG, type TrancarRules } from './config.ts';
import {
  TRANCAR_BET,
  lockChoice,
  lockedDie,
  otherDie,
  rerollFee,
  trancarWins,
  withDie,
  type DieIndex,
  type TrancarChoice,
} from './rules.ts';
import { referenceStrategy } from './strategy.ts';

export const TRANCAR_ID = 'trancar';
export const TRANCAR_NAME = 'Trancar';
/** The hand the cards are dealt to, in card-dealt events. */
export const TRANCAR_DEALER = 'dealer';

/**
 * The unlocked die thrown again after Trancar: its position in the roll, the
 * face it landed on and the roll it makes with the locked die.
 */
export interface DieRerolledEvent {
  readonly type: 'die-rerolled';
  readonly index: DieIndex;
  readonly value: DieFace;
  readonly dice: DicePair;
}

/** The roll: the one the decision is made on, then, once settled, the one that played. */
export interface TrancarData {
  readonly dice: DicePair;
}

export type TrancarState = RoundState<TrancarChoice, TrancarData, DieRerolledEvent>;

export type TrancarGame = Game<TrancarChoice, TrancarData, DieRerolledEvent> & {
  /** The re-roll's rules this table plays. */
  readonly rules: TrancarRules;
};

export interface TrancarOptions {
  /** Where the dealer's cards come from. Defaults to {@link createTrancarShoe}. */
  readonly source?: CardSource;
  /** The re-roll's rules. Defaults to the table's, TRANCAR_CONFIG.rules. */
  readonly rules?: TrancarRules;
}

/** The table's shoe: six decks of aces to sixes (144 cards), cut card at 25% remaining. */
export function createTrancarShoe(): Shoe {
  return new Shoe({ decks: TRANCAR_CONFIG.decks, ranks: RANK_SETS.aceToSix });
}

/** The declared math, the strategy card included, as shown in the paytable and the game sheet. */
export function trancarMathSummary(): MathSummary {
  return summarizeMath({
    id: TRANCAR_ID,
    name: TRANCAR_NAME,
    bets: TRANCAR_BETS,
    finiteShoe: `${String(TRANCAR_CONFIG.decks)}-deck shoe`,
    decisions: TRANCAR_DECISIONS,
  });
}

/**
 * What the player may choose after `dice` on a bet of `stake` cents: Ficar,
 * or Trancar locking either die. Both Trancar options carry the fee, charged
 * when chosen (none on a free re-roll).
 */
export function trancarOptions(
  dice: DicePair,
  stake: Cents,
  rules: TrancarRules,
): DecisionOption<TrancarChoice>[] {
  const fee = rerollFee(stake, dice, rules);
  const lock = (index: DieIndex): DecisionOption<TrancarChoice> => ({
    choice: lockChoice(index),
    label: `Lock the ${String(dice[index])}, re-roll the ${String(dice[otherDie(index)])}`,
    ...(fee === 0 ? {} : { fee: { betId: TRANCAR_BET, amount: fee } }),
  });
  // Extension point: "Trancar e Dobrar" would add its options here (see TrancarChoice).
  return [{ choice: 'ficar', label: 'Ficar' }, lock(0), lock(1)];
}

/**
 * The reference strategy as a player (the best choice on every roll): what
 * autoplay, the simulations and the exact tests play.
 */
export function trancarStrategy(
  rules: TrancarRules = TRANCAR_CONFIG.rules,
): Strategy<TrancarChoice, TrancarData, DieRerolledEvent> {
  const choose = referenceStrategy(rules);
  return (state) => choose(state.data.dice);
}

/**
 * Trancar, "lock it". The player bets and rolls two dice, then decides once:
 * Ficar (stand) or Trancar (lock one die and roll the other once more, for a
 * fee of 40% of the bet, free on 1-1). The dealer then deals two cards, and
 * the bet wins 1 to 1 if the dice add up to more; a tie loses.
 *
 *   start():  round-started → [shoe-shuffled] → dice-rolled
 *             → decision-requested (phase 'awaiting-decision')
 *   decide(): decision-made → [fee-charged → die-rerolled]
 *             → card-dealt × 2 (face up) → bet-settled → round-settled
 *
 * Create one game per table; it owns the shoe, which persists across rounds.
 */
export function createTrancar(options: TrancarOptions = {}): TrancarGame {
  const source = options.source ?? createTrancarShoe();
  const rules = options.rules ?? TRANCAR_CONFIG.rules;
  const game: TrancarGame = {
    id: TRANCAR_ID,
    name: TRANCAR_NAME,
    bets: TRANCAR_BETS,
    rules,
    start(bets, rng) {
      const round = startRound<TrancarChoice, TrancarData, DieRerolledEvent>(game, bets, rng);
      round.prepareCards(source);
      const dice = round.rollDice();
      return round.awaitDecision(trancarOptions(dice, round.stakeOf(TRANCAR_BET), rules), {
        dice,
      });
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
      const first = round.dealCard(source, TRANCAR_DEALER);
      const second = round.dealCard(source, TRANCAR_DEALER);
      for (const card of [first, second]) {
        if (card.rank > 6) {
          throw new RangeError(`Trancar deals aces to sixes, got ${cardLabel(card)}`);
        }
      }
      if (trancarWins(diceTotal(dice), first.rank + second.rank)) {
        round.win(TRANCAR_BET, TRANCAR_CONFIG.odds, 'higher');
      } else {
        round.lose(TRANCAR_BET);
      }
      return round.finish({ dice });
    },
    mathSummary: trancarMathSummary,
  };
  return game;
}
