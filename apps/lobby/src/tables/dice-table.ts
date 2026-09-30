import {
  EngineError,
  createCryptoRng,
  settlementTotals,
  type Bets,
  type Cents,
  type CustomEvent,
  type DicePair,
  type Game,
  type GameEvent,
  type Rng,
  type RoundState,
  type Shoe,
} from '@casinogames/engine';
import {
  AutoPlay,
  AutoPlayController,
  BankrollDisplay,
  type BetSpot,
  CardDealer,
  ChipRail,
  DiceRoller,
  formatCents,
  h,
  icon,
  motion as pageMotion,
  replayEvents,
  type BetRejection,
  type EventHandlers,
  type HandLayout,
  type Motion,
  type RtpTracker,
} from '@casinogames/ui';
import type { Services } from '../services.ts';
import { TOP_UP_BELOW } from '../shell/topbar.ts';
import type { SpotCallbacks, TableFelt } from './spots.ts';

/** What every table page passes to its table. */
export interface TableOptions {
  readonly services: Services;
  /** Records every settled round for the RTP monitor. */
  readonly tracker: RtpTracker;
  /** Draws every outcome. Defaults to the platform CSPRNG. */
  readonly rng?: Rng;
  readonly motion?: Motion;
  /** 'dom' skips PixiJS (tests, very old devices). */
  readonly renderer?: 'auto' | 'dom';
  /** Extra buttons for the wallet row (rules, paytable). */
  readonly tools?: readonly HTMLElement[];
}

export type TablePhase = 'loading' | 'betting' | 'playing';

/** What a game's replay of a round gets from the table. */
export interface RoundContext<
  TEvent extends CustomEvent = never,
  TChoice extends string = never,
  TData = undefined,
> {
  readonly roller: DiceRoller;
  readonly dealer: CardDealer;
  /** The bets the round was played with. */
  readonly bets: Bets;
  /** Shapes the throw animation only. */
  readonly power: number;
  /** Aborted when the table is torn down mid-round. */
  readonly signal: AbortSignal;
  readonly motion: Motion;
  /** True when autoplay plays the round: its decisions are the reference strategy's. */
  readonly autoplay: boolean;
  /**
   * Plays, in order and with `handlers`, the round's events not played yet:
   * those of the latest step (see decide). Reshuffles are handled here (the
   * shoe display and its animation), and the shoe display follows every
   * card dealt before the game's own card-dealt handler runs.
   */
  replay(handlers: EventHandlers<GameEvent | TEvent>): Promise<void>;
  /** Whether the balance covers what a choice takes when it is made: its fee and added stake. */
  canAfford(choice: TChoice): boolean;
  /**
   * Makes the player's choice in a round that awaits one: the balance pays
   * the choice's fee and added stake, and the engine plays on. Returns the
   * next step, whose new events replay() then plays.
   */
  decide(choice: TChoice): RoundState<TChoice, TData, TEvent>;
}

/**
 * What a game brings to the shared table; TEvent is the game's own events,
 * if any, and TChoice and TData its decisions and their round data.
 */
export interface TableGame<
  TBetId extends string,
  TEvent extends CustomEvent = never,
  TChoice extends string = never,
  TData = undefined,
> {
  /** Accessible name of the table, e.g. "Entre Dados table". */
  readonly label: string;
  /** Extra class on the table element, for the game's layout. */
  readonly className: string;
  readonly game: Game<TChoice, TData, TEvent>;
  /** The shoe the game deals from, shown on the table. */
  readonly shoe: Shoe;
  /** The bet the side bets ride on. */
  readonly mainBet: { readonly id: TBetId; readonly label: string };
  /** What the player watches (it must contain `diceHost` and `cardHost`). */
  readonly view: HTMLElement;
  readonly diceHost: HTMLElement;
  readonly cardHost: HTMLElement;
  /** The faces the dice show before the first roll. */
  readonly initialDice: DicePair;
  readonly hands: readonly HandLayout[];
  readonly cardScale?: number;
  createFelt(callbacks: SpotCallbacks<TBetId>): TableFelt<TBetId>;
  /** Shows a hint, a notice or the last round's result between rounds. */
  narrate(text: string): void;
  /** A round starts: reset the view (the stakes are about to be taken). */
  beginRound(): void;
  /**
   * Plays the round on the view, from the first step the engine returned;
   * in a game with decisions, it asks for them and makes them through
   * round.decide(). Resolves once the round is settled with what it showed,
   * for the result line ("Card 3 · Entre wins"), or ''.
   */
  playRound(
    state: RoundState<TChoice, TData, TEvent>,
    round: RoundContext<TEvent, TChoice, TData>,
  ): Promise<string>;
  /**
   * For a game with decisions: the choice made for the player when a round
   * must end without one (the page closes while it awaits a decision). It
   * must cost nothing: no fee or stake is taken without the player's choice.
   */
  defaultChoice?(state: RoundState<TChoice, TData, TEvent>): TChoice;
  /**
   * What a round may take from the balance beyond its stakes once it plays
   * (a fee): autoplay only starts a round the balance covers with it.
   */
  reserve?(bets: Bets): Cents;
  /** The result display ended: clear the game's own marks, if any. */
  clearMarks?(): void;
}

/** Nominal pause (the motion policy shortens or skips it). */
const AUTOPLAY_POWER = 0.55;
/** How long each spot shows its result before the chips return for the next round. */
const RESULT_MS = 2_400;
/** A line paying at least this many times its stake plays the big-win sound. */
const BIG_WIN = 20;
const OPENING_BET: Cents = 100;

const REJECTIONS: Readonly<Record<BetRejection, string>> = {
  funds: 'Your balance does not cover another chip.',
  max: 'That bet is at the table maximum.',
  locked: 'Bets are closed until the round settles.',
};

/**
 * What every table of the demo shares: the dice tray and the dealer's cards,
 * the felt, the chips, the balance and the actions, and a round's life.
 *
 * The engine decides everything in game.start() and, in a game with
 * decisions, game.decide(); the game plays the events of each step on its
 * view. Stakes are debited when the player rolls, a choice's fee and added
 * stake when it is made, and payouts credited at settlement. A round
 * interrupted by navigation or by closing the page is still paid out, and
 * one that awaits a decision ends with the game's choice that costs nothing.
 */
export class DiceTable<
  TBetId extends string,
  TEvent extends CustomEvent = never,
  TChoice extends string = never,
  TData = undefined,
> {
  readonly element: HTMLElement;
  /** Resolves once the dice and the card views are ready. */
  readonly ready: Promise<void>;
  readonly felt: TableFelt<TBetId>;
  readonly #table: TableGame<TBetId, TEvent, TChoice, TData>;
  readonly #services: Services;
  readonly #tracker: RtpTracker;
  readonly #rng: Rng;
  readonly #motion: Motion;
  readonly #rail: ChipRail;
  readonly #controller: AutoPlayController;
  readonly #autoplay: AutoPlay;
  readonly #roll: HTMLButtonElement;
  readonly #clear: HTMLButtonElement;
  readonly #wallet: BankrollDisplay;
  readonly #betTotal = h('strong', { class: 'tb-bet__amount cg-num' });
  readonly #abort = new AbortController();
  readonly #unsubscribe: (() => void)[] = [];
  #resultTimer: ReturnType<typeof setTimeout> | undefined;
  #roller: DiceRoller | undefined;
  #dealer: CardDealer | undefined;
  #phase: TablePhase = 'loading';
  /** The round in play: its latest step, until the table has paid it out. */
  #pending: RoundState<TChoice, TData, TEvent> | null = null;
  /**
   * A round the table ended with the free choice while it awaited the
   * player (the page was hidden): the step it awaited and the step that
   * ended it, so a view still asking plays on with that choice.
   */
  #ended: {
    readonly awaiting: RoundState<TChoice, TData, TEvent>;
    readonly settled: RoundState<TChoice, TData, TEvent>;
  } | null = null;
  /** The last round's summary, shown until the bets change. */
  #result: string | null = null;
  /** What the round just played showed ("Card 3 · Entre wins"). */
  #reveal = '';
  #notice: string | null = null;
  /** True while the table itself places chips (the opening bet): no chip sound. */
  #placing = false;

  constructor(options: TableOptions, table: TableGame<TBetId, TEvent, TChoice, TData>) {
    this.#table = table;
    this.#services = options.services;
    this.#tracker = options.tracker;
    this.#rng = options.rng ?? createCryptoRng();
    this.#motion = options.motion ?? pageMotion;

    this.#rail = new ChipRail({ value: 100, label: 'Chip value' });
    this.felt = table.createFelt({
      chipValue: () => this.#rail.value,
      canAdd: (amount) => this.#services.bankroll.canAfford(this.#total() + amount),
      onChange: (_, amount) => {
        if (amount > 0 && !this.#placing) this.#services.sound.play('chip');
        this.#onBetsChanged();
      },
      onReject: (reason) => {
        this.#notice = REJECTIONS[reason];
        this.#refresh();
      },
    });
    this.#roll = h(
      'button',
      { type: 'button', class: 'cg-btn cg-btn--primary tb-actions__roll' },
      icon('play'),
      'Roll',
    );
    this.#clear = h(
      'button',
      { type: 'button', class: 'cg-btn cg-btn--ghost' },
      icon('reset'),
      'Clear',
    );
    this.#wallet = new BankrollDisplay({
      bankroll: this.#services.bankroll,
      topUpBelow: TOP_UP_BELOW,
    });
    this.#controller = new AutoPlayController({
      playRound: () => this.play(AUTOPLAY_POWER),
      canContinue: () =>
        this.#phase === 'betting' &&
        this.#problem() === null &&
        this.#services.bankroll.canAfford(
          this.#total() + (this.#table.reserve?.(this.#placedBets()) ?? 0),
        ),
    });
    this.#autoplay = new AutoPlay({ controller: this.#controller });

    this.element = h(
      'section',
      { class: `tb-table ${table.className}`, 'aria-label': table.label },
      table.view,
      this.felt.element,
      h(
        'div',
        { class: 'tb-controls' },
        h(
          'div',
          { class: 'tb-wallet' },
          this.#wallet.element,
          h('div', { class: 'tb-wallet__tools' }, ...(options.tools ?? [])),
          h(
            'div',
            { class: 'tb-bet' },
            h('span', { class: 'tb-bet__label' }, 'Bet'),
            this.#betTotal,
          ),
        ),
        this.#rail.element,
        h('div', { class: 'tb-actions' }, this.#clear, this.#roll, this.#autoplay.element),
      ),
    );

    this.#roll.addEventListener('click', () => this.#roller?.requestThrow());
    this.#clear.addEventListener('click', () => {
      for (const spot of this.#spots()) spot.clear();
    });
    const settleNow = () => {
      this.#finalize();
    };
    window.addEventListener('pagehide', settleNow);
    this.#unsubscribe.push(
      () => {
        window.removeEventListener('pagehide', settleNow);
      },
      this.#services.bankroll.subscribe(() => {
        this.#refresh();
      }),
      this.#controller.subscribe(() => {
        this.#refresh();
      }),
    );

    if (this.#services.bankroll.canAfford(OPENING_BET)) {
      this.#placing = true;
      this.felt.spots[table.mainBet.id].setAmount(OPENING_BET);
      this.#placing = false;
    }
    this.#refresh();
    this.ready = this.#init(options.renderer ?? 'auto');
  }

  get phase(): TablePhase {
    return this.#phase;
  }

  /**
   * Plays one round with the bets on the felt: what the dice tray, the Roll
   * button and autoplay call. `power` only shapes the throw animation.
   */
  async play(power = 0.6): Promise<void> {
    const roller = this.#roller;
    const dealer = this.#dealer;
    if (this.#phase !== 'betting' || this.#problem() !== null || !roller || !dealer) return;
    const { bankroll } = this.#services;
    const bets = this.#placedBets();
    const total = this.#total();

    this.#phase = 'playing';
    this.#clearResult();
    this.#table.beginRound();
    this.#refresh();
    this.#bringViewIntoView();

    bankroll.debit(total);
    let state: RoundState<TChoice, TData, TEvent>;
    try {
      state = this.#table.game.start(bets, this.#rng);
    } catch (error) {
      bankroll.credit(total);
      this.#phase = 'betting';
      this.#notice = error instanceof EngineError ? error.message : 'The round could not start.';
      this.#refresh();
      return;
    }
    this.#pending = state;
    this.#ended = null;

    const signal = this.#abort.signal;
    const shoe = this.#table.shoe;
    /** Events already played on the view, across the round's steps. */
    let played = 0;
    const round: RoundContext<TEvent, TChoice, TData> = {
      roller,
      dealer,
      bets,
      power,
      signal,
      motion: this.#motion,
      autoplay: this.#controller.state.running,
      replay: (handlers) => {
        // The game's handlers for the core events the table wraps.
        const own = handlers as EventHandlers<GameEvent>;
        const table: EventHandlers<GameEvent> = {
          'shoe-shuffled': async () => {
            dealer.setShoe(shoe.size(), shoe.size());
            await dealer.shuffle();
          },
          'card-dealt': async (event) => {
            dealer.setShoe(shoe.remaining(), shoe.size(), shoe.isCutCardOut());
            await own['card-dealt']?.(event);
          },
        };
        const events = state.events.slice(played);
        played = state.events.length;
        return replayEvents(events, { ...handlers, ...table }, { signal });
      },
      canAfford: (choice) => bankroll.canAfford(this.#costOf(state, choice)),
      decide: (choice) => {
        if (this.#ended?.awaiting === state) {
          // The table ended the round meanwhile (the page was hidden and shown again).
          state = this.#ended.settled;
          return state;
        }
        if (this.#pending !== state || state.phase !== 'awaiting-decision') {
          throw new Error('This round does not await a decision');
        }
        const cost = this.#costOf(state, choice);
        if (!bankroll.canAfford(cost)) throw new Error('The balance does not cover this choice');
        const next = this.#table.game.decide(state, choice);
        if (cost > 0) bankroll.debit(cost);
        this.#pending = state = next;
        return next;
      },
    };
    try {
      await dealer.clear();
      this.#reveal = await this.#table.playRound(state, round);
    } catch (error) {
      // A view torn down mid-animation (the page closed) is not a failure:
      // destroy() has already paid the round out.
      if (!signal.aborted) throw error;
    }
    if (signal.aborted) return;
    this.#settle(this.#finish(state));
    this.#phase = 'betting';
    this.#refresh();
  }

  destroy(): void {
    this.#abort.abort();
    this.#finalize();
    clearTimeout(this.#resultTimer);
    this.#autoplay.destroy();
    for (const unsubscribe of this.#unsubscribe) unsubscribe();
    this.#roller?.destroy();
    this.#dealer?.destroy();
    this.felt.destroy();
    this.#rail.destroy();
    this.#wallet.destroy();
    this.element.remove();
  }

  async #init(renderer: 'auto' | 'dom'): Promise<void> {
    const { sound } = this.#services;
    const table = this.#table;
    const [roller, dealer] = await Promise.all([
      DiceRoller.create({
        host: table.diceHost,
        motion: this.#motion,
        sound,
        renderer,
        initial: table.initialDice,
        label: 'Roll the dice',
        onThrow: (power) => void this.play(power),
      }),
      CardDealer.create({
        host: table.cardHost,
        hands: table.hands,
        motion: this.#motion,
        sound,
        renderer,
        ...(table.cardScale === undefined ? {} : { cardScale: table.cardScale }),
      }),
    ]);
    if (this.#abort.signal.aborted) {
      roller.destroy();
      dealer.destroy();
      return;
    }
    this.#roller = roller;
    this.#dealer = dealer;
    dealer.setShoe(table.shoe.remaining(), table.shoe.size(), table.shoe.isCutCardOut());
    this.#phase = 'betting';
    this.#refresh();
  }

  /** The view (the dice, the cards and the game's readouts) must be on screen when the round plays. */
  #bringViewIntoView(): void {
    const view = this.#table.view;
    if (typeof view.scrollIntoView !== 'function') return;
    const { top, bottom } = view.getBoundingClientRect();
    if (top >= 0 && bottom <= window.innerHeight) return;
    view.scrollIntoView({
      block: 'start',
      behavior: this.#motion.level === 'full' ? 'smooth' : 'auto',
    });
  }

  /** What a choice takes from the balance when it is made: its fee and its added stake. */
  #costOf(state: RoundState<TChoice, TData, TEvent>, choice: TChoice): Cents {
    const option = state.options.find((candidate) => candidate.choice === choice);
    return (option?.fee?.amount ?? 0) + (option?.additionalStake?.amount ?? 0);
  }

  /**
   * A round that still awaits a decision when it must end (the page closes,
   * or the view stopped asking) ends with the game's choice that costs
   * nothing, so no fee or stake is taken without the player.
   */
  #finish(state: RoundState<TChoice, TData, TEvent>): RoundState<TChoice, TData, TEvent> {
    if (state.phase !== 'awaiting-decision') return state;
    const choice = this.#table.defaultChoice?.(state);
    if (choice === undefined || this.#costOf(state, choice) > 0) {
      throw new Error(`${this.#table.label}: no free choice to end a round that awaits one`);
    }
    const next = this.#table.game.decide(state, choice);
    if (this.#pending === state) this.#pending = next;
    this.#ended = { awaiting: state, settled: next };
    return next;
  }

  /** Pays a settled round out: results on the felt, credit, sounds and RTP stats. */
  #settle(state: RoundState<TChoice, TData, TEvent>): void {
    if (this.#pending !== state) return;
    this.#pending = null;
    const { bankroll, sound } = this.#services;
    this.felt.showOutlook(null);
    for (const [id, line] of Object.entries(state.settlement)) {
      this.felt.spots[id as TBetId].setResult(line);
    }
    const totals = settlementTotals(state.settlement);
    if (totals.payout > 0) bankroll.credit(totals.payout);
    this.#tracker.record(state.settlement);

    const lines = Object.values(state.settlement);
    if (lines.some((line) => line.outcome === 'win' && line.net >= line.stake * BIG_WIN)) {
      sound.play('big-win');
    } else if (totals.net > 0) {
      sound.play('win');
    } else if (totals.net < 0) {
      sound.play('lose');
    }
    const verdict =
      totals.net > 0
        ? `you win ${formatCents(totals.net)}`
        : totals.net === 0
          ? 'stakes returned'
          : totals.payout > 0
            ? `you get ${formatCents(totals.payout)} back`
            : 'no win this time';
    this.#result = this.#reveal === '' ? capitalise(verdict) : `${this.#reveal} · ${verdict}`;
    // The spots show the result for a moment, then the same bets stand ready.
    this.#resultTimer = setTimeout(() => {
      this.#clearMarks();
    }, RESULT_MS);
  }

  /** Settles a round still being animated, at once (navigation, closing the page). */
  #finalize(): void {
    if (this.#pending !== null) this.#settle(this.#finish(this.#pending));
    this.#tracker.flush();
  }

  #onBetsChanged(): void {
    this.#notice = null;
    if (this.#phase === 'betting') this.#clearResult();
    this.#refresh();
  }

  #clearResult(): void {
    this.#result = null;
    this.#reveal = '';
    this.#clearMarks();
  }

  /** Clears each spot's result and outlook; the round's summary stays in the narration. */
  #clearMarks(): void {
    clearTimeout(this.#resultTimer);
    this.#resultTimer = undefined;
    for (const spot of this.#spots()) spot.setResult(null);
    this.felt.showOutlook(null);
    this.#table.clearMarks?.();
  }

  #spots(): BetSpot[] {
    return Object.values<BetSpot>(this.felt.spots);
  }

  #placedBets(): Bets {
    const bets: Record<string, Cents> = {};
    for (const [id, spot] of Object.entries<BetSpot>(this.felt.spots)) {
      if (spot.amount > 0) bets[id] = spot.amount;
    }
    return bets;
  }

  #total(): Cents {
    return this.#spots().reduce((sum, spot) => sum + spot.amount, 0);
  }

  /** Why the bets on the felt cannot be played, or null if they can. */
  #problem(): string | null {
    const total = this.#total();
    const main = this.#table.mainBet;
    if (this.felt.spots[main.id].amount === 0) {
      return total === 0
        ? `Place a bet on ${main.label}, then roll the dice.`
        : `Side bets ride on ${main.label}: add a chip to ${main.label}.`;
    }
    if (!this.#services.bankroll.canAfford(total)) return 'Your balance does not cover these bets.';
    return null;
  }

  #refresh(): void {
    const running = this.#controller.state.running;
    const betting = this.#phase === 'betting';
    const problem = this.#problem();
    const ready = betting && problem === null && !running;
    this.#roll.disabled = !ready;
    if (ready) this.#roller?.arm();
    else this.#roller?.disarm();
    this.#clear.disabled = !betting || running || this.#total() === 0;
    this.#betTotal.textContent = formatCents(this.#total());
    // Autoplay starts between rounds only; a running autoplay can always be stopped.
    this.#autoplay.setDisabled(!betting || problem !== null);
    for (const spot of this.#spots()) spot.setLocked(!betting || running);
    if (betting) {
      this.#rail.setBalance(Math.max(0, this.#services.bankroll.balance - this.#total()));
    }
    // While a round plays the game narrates it; otherwise the table gives the hints.
    if (this.#phase === 'loading') this.#table.narrate('Setting up the table…');
    else if (betting && !running) {
      this.#table.narrate(this.#notice ?? this.#result ?? problem ?? 'Tap the dice or press Roll.');
    }
  }
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
