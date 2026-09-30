import { RANK_SETS, cardLabel } from '../../cards/card.ts';
import { Shoe, type CardSource } from '../../cards/shoe.ts';
import { EngineError } from '../../game/errors.ts';
import { summarizeMath } from '../../game/math-summary.ts';
import { winnings, type Cents } from '../../game/money.ts';
import { startRound } from '../../game/round.ts';
import type { Game, MathSummary } from '../../game/types.ts';
import { ProgressiveJackpot, type ProgressiveState } from '../../progressive/progressive.ts';
import { ESPELHO_BETS } from './bets.ts';
import { ESPELHO_CONFIG } from './config.ts';
import { ESPELHO_BET_IDS, JACKPOT_BET, resolveEspelhoBet } from './rules.ts';

export const ESPELHO_ID = 'espelho';
export const ESPELHO_NAME = 'Espelho';
/** The hand the cards are dealt to, in card-dealt and card-revealed events. */
export const ESPELHO_DEALER = 'dealer';

/**
 * The meter's value after it changed: a stake on 6-6 vs 6-6 fed it
 * (`contribution`) or a hit was paid from it (`award`, after any top-up to
 * the seed). The table moves its meter display on these.
 */
export interface JackpotMeterEvent {
  readonly type: 'jackpot-meter';
  readonly jackpotId: string;
  /** The meter in whole cents. */
  readonly amount: Cents;
  readonly cause: 'contribution' | 'award';
}

/** No decisions and no game-private round data: start() settles the round. */
export type EspelhoGame = Game<never, undefined, JackpotMeterEvent> & {
  /** The table's progressive meter, which persists across rounds. */
  readonly jackpot: ProgressiveJackpot;
};

export interface EspelhoOptions {
  /** Where the cards come from. Defaults to {@link createEspelhoShoe}. */
  readonly source?: CardSource;
  /** The meter. Defaults to a new one at its seed ({@link createEspelhoJackpot}). */
  readonly jackpot?: ProgressiveJackpot;
}

/** The table's shoe: six decks of aces to sixes (144 cards), cut card at 25% remaining. */
export function createEspelhoShoe(): Shoe {
  return new Shoe({ decks: ESPELHO_CONFIG.decks, ranks: RANK_SETS.aceToSix });
}

/** The progressive meter, at its seed or carrying on from a stored state. */
export function createEspelhoJackpot(state?: ProgressiveState): ProgressiveJackpot {
  const { id, seed, contributionRate } = ESPELHO_CONFIG.jackpot;
  return new ProgressiveJackpot({ id, seed, contributionRate }, state);
}

/** The declared math of every bet, as shown in the paytable and the game sheet. */
export function espelhoMathSummary(): MathSummary {
  return summarizeMath({
    id: ESPELHO_ID,
    name: ESPELHO_NAME,
    bets: ESPELHO_BETS,
    finiteShoe: `${ESPELHO_CONFIG.decks}-deck shoe`,
  });
}

/**
 * Espelho, "mirror". The player places the bets and rolls two dice, the
 * dealer deals two cards, and the two hands are compared: every bet settles
 * on them. With no decisions after the bets, start() plays the whole round:
 *
 *   round-started → [jackpot-meter] → [shoe-shuffled] → dice-rolled
 *   → card-dealt × 2 (face down) → card-revealed × 2
 *   → bet-settled × bets (a 6-6 vs 6-6 hit adds jackpot-won and jackpot-meter)
 *   → round-settled
 *
 * A stake on 6-6 vs 6-6 feeds the meter as the bet is accepted. A hit pays
 * 1000 to 1 plus stake ÷ SIDE_MAX of the meter, rounded down to the cent;
 * the meter keeps the rest and is topped back up to its seed if it fell
 * below.
 *
 * Create one game per table; it owns the shoe and the meter, which persist
 * across rounds.
 */
export function createEspelho(options: EspelhoOptions = {}): EspelhoGame {
  const source = options.source ?? createEspelhoShoe();
  const jackpot = options.jackpot ?? createEspelhoJackpot();
  const meter = (cause: JackpotMeterEvent['cause']): JackpotMeterEvent => ({
    type: 'jackpot-meter',
    jackpotId: jackpot.id,
    amount: jackpot.amount,
    cause,
  });
  const game: EspelhoGame = {
    id: ESPELHO_ID,
    name: ESPELHO_NAME,
    bets: ESPELHO_BETS,
    jackpot,
    start(bets, rng) {
      const round = startRound<never, undefined, JackpotMeterEvent>(game, bets, rng);
      if (round.isPlaced(JACKPOT_BET)) {
        jackpot.contribute(round.stakeOf(JACKPOT_BET));
        round.emit(meter('contribution'));
      }
      round.prepareCards(source);
      const dice = round.rollDice();
      const first = round.dealCard(source, ESPELHO_DEALER, false);
      const second = round.dealCard(source, ESPELHO_DEALER, false);
      for (const card of [first, second]) {
        if (card.rank > 6) {
          throw new RangeError(`Espelho deals aces to sixes, got ${cardLabel(card)}`);
        }
      }
      round.revealCard(ESPELHO_DEALER, 0, first);
      round.revealCard(ESPELHO_DEALER, 1, second);
      const cards = [first.rank, second.rank] as const;

      for (const id of ESPELHO_BET_IDS) {
        if (!round.isPlaced(id)) continue;
        const result = resolveEspelhoBet(id, dice, cards);
        if (result.outcome === 'lose') {
          round.lose(id);
        } else if (!result.meter) {
          round.win(id, result.odds, result.entryId);
        } else {
          const stake = round.stakeOf(id);
          const share = jackpot.awardFraction(stake, ESPELHO_CONFIG.sideMax);
          if (share > 0)
            round.emit({ type: 'jackpot-won', jackpotId: jackpot.id, betId: id, amount: share });
          round.payout(id, stake + winnings(stake, result.odds) + share, result.entryId);
          round.emit(meter('award'));
        }
      }
      return round.finish(undefined);
    },
    decide() {
      throw new EngineError('NOT_AWAITING_DECISION', 'Espelho rounds never await a decision');
    },
    mathSummary: espelhoMathSummary,
  };
  return game;
}
