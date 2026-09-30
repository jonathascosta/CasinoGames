import { RANK_SETS, cardLabel } from '../../cards/card.ts';
import { Shoe, type CardSource } from '../../cards/shoe.ts';
import { EngineError } from '../../game/errors.ts';
import { summarizeMath } from '../../game/math-summary.ts';
import { startRound } from '../../game/round.ts';
import type { Game, MathSummary } from '../../game/types.ts';
import { ENTRE_DADOS_BETS } from './bets.ts';
import { resolveEntreDadosBet } from './rules.ts';

export const ENTRE_DADOS_ID = 'entre-dados';
export const ENTRE_DADOS_NAME = 'Entre Dados';
/** The hand the card is dealt to, in card-dealt and card-revealed events. */
export const ENTRE_DADOS_DEALER = 'dealer';

/** No decisions and no game-private round data: start() settles the round. */
export type EntreDadosGame = Game<never, undefined>;

export interface EntreDadosOptions {
  /** Where the cards come from. Defaults to {@link createEntreDadosShoe}. */
  readonly source?: CardSource;
}

/** The table's shoe: six decks of aces to sixes (144 cards), cut card at 25% remaining. */
export function createEntreDadosShoe(): Shoe {
  return new Shoe({ decks: 6, ranks: RANK_SETS.aceToSix });
}

/** The declared math of every bet, as shown in the paytable and the game sheet. */
export function entreDadosMathSummary(): MathSummary {
  return summarizeMath({ id: ENTRE_DADOS_ID, name: ENTRE_DADOS_NAME, bets: ENTRE_DADOS_BETS });
}

/**
 * Entre Dados, "between the dice". The player places the bets and rolls two
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
export function createEntreDados(options: EntreDadosOptions = {}): EntreDadosGame {
  const source = options.source ?? createEntreDadosShoe();
  const game: EntreDadosGame = {
    id: ENTRE_DADOS_ID,
    name: ENTRE_DADOS_NAME,
    bets: ENTRE_DADOS_BETS,
    start(bets, rng) {
      const round = startRound<never, undefined>(game, bets, rng);
      round.prepareCards(source);
      const dice = round.rollDice();
      const card = round.dealCard(source, ENTRE_DADOS_DEALER, false);
      if (card.rank > 6) {
        throw new RangeError(`Entre Dados deals aces to sixes, got ${cardLabel(card)}`);
      }
      round.revealCard(ENTRE_DADOS_DEALER, 0, card);
      for (const { id } of ENTRE_DADOS_BETS) {
        if (!round.isPlaced(id)) continue;
        const result = resolveEntreDadosBet(id, dice, card.rank);
        if (result.outcome === 'win') round.win(id, result.odds, result.entryId);
        else if (result.outcome === 'push') round.push(id, result.entryId);
        else round.lose(id);
      }
      return round.finish(undefined);
    },
    decide() {
      throw new EngineError('NOT_AWAITING_DECISION', 'Entre Dados rounds never await a decision');
    },
    mathSummary: entreDadosMathSummary,
  };
  return game;
}
