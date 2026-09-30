import { RANK_SETS, cardLabel } from '../../cards/card.ts';
import { Shoe, type CardSource } from '../../cards/shoe.ts';
import { EngineError } from '../../game/errors.ts';
import { summarizeMath } from '../../game/math-summary.ts';
import { winnings, type Cents } from '../../game/money.ts';
import { startRound } from '../../game/round.ts';
import type { Game, MathSummary } from '../../game/types.ts';
import { ProgressiveJackpot, type ProgressiveState } from '../../progressive/progressive.ts';
import { MIRROR_BETS } from './bets.ts';
import { MIRROR_CONFIG } from './config.ts';
import { MIRROR_BET_IDS, JACKPOT_BET, resolveMirrorBet } from './rules.ts';

export const MIRROR_ID = 'mirror';
export const MIRROR_NAME = 'Mirror';
/** The hand the cards are dealt to, in card-dealt and card-revealed events. */
export const MIRROR_DEALER = 'dealer';

/**
 * The meter's value after it changed: a stake on Double Sixes fed it
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
export type MirrorGame = Game<never, undefined, JackpotMeterEvent> & {
  /** The table's progressive meter, which persists across rounds. */
  readonly jackpot: ProgressiveJackpot;
};

export interface MirrorOptions {
  /** Where the cards come from. Defaults to {@link createMirrorShoe}. */
  readonly source?: CardSource;
  /** The meter. Defaults to a new one at its seed ({@link createMirrorJackpot}). */
  readonly jackpot?: ProgressiveJackpot;
}

/** The table's shoe: six decks of aces to sixes (144 cards), cut card at 25% remaining. */
export function createMirrorShoe(): Shoe {
  return new Shoe({ decks: MIRROR_CONFIG.decks, ranks: RANK_SETS.aceToSix });
}

/** The progressive meter, at its seed or carrying on from a stored state. */
export function createMirrorJackpot(state?: ProgressiveState): ProgressiveJackpot {
  const { id, seed, contributionRate } = MIRROR_CONFIG.jackpot;
  return new ProgressiveJackpot({ id, seed, contributionRate }, state);
}

/** The declared math of every bet, as shown in the paytable and the game sheet. */
export function mirrorMathSummary(): MathSummary {
  return summarizeMath({
    id: MIRROR_ID,
    name: MIRROR_NAME,
    bets: MIRROR_BETS,
    finiteShoe: `${MIRROR_CONFIG.decks}-deck shoe`,
  });
}

/**
 * Mirror, "mirror". The player places the bets and rolls two dice, the
 * dealer deals two cards, and the two hands are compared: every bet settles
 * on them. With no decisions after the bets, start() plays the whole round:
 *
 *   round-started → [jackpot-meter] → [shoe-shuffled] → dice-rolled
 *   → card-dealt × 2 (face down) → card-revealed × 2
 *   → bet-settled × bets (a Double Sixes hit adds jackpot-won and jackpot-meter)
 *   → round-settled
 *
 * A stake on Double Sixes feeds the meter as the bet is accepted. A hit pays
 * 1000 to 1 plus stake ÷ SIDE_MAX of the meter, rounded down to the cent;
 * the meter keeps the rest and is topped back up to its seed if it fell
 * below.
 *
 * Create one game per table; it owns the shoe and the meter, which persist
 * across rounds.
 */
export function createMirror(options: MirrorOptions = {}): MirrorGame {
  const source = options.source ?? createMirrorShoe();
  const jackpot = options.jackpot ?? createMirrorJackpot();
  const meter = (cause: JackpotMeterEvent['cause']): JackpotMeterEvent => ({
    type: 'jackpot-meter',
    jackpotId: jackpot.id,
    amount: jackpot.amount,
    cause,
  });
  const game: MirrorGame = {
    id: MIRROR_ID,
    name: MIRROR_NAME,
    bets: MIRROR_BETS,
    jackpot,
    start(bets, rng) {
      const round = startRound<never, undefined, JackpotMeterEvent>(game, bets, rng);
      if (round.isPlaced(JACKPOT_BET)) {
        jackpot.contribute(round.stakeOf(JACKPOT_BET));
        round.emit(meter('contribution'));
      }
      round.prepareCards(source);
      const dice = round.rollDice();
      const first = round.dealCard(source, MIRROR_DEALER, false);
      const second = round.dealCard(source, MIRROR_DEALER, false);
      for (const card of [first, second]) {
        if (card.rank > 6) {
          throw new RangeError(`Mirror deals aces to sixes, got ${cardLabel(card)}`);
        }
      }
      round.revealCard(MIRROR_DEALER, 0, first);
      round.revealCard(MIRROR_DEALER, 1, second);
      const cards = [first.rank, second.rank] as const;

      for (const id of MIRROR_BET_IDS) {
        if (!round.isPlaced(id)) continue;
        const result = resolveMirrorBet(id, dice, cards);
        if (result.outcome === 'lose') {
          round.lose(id);
        } else if (!result.meter) {
          round.win(id, result.odds, result.entryId);
        } else {
          const stake = round.stakeOf(id);
          const share = jackpot.awardFraction(stake, MIRROR_CONFIG.sideMax);
          if (share > 0)
            round.emit({ type: 'jackpot-won', jackpotId: jackpot.id, betId: id, amount: share });
          round.payout(id, stake + winnings(stake, result.odds) + share, result.entryId);
          round.emit(meter('award'));
        }
      }
      return round.finish(undefined);
    },
    decide() {
      throw new EngineError('NOT_AWAITING_DECISION', 'Mirror rounds never await a decision');
    },
    mathSummary: mirrorMathSummary,
  };
  return game;
}
