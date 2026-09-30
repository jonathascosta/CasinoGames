import { RANK_SETS } from '../../cards/card.ts';
import { Shoe, type CardSource } from '../../cards/shoe.ts';
import { EngineError } from '../../game/errors.ts';
import { summarizeMath } from '../../game/math-summary.ts';
import { startRound } from '../../game/round.ts';
import type { Game, MathSummary } from '../../game/types.ts';
import { MOVING_TARGET_BETS } from './bets.ts';
import { cardValue, resolveMovingTargetBet, targetOf } from './rules.ts';

export const MOVING_TARGET_ID = 'moving-target';
export const MOVING_TARGET_NAME = 'Moving Target';
/** The hand the cards are dealt to, in card-dealt events. */
export const MOVING_TARGET_DEALER = 'dealer';

/** No decisions and no game-private round data: start() settles the round. */
export type MovingTargetGame = Game<never, undefined>;

export interface MovingTargetOptions {
  /** Where the cards come from. Defaults to {@link createMovingTargetShoe}. */
  readonly source?: CardSource;
}

/** The table's shoe: six decks of aces to tens (240 cards), cut card at 25% remaining. */
export function createMovingTargetShoe(): Shoe {
  return new Shoe({ decks: 6, ranks: RANK_SETS.aceToTen });
}

/** The declared math of every bet, as shown in the paytable and the game sheet. */
export function movingTargetMathSummary(): MathSummary {
  return summarizeMath({
    id: MOVING_TARGET_ID,
    name: MOVING_TARGET_NAME,
    bets: MOVING_TARGET_BETS,
  });
}

/**
 * Moving Target, "moving target". The player places the bets and rolls two
 * dice, whose sum is the round's target; the dealer then deals cards face
 * up, adding them up, and stops as soon as the total reaches the target.
 * With no decisions after the bets, start() plays the whole round:
 *
 *   round-started → [shoe-shuffled] → dice-rolled → card-dealt × 1–12
 *   → bet-settled × bets → round-settled
 *
 * A round deals at most 12 cards (aces to a target of 12), far fewer than
 * the quarter of the shoe behind the cut card, so a round never runs out.
 *
 * Create one game per table; it owns the shoe, which persists across rounds.
 */
export function createMovingTarget(options: MovingTargetOptions = {}): MovingTargetGame {
  const source = options.source ?? createMovingTargetShoe();
  const game: MovingTargetGame = {
    id: MOVING_TARGET_ID,
    name: MOVING_TARGET_NAME,
    bets: MOVING_TARGET_BETS,
    start(bets, rng) {
      const round = startRound<never, undefined>(game, bets, rng);
      round.prepareCards(source);
      const target = targetOf(round.rollDice());
      const values: number[] = [];
      let total = 0;
      while (total < target) {
        const value = cardValue(round.dealCard(source, MOVING_TARGET_DEALER).rank);
        values.push(value);
        total += value;
      }
      for (const { id } of MOVING_TARGET_BETS) {
        if (!round.isPlaced(id)) continue;
        const result = resolveMovingTargetBet(id, target, values);
        if (result.outcome === 'win') round.win(id, result.odds, result.entryId);
        else round.lose(id);
      }
      return round.finish(undefined);
    },
    decide() {
      throw new EngineError('NOT_AWAITING_DECISION', 'Moving Target rounds never await a decision');
    },
    mathSummary: movingTargetMathSummary,
  };
  return game;
}
