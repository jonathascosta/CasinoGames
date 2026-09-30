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
  /**
   * When set, `share` is what a stake of this many cents wins, and a smaller
   * stake wins in proportion: stake ÷ fullShareStake × share.
   */
  readonly fullShareStake?: Cents;
}

/**
 * Something the round settles before the result and a line is paid under:
 * the target the dice set, say. Naming it lets the paytable and the game
 * sheet show, for each of its values, how often it comes up and the house
 * edge given it.
 */
export interface PaytableCondition {
  /** What varies, e.g. "Target"; the same for every line of a bet. */
  readonly name: string;
  /** Its value for this line, e.g. "7". */
  readonly value: string;
  /** Chance per round that the condition takes this value. */
  readonly probability: number;
}

interface PaytableEntryBase {
  /** Stable id, echoed in SettlementLine.entryId when this entry decides a bet. */
  readonly id: string;
  readonly label: string;
  /** Exact probability per round, when the game is enumerable. */
  readonly probability?: number;
  /** The condition the line is paid under, for bets whose payout depends on one. */
  readonly given?: PaytableCondition;
}

/**
 * One line of a bet's paytable: fixed odds (optionally with a progressive
 * meter paid on top), a progressive jackpot alone, or a push (the stake is
 * returned). Losing outcomes are not listed.
 */
export type PaytableEntry = PaytableEntryBase &
  (
    | { readonly odds: Odds; readonly jackpot?: JackpotPayout }
    | { readonly jackpot: JackpotPayout }
    | { readonly push: true }
  );

/**
 * How a bet's progressive meter is funded and paid, for a bet whose winning
 * line pays fixed odds plus a share of a meter fed by the bet's own stakes.
 * Every contribution is paid out through the meter in the long run, so the
 * bet's declared RTP is `fixedRtp + contributionRate`: its return excluding
 * the seed, which the house funds.
 */
export interface ProgressiveTerms {
  readonly jackpotId: string;
  /** What the meter starts at and never drops below, in cents. */
  readonly seed: Cents;
  /** Share of every stake on the bet that goes to the meter. */
  readonly contributionRate: number;
  /** The stake that wins the whole meter; a smaller stake wins its share of it. */
  readonly fullShareStake: Cents;
  /** Chance per round of the hit that pays the meter. */
  readonly hitProbability: number;
  /** RTP of the fixed pays alone. */
  readonly fixedRtp: number;
}

/**
 * Exact figures on the table's own finite shoe, declared when they differ
 * from the infinite-shoe ones and are exact in the long run: in a game that
 * deals the same number of cards every round, each round's cards are a
 * uniform draw from the full shoe, however deep the shoe has been dealt.
 */
export interface FiniteShoeFigures {
  readonly rtp: number;
  /** Chance per round that the bet wins. */
  readonly hitFrequency: number;
}

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
   * Declared return to player: the long-run total returned, less any fees
   * charged against the bet, ÷ total wagered on it (additional stakes made
   * during a round included). The house edge is 1 − rtp. Proven by each
   * game's exact and Monte Carlo tests.
   */
  readonly rtp: number;
  /**
   * Standard deviation of the return per unit staked, when known. Lets the
   * RTP panel show the band the live figure is expected to converge within.
   * For a progressive bet, with the meter at its seed.
   */
  readonly standardDeviation?: number;
  readonly description?: string;
  /** The meter's funding and pay, for a bet with a progressive line. */
  readonly progressive?: ProgressiveTerms;
  /** Exact figures on the table's own shoe (see FiniteShoeFigures). */
  readonly finiteShoe?: FiniteShoeFigures;
}

/** A choice offered to the player while a round awaits a decision. */
export interface DecisionOption<TChoice extends string = string> {
  readonly choice: TChoice;
  readonly label: string;
  /** A stake the choice commits (e.g. a raise); taken when it is chosen. */
  readonly additionalStake?: { readonly betId: BetId; readonly amount: Cents };
  /**
   * What the choice costs (e.g. a re-roll), charged against a placed bet:
   * taken when it is chosen and never returned, whatever the result. A fee
   * is not a stake: nothing pays on it, and it lowers the bet's return.
   */
  readonly fee?: { readonly betId: BetId; readonly amount: Cents };
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
  | { readonly type: 'fee-charged'; readonly betId: BetId; readonly amount: Cents }
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
      /** Fees charged during the round; present only when there were any. */
      readonly totalFees?: Cents;
      /** totalPayout − totalStake − totalFees. */
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
  /** Fees charged per bet so far (see DecisionOption.fee); empty when none were. */
  readonly fees: Readonly<Record<BetId, Cents>>;
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
  /** Standard deviation of the net result per unit staked (the volatility index). */
  readonly standardDeviation?: number;
  /**
   * Chance per round that the bet wins: the sum of its winning entries'
   * probabilities. Present when every winning entry declares one.
   */
  readonly hitFrequency?: number;
  /** Chance per round of a push, when the paytable lists push entries with probabilities. */
  readonly pushFrequency?: number;
  /**
   * Largest net win per unit staked, the house's worst case per unit. Absent
   * when a progressive jackpot can decide the bet, since the pool sets it.
   */
  readonly maxExposure?: number;
  /**
   * The bet's figures for each value of the condition its lines are paid
   * under, when every line names one (see PaytableCondition) and declares
   * its probability.
   */
  readonly breakdown?: BetBreakdown;
  /** The meter's economics, for a bet with a progressive line. */
  readonly progressive?: ProgressiveMath;
  /** Exact figures on the table's own shoe, when declared. */
  readonly finiteShoe?: FiniteShoeFigures;
  readonly description?: string;
  readonly paytable: readonly PaytableEntry[];
}

/**
 * A progressive bet's economics, derived from its terms. Amounts are in
 * cents; RTPs are per unit staked.
 */
export interface ProgressiveMath extends ProgressiveTerms {
  /** The fixed odds of the line that pays the meter. */
  readonly fixedOdds: Odds;
  /** The fixed pays plus the contributions: the declared RTP. */
  readonly rtpExcludingSeed: number;
  /** One round's RTP with the meter at its seed (see progressiveRtpAtMeter). */
  readonly rtpAtSeed: number;
  /** The meter at which a round returns exactly its stake. */
  readonly breakEvenMeter: number;
  /** Average rounds from one hit to the next, for a player on the bet every round. */
  readonly cycleRounds: number;
  /**
   * What the house pays per round to restore the seed, for a player staking
   * the full-share amount every round: each hit takes the whole meter.
   */
  readonly seedCostPerRound: number;
  /** Largest net win per unit staked with the meter at its seed. */
  readonly maxExposureAtSeed: number;
}

/** A bet's figures split by the condition its lines are paid under. */
export interface BetBreakdown {
  /** What varies, e.g. "Target". */
  readonly by: string;
  /** One row per value, in paytable order. */
  readonly rows: readonly BreakdownRow[];
}

export interface BreakdownRow {
  /** e.g. "7". */
  readonly value: string;
  /** Chance per round of this value. */
  readonly probability: number;
  /** Chance that the bet wins, given this value. */
  readonly hitFrequency: number;
  /** Return per unit staked given this value, pushes included. */
  readonly rtp: number;
  readonly houseEdge: number;
  /** The lines paid under this value. */
  readonly paytable: readonly PaytableEntry[];
}

export interface MathSummary {
  readonly gameId: string;
  readonly gameName: string;
  readonly bets: readonly BetMath[];
  /** Names the table's shoe (e.g. "six-deck shoe") when bets declare finite-shoe figures. */
  readonly finiteShoe?: string;
  /** The reference strategy and what it returns, for a game with decisions. */
  readonly decisions?: DecisionSummary;
}

/**
 * A game's decisions: the reference strategy the declared figures assume,
 * situation by situation, and what it returns under the table's rules and
 * under variants of them.
 */
export interface DecisionSummary {
  /** What the player decides and what it costs, in a sentence or two. */
  readonly description: string;
  readonly card: StrategyCard;
  /** The table's rules first, then any variants, for comparison. */
  readonly figures: readonly StrategyFigures[];
}

/** The value of every choice in each situation, and the best one. */
export interface StrategyCard {
  /** What a row is, e.g. "Roll". */
  readonly situation: string;
  /** The choices compared, e.g. ["Ficar", "Trancar"]. */
  readonly choices: readonly string[];
  /** What the values measure, e.g. "net result per unit of the main bet, fees included". */
  readonly measure: string;
  readonly rows: readonly StrategyRow[];
}

export interface StrategyRow {
  /** e.g. "6-2". */
  readonly situation: string;
  /** Chance per round of this situation. */
  readonly probability: number;
  /** The expected value of each choice, in the order of StrategyCard.choices. */
  readonly values: readonly number[];
  /** The best choice: an index into StrategyCard.choices. */
  readonly best: number;
  /** How to play it, e.g. "Lock the 6, re-roll the 2". */
  readonly play: string;
}

/** What the reference strategy returns under one set of rules. */
export interface StrategyFigures {
  /** e.g. "These rules" or "Without the free 1-1". */
  readonly label: string;
  readonly rtp: number;
  readonly houseEdge: number;
  /** The loss per unit of everything the player pays: stakes and fees. */
  readonly elementOfRisk: number;
  /** Chance per round that the main bet wins. */
  readonly hitFrequency: number;
  /** Standard deviation of the net result per unit of the main bet, fees included. */
  readonly standardDeviation: number;
  /** How often the strategy makes each choice other than standing, e.g. "Trancar". */
  readonly choiceFrequencies: readonly { readonly choice: string; readonly frequency: number }[];
  /** Chance per round of paying a fee. */
  readonly feeFrequency: number;
  /** Average fee per round, per unit of the main bet. */
  readonly averageFee: number;
}
