import { RANK_SETS, cardLabel } from '../../cards/card.ts';
import { Shoe, type CardSource } from '../../cards/shoe.ts';
import { EngineError } from '../../game/errors.ts';
import { summarizeMath } from '../../game/math-summary.ts';
import { startRound } from '../../game/round.ts';
import type { Game, MathSummary } from '../../game/types.ts';
import { DICE_SPREAD_BETS } from './bets.ts';
import { resolveDiceSpreadBet } from './rules.ts';

export const DICE_SPREAD_ID = 'dice-spread';
export const DICE_SPREAD_NAME = 'Dice Spread';
/** The hand the card is dealt to, in card-dealt and card-revealed events. */
export const DICE_SPREAD_DEALER = 'dealer';

/** No decisions and no game-private round data: start() settles the round. */
export type DiceSpreadGame = Game<never, undefined>;

export interface DiceSpreadOptions {
  /** Where the cards come from. Defaults to {@link createDiceSpreadShoe}. */
  readonly source?: CardSource;
}

/** The table's shoe: six decks of aces to sixes (144 cards), cut card at 25% remaining. */
export function createDiceSpreadShoe(): Shoe {
  return new Shoe({ decks: 6, ranks: RANK_SETS.aceToSix });
}

/** The declared math of every bet, as shown in the paytable and the Math Report. */
export function diceSpreadMathSummary(): MathSummary {
  return summarizeMath({ id: DICE_SPREAD_ID, name: DICE_SPREAD_NAME, bets: DICE_SPREAD_BETS });
}

/**
 * Dice Spread, "between the dice". The player places the bets and rolls two
 * dice, the dealer deals one card, and every bet settles on that roll and
 * card. With no decisions after the bets, start() plays the whole round:
 *
 *   round-started → [shoe-shuffled] → dice-rolled → card-dealt (face down)
 *   → card-revealed → bet-settled × bets → round-settled
 *
 * The card is dealt face down and then revealed, as the table presents it:
 * the UI shows the winning range between the two events.
 *
 * Create one game per table; it owns the shoe, which persists across rounds.
 */
export function createDiceSpread(options: DiceSpreadOptions = {}): DiceSpreadGame {
  const source = options.source ?? createDiceSpreadShoe();
  const game: DiceSpreadGame = {
    id: DICE_SPREAD_ID,
    name: DICE_SPREAD_NAME,
    bets: DICE_SPREAD_BETS,
    start(bets, rng) {
      const round = startRound<never, undefined>(game, bets, rng);
      round.prepareCards(source);
      const dice = round.rollDice();
      const card = round.dealCard(source, DICE_SPREAD_DEALER, false);
      if (card.rank > 6) {
        throw new RangeError(`Dice Spread deals aces to sixes, got ${cardLabel(card)}`);
      }
      round.revealCard(DICE_SPREAD_DEALER, 0, card);
      for (const { id } of DICE_SPREAD_BETS) {
        if (!round.isPlaced(id)) continue;
        const result = resolveDiceSpreadBet(id, dice, card.rank);
        if (result.outcome === 'win') round.win(id, result.odds, result.entryId);
        else if (result.outcome === 'push') round.push(id, result.entryId);
        else round.lose(id);
      }
      return round.finish(undefined);
    },
    decide() {
      throw new EngineError('NOT_AWAITING_DECISION', 'Dice Spread rounds never await a decision');
    },
    mathSummary: diceSpreadMathSummary,
  };
  return game;
}
