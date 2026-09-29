import type { Card } from '../cards/card.ts';
import type { DicePair } from '../dice/dice.ts';
import type { Rng } from '../rng/rng.ts';
import type { Cents, Odds } from './money.ts';
import type { Settlement, SettlementLine } from './settlement.ts';

export type BetId = string;

/** Stakes per bet id, in cents. A missing or zero entry means "not placed". */
export type Bets = Readonly<Record<BetId, Cents>>;

export type BetKind = 'main' | 'side';

/** A progressive payout: `share` of the named jackpot pool. */
export interface JackpotPayout {
  readonly jackpotId: string;
  /** Fraction of the pool awarded, in (0, 1]. */
  readonly share: number;
}

interface PaytableEntryBase {
  /** Stable id, echoed in SettlementLine.entryId when this entry decides a bet. */
  readonly id: string;
  readonly label: string;
  /** Exact probability per round, when the game is enumerable. */
  readonly probability?: number;
}

/** One line of a bet's paytable: fixed odds or a progressive jackpot. */
export type PaytableEntry = PaytableEntryBase &
  ({ readonly odds: Odds } | { readonly jackpot: JackpotPayout });

/**
 * Everything the UI, docs and simulations need to know about a bet. The
 * paytable modal and the game sheets are generated from this, never typed by
 * hand.
 */
export interface BetDefinition {
  readonly id: BetId;
  readonly label: string;
  readonly kind: BetKind;
  /** Table limits, in cents. */
  readonly min: Cents;
  readonly max: Cents;
  readonly paytable: readonly PaytableEntry[];
  /**
   * Declared return to player: the long-run total returned ÷ total wagered
   * on this bet (additional stakes made during a round included). The house
   * edge is 1 − rtp. Proven by each game's exact and Monte Carlo tests.
   */
  readonly rtp: number;
  /**
   * Standard deviation of the return per unit staked, when known. Lets the
   * RTP panel show the band the live figure is expected to converge within.
   */
  readonly standardDeviation?: number;
  readonly description?: string;
}

/** A choice offered to the player while a round awaits a decision. */
export interface DecisionOption<TChoice extends string = string> {
  readonly choice: TChoice;
  readonly label: string;
  /** A stake the choice commits (e.g. a raise); taken when it is chosen. */
  readonly additionalStake?: { readonly betId: BetId; readonly amount: Cents };
}

/**
 * The replayable record of a round. The UI animates these in order; a server
 * would persist them as the audit trail. Cards dealt face down are included
 * here, so a server must redact them from what it sends to the client until
 * the matching `card-revealed` event.
 */
export type GameEvent =
  | { readonly type: 'round-started'; readonly bets: Bets }
  | { readonly type: 'shoe-shuffled'; readonly cards: number }
  | { readonly type: 'dice-rolled'; readonly dice: DicePair }
  | {
      readonly type: 'card-dealt';
      readonly card: Card;
      /** Where the card goes, e.g. "dealer" or "player". */
      readonly to: string;
      readonly faceUp: boolean;
    }
  | {
      readonly type: 'card-revealed';
      readonly card: Card;
      readonly to: string;
      /** Position of the card within its hand, in dealing order. */
      readonly index: number;
    }
  | { readonly type: 'decision-requested'; readonly options: readonly DecisionOption[] }
  | { readonly type: 'decision-made'; readonly choice: string }
  | { readonly type: 'stake-added'; readonly betId: BetId; readonly amount: Cents }
  | {
      readonly type: 'jackpot-won';
      readonly jackpotId: string;
      readonly betId: BetId;
      readonly amount: Cents;
    }
  | ({ readonly type: 'bet-settled'; readonly betId: BetId } & SettlementLine)
  | {
      readonly type: 'round-settled';
      readonly totalStake: Cents;
      readonly totalPayout: Cents;
      readonly net: Cents;
    };

export type GameEventType = GameEvent['type'];

/** Shape of a game-specific event (e.g. a marker moving); `type` must not clash with core events. */
export interface CustomEvent {
  readonly type: string;
}

export type RoundPhase = 'awaiting-decision' | 'settled';

/**
 * An immutable snapshot of a round. `start` produces the first one and every
 * `decide` produces the next; the UI replays the events added since the last
 * snapshot.
 */
export interface RoundState<
  TChoice extends string = string,
  TData = unknown,
  TEvent extends CustomEvent = never,
> {
  readonly gameId: string;
  readonly phase: RoundPhase;
  /** Current stakes per bet, including stakes added by decisions. */
  readonly bets: Bets;
  readonly events: readonly (GameEvent | TEvent)[];
  /** Lines for the bets settled so far; complete once phase is 'settled'. */
  readonly settlement: Settlement;
  /** What decide() accepts while phase is 'awaiting-decision'; empty once settled. */
  readonly options: readonly DecisionOption<TChoice>[];
  /** Game-private continuation state (hidden cards, kept dice…). */
  readonly data: TData;
  /**
   * The Rng injected at start(), carried so decide(state, choice) keeps
   * drawing from the same stream. Not part of the persisted record: a server
   * stores the rest of the snapshot and re-attaches its RNG when it resumes a
   * round.
   */
  readonly rng: Rng;
}

/**
 * A game is a state machine over rounds. It is created per table (it may own
 * table resources such as a shoe or a jackpot pool); rounds themselves are
 * immutable values.
 */
export interface Game<
  TChoice extends string = string,
  TData = unknown,
  TEvent extends CustomEvent = never,
> {
  readonly id: string;
  readonly name: string;
  readonly bets: readonly BetDefinition[];
  /** Validates the bets, then plays until settled or a decision is needed. */
  start(bets: Bets, rng: Rng): RoundState<TChoice, TData, TEvent>;
  /** Applies a player's choice to a round that awaits a decision. */
  decide(
    state: RoundState<TChoice, TData, TEvent>,
    choice: TChoice,
  ): RoundState<TChoice, TData, TEvent>;
  /** Declared math per bet, generated from the bet definitions. */
  mathSummary(): MathSummary;
}

export interface BetMath {
  readonly betId: BetId;
  readonly label: string;
  readonly kind: BetKind;
  readonly min: Cents;
  readonly max: Cents;
  readonly rtp: number;
  readonly houseEdge: number;
  readonly standardDeviation?: number;
  readonly paytable: readonly PaytableEntry[];
}

export interface MathSummary {
  readonly gameId: string;
  readonly gameName: string;
  readonly bets: readonly BetMath[];
}
