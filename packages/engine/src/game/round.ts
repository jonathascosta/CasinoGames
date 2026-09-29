import type { Card } from '../cards/card.ts';
import type { CardSource } from '../cards/shoe.ts';
import { rollDice, type DicePair } from '../dice/dice.ts';
import type { Rng } from '../rng/rng.ts';
import { EngineError } from './errors.ts';
import { isCents, type Cents, type Odds } from './money.ts';
import {
  settleLoss,
  settlePush,
  settleWin,
  settleWithPayout,
  settlementTotals,
  type SettlementLine,
} from './settlement.ts';
import type {
  BetDefinition,
  BetId,
  Bets,
  CustomEvent,
  DecisionOption,
  GameEvent,
  RoundState,
} from './types.ts';
import { validateBets } from './validation.ts';

/** Events the builder emits itself, so their invariants cannot be bypassed. */
type ManagedEventType =
  | 'round-started'
  | 'decision-requested'
  | 'decision-made'
  | 'stake-added'
  | 'bet-settled'
  | 'round-settled';

/** Events a game may emit directly. */
export type EmittableEvent<TEvent extends CustomEvent = never> =
  Exclude<GameEvent, { readonly type: ManagedEventType }> | TEvent;

/** What startRound needs from a game. */
export interface GameInfo {
  readonly id: string;
  readonly bets: readonly BetDefinition[];
}

/**
 * Validates `bets` and opens a round. Game code then rolls, deals and settles
 * through the builder and closes it with finish() or awaitDecision().
 *
 * @example
 * const round = startRound(game, bets, rng);
 * const dice = round.rollDice();
 * if (diceTotal(dice) === 7) round.win('seven', odds(4), 'seven');
 * else round.lose('seven');
 * return round.finish(undefined);
 */
export function startRound<
  TChoice extends string = string,
  TData = unknown,
  TEvent extends CustomEvent = never,
>(game: GameInfo, bets: Bets, rng: Rng): RoundBuilder<TChoice, TData, TEvent> {
  return RoundBuilder.open<TChoice, TData, TEvent>(game, bets, rng);
}

/**
 * Reopens a round that awaits a decision, applying the chosen option: the
 * choice is recorded and its additional stake, if any, is added.
 */
export function continueRound<TChoice extends string, TData, TEvent extends CustomEvent>(
  state: RoundState<TChoice, TData, TEvent>,
  choice: TChoice,
): RoundBuilder<TChoice, TData, TEvent> {
  return RoundBuilder.resume(state, choice);
}

/**
 * Accumulates one step of a round (from start or from a decision to the next
 * decision or the end) and enforces the invariants: integer money, every
 * placed bet settled exactly once, no changes after the step is closed.
 */
export class RoundBuilder<
  TChoice extends string = string,
  TData = unknown,
  TEvent extends CustomEvent = never,
> {
  readonly gameId: string;
  /** The round's Rng: every draw in this round comes from here. */
  readonly rng: Rng;
  readonly #bets: Record<BetId, Cents>;
  readonly #events: (GameEvent | TEvent)[];
  readonly #settlement: Record<BetId, SettlementLine>;
  #closed = false;

  private constructor(
    gameId: string,
    rng: Rng,
    bets: Record<BetId, Cents>,
    events: (GameEvent | TEvent)[],
    settlement: Record<BetId, SettlementLine>,
  ) {
    this.gameId = gameId;
    this.rng = rng;
    this.#bets = bets;
    this.#events = events;
    this.#settlement = settlement;
  }

  /** See {@link startRound}. */
  static open<TChoice extends string, TData, TEvent extends CustomEvent>(
    game: GameInfo,
    bets: Bets,
    rng: Rng,
  ): RoundBuilder<TChoice, TData, TEvent> {
    const placed = validateBets(game.bets, bets);
    const round = new RoundBuilder<TChoice, TData, TEvent>(game.id, rng, { ...placed }, [], {});
    round.#push({ type: 'round-started', bets: placed });
    return round;
  }

  /** See {@link continueRound}. */
  static resume<TChoice extends string, TData, TEvent extends CustomEvent>(
    state: RoundState<TChoice, TData, TEvent>,
    choice: TChoice,
  ): RoundBuilder<TChoice, TData, TEvent> {
    if (state.phase !== 'awaiting-decision') {
      throw new EngineError('NOT_AWAITING_DECISION', 'This round does not await a decision');
    }
    const option = state.options.find((candidate) => candidate.choice === choice);
    if (option === undefined) {
      throw new EngineError('INVALID_CHOICE', `"${choice}" is not one of the offered options`);
    }
    const round = new RoundBuilder<TChoice, TData, TEvent>(
      state.gameId,
      state.rng,
      { ...state.bets },
      [...state.events],
      { ...state.settlement },
    );
    round.#push({ type: 'decision-made', choice });
    if (option.additionalStake !== undefined) {
      round.addStake(option.additionalStake.betId, option.additionalStake.amount);
    }
    return round;
  }

  /** Current stakes, including stakes added by decisions. */
  get bets(): Bets {
    return { ...this.#bets };
  }

  stakeOf(betId: BetId): Cents {
    return Object.hasOwn(this.#bets, betId) ? this.#bets[betId]! : 0;
  }

  isPlaced(betId: BetId): boolean {
    return this.stakeOf(betId) > 0;
  }

  isSettled(betId: BetId): boolean {
    return Object.hasOwn(this.#settlement, betId);
  }

  /** Placed bets that have not been settled yet. */
  unsettledBets(): BetId[] {
    return Object.keys(this.#bets).filter((betId) => !this.isSettled(betId));
  }

  emit(event: EmittableEvent<TEvent>): this {
    this.#assertOpen();
    this.#events.push(event);
    return this;
  }

  /** Rolls two dice with the round's Rng and records the roll. */
  rollDice(): DicePair {
    const dice = rollDice(this.rng);
    this.emit({ type: 'dice-rolled', dice });
    return dice;
  }

  /** Starts the round on a card source, recording a reshuffle if one happens. */
  prepareCards(source: CardSource): void {
    this.#assertOpen();
    if (source.beginRound(this.rng)) this.emit({ type: 'shoe-shuffled', cards: source.size() });
  }

  /** Deals one card to `to`, recording it (and any emergency reshuffle). */
  dealCard(source: CardSource, to: string, faceUp = true): Card {
    this.#assertOpen();
    const shufflesBefore = source.shuffleCount();
    const card = source.draw(this.rng);
    if (source.shuffleCount() !== shufflesBefore) {
      this.emit({ type: 'shoe-shuffled', cards: source.remaining() + 1 });
    }
    this.emit({ type: 'card-dealt', card, to, faceUp });
    return card;
  }

  revealCard(to: string, index: number, card: Card): void {
    this.emit({ type: 'card-revealed', card, to, index });
  }

  /** Adds stake to a bet (a raise, a double…), placing it if necessary. */
  addStake(betId: BetId, amount: Cents): this {
    this.#assertOpen();
    if (!isCents(amount) || amount <= 0) {
      throw new EngineError('INVALID_STAKE', `Added stake must be positive integer cents`);
    }
    if (this.isSettled(betId)) {
      throw new EngineError('BET_ALREADY_SETTLED', `"${betId}" is already settled`);
    }
    this.#bets[betId] = this.stakeOf(betId) + amount;
    this.#push({ type: 'stake-added', betId, amount });
    return this;
  }

  /** Settles a bet with a line computed for its full current stake. */
  settle(betId: BetId, line: SettlementLine): this {
    const stake = this.#unsettledStake(betId);
    if (line.stake !== stake) {
      throw new EngineError('INVALID_STAKE', `"${betId}" stake is ${stake}¢, not ${line.stake}¢`);
    }
    return this.#record(betId, line);
  }

  win(betId: BetId, odds: Odds, entryId?: string): this {
    return this.#record(betId, settleWin(this.#unsettledStake(betId), odds, entryId));
  }

  lose(betId: BetId, entryId?: string): this {
    return this.#record(betId, settleLoss(this.#unsettledStake(betId), entryId));
  }

  push(betId: BetId, entryId?: string): this {
    return this.#record(betId, settlePush(this.#unsettledStake(betId), entryId));
  }

  /** Settles a bet for an explicit total payout (jackpots, surrenders…). */
  payout(betId: BetId, payout: Cents, entryId?: string): this {
    return this.#record(betId, settleWithPayout(this.#unsettledStake(betId), payout, entryId));
  }

  /** Pauses the round until the player picks one of `options`. */
  awaitDecision(
    options: readonly DecisionOption<TChoice>[],
    data: TData,
  ): RoundState<TChoice, TData, TEvent> {
    this.#assertOpen();
    const choices = new Set(options.map((option) => option.choice));
    if (options.length === 0 || choices.size !== options.length) {
      throw new EngineError('INVALID_CHOICE', 'A decision needs distinct options');
    }
    this.#push({ type: 'decision-requested', options });
    return this.#close('awaiting-decision', options, data);
  }

  /** Ends the round; every placed bet must have been settled. */
  finish(data: TData): RoundState<TChoice, TData, TEvent> {
    this.#assertOpen();
    const unsettled = this.unsettledBets();
    if (unsettled.length > 0) {
      throw new EngineError('UNSETTLED_BETS', `Unsettled bets: ${unsettled.join(', ')}`);
    }
    const totals = settlementTotals(this.#settlement);
    this.#push({
      type: 'round-settled',
      totalStake: totals.stake,
      totalPayout: totals.payout,
      net: totals.net,
    });
    return this.#close('settled', [], data);
  }

  #close(
    phase: RoundState['phase'],
    options: readonly DecisionOption<TChoice>[],
    data: TData,
  ): RoundState<TChoice, TData, TEvent> {
    this.#closed = true;
    return {
      gameId: this.gameId,
      phase,
      bets: { ...this.#bets },
      events: [...this.#events],
      settlement: { ...this.#settlement },
      options,
      data,
      rng: this.rng,
    };
  }

  /** The stake of a placed, not yet settled bet; throws otherwise. */
  #unsettledStake(betId: BetId): Cents {
    this.#assertOpen();
    const stake = this.stakeOf(betId);
    if (stake === 0) throw new EngineError('BET_NOT_PLACED', `"${betId}" was not placed`);
    if (this.isSettled(betId)) {
      throw new EngineError('BET_ALREADY_SETTLED', `"${betId}" is already settled`);
    }
    return stake;
  }

  /** Stores a validated line and records it as a bet-settled event. */
  #record(betId: BetId, line: SettlementLine): this {
    this.#settlement[betId] = line;
    const { stake, payout, net, outcome, entryId } = line;
    this.#push(
      entryId === undefined
        ? { type: 'bet-settled', betId, stake, payout, net, outcome }
        : { type: 'bet-settled', betId, stake, payout, net, outcome, entryId },
    );
    return this;
  }

  /** Appends an event whose invariants the builder itself guarantees. */
  #push(event: Extract<GameEvent, { readonly type: ManagedEventType }>): void {
    this.#assertOpen();
    this.#events.push(event);
  }

  #assertOpen(): void {
    if (this.#closed) throw new EngineError('ROUND_CLOSED', 'This round step is already closed');
  }
}
