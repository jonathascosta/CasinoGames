import {
  DIE_FACES,
  ENTRE_DADOS_BETS,
  ENTRE_DADOS_DEALER,
  EngineError,
  createCryptoRng,
  createEntreDados,
  createEntreDadosShoe,
  readEntreDadosRoll,
  resolveEntreDadosBet,
  settlementTotals,
  type Bets,
  type Cents,
  type DicePair,
  type EntreDadosBetId,
  type EntreDadosGame,
  type Rng,
  type RoundState,
  type Shoe,
} from '@casinogames/engine';
import {
  AutoPlay,
  AutoPlayController,
  BankrollDisplay,
  CardDealer,
  ChipRail,
  DiceRoller,
  formatCents,
  h,
  icon,
  motion as pageMotion,
  replayEvents,
  wait,
  type BetRejection,
  type Motion,
  type RtpTracker,
} from '@casinogames/ui';
import type { Services } from '../../services.ts';
import { TOP_UP_BELOW } from '../../shell/topbar.ts';
import { createFelt, type BetOutlook, type Felt } from './felt.ts';
import { RangeStrip } from './range-strip.ts';

export interface EntreDadosTableOptions {
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

type Phase = 'loading' | 'betting' | 'playing';

/** Nominal pauses (the motion policy shortens or skips them). */
const AFTER_ROLL_MS = 450;
const TENSION_MS = 900;
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
 * One Entre Dados table: the game (with its six-deck shoe), the dice, the
 * dealer's card, the 1–6 strip, the felt and the controls.
 *
 * The engine decides everything in game.start(); the table then plays the
 * round's events in order: the roll, the winning range, the card dealt face
 * down, a pause, the reveal, and the settlement. Stakes are debited when the
 * player rolls and payouts credited at settlement; a round interrupted by
 * navigation or by closing the page is still paid out.
 */
export class EntreDadosTable {
  readonly element: HTMLElement;
  /** Resolves once the dice and the card views are ready. */
  readonly ready: Promise<void>;
  readonly #services: Services;
  readonly #tracker: RtpTracker;
  readonly #rng: Rng;
  readonly #motion: Motion;
  readonly #shoe: Shoe;
  readonly #game: EntreDadosGame;
  readonly #felt: Felt;
  readonly #strip = new RangeStrip();
  readonly #rail: ChipRail;
  readonly #controller: AutoPlayController;
  readonly #autoplay: AutoPlay;
  readonly #roll: HTMLButtonElement;
  readonly #clear: HTMLButtonElement;
  readonly #wallet: BankrollDisplay;
  readonly #betTotal = h('strong', { class: 'ed-bet__amount cg-num' });
  readonly #diceHost = h('div', { class: 'ed-stage__dice' });
  readonly #cardHost = h('div', { class: 'ed-stage__card' });
  readonly #abort = new AbortController();
  readonly #unsubscribe: (() => void)[] = [];
  #resultTimer: ReturnType<typeof setTimeout> | undefined;
  #roller: DiceRoller | undefined;
  #dealer: CardDealer | undefined;
  #phase: Phase = 'loading';
  /** A round the engine has settled but the table has not paid out yet. */
  #pending: RoundState<never, undefined> | null = null;
  /** The last round's summary, shown until the bets change. */
  #result: string | null = null;
  /** The strip's words for the card just revealed ("Card 3 · Entre wins"). */
  #reveal = '';
  #notice: string | null = null;
  /** True while the table itself places chips (the opening bet): no chip sound. */
  #placing = false;

  constructor(options: EntreDadosTableOptions) {
    this.#services = options.services;
    this.#tracker = options.tracker;
    this.#rng = options.rng ?? createCryptoRng();
    this.#motion = options.motion ?? pageMotion;
    this.#shoe = createEntreDadosShoe();
    this.#game = createEntreDados({ source: this.#shoe });

    this.#rail = new ChipRail({ value: 100, label: 'Chip value' });
    this.#felt = createFelt({
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
      { type: 'button', class: 'cg-btn cg-btn--primary ed-actions__roll' },
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
      canContinue: () => this.#phase === 'betting' && this.#problem() === null,
    });
    this.#autoplay = new AutoPlay({ controller: this.#controller });

    this.element = h(
      'section',
      { class: 'ed-table', 'aria-label': 'Entre Dados table' },
      h(
        'div',
        { class: 'ed-view' },
        h('div', { class: 'ed-stage' }, this.#diceHost, this.#cardHost),
        this.#strip.element,
      ),
      this.#felt.element,
      h(
        'div',
        { class: 'ed-controls' },
        h(
          'div',
          { class: 'ed-wallet' },
          this.#wallet.element,
          h('div', { class: 'ed-wallet__tools' }, ...(options.tools ?? [])),
          h(
            'div',
            { class: 'ed-bet' },
            h('span', { class: 'ed-bet__label' }, 'Bet'),
            this.#betTotal,
          ),
        ),
        this.#rail.element,
        h('div', { class: 'ed-actions' }, this.#clear, this.#roll, this.#autoplay.element),
      ),
    );

    this.#roll.addEventListener('click', () => this.#roller?.requestThrow());
    this.#clear.addEventListener('click', () => {
      for (const spot of Object.values(this.#felt.spots)) spot.clear();
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
      this.#felt.spots.entre.setAmount(OPENING_BET);
      this.#placing = false;
    }
    this.#refresh();
    this.ready = this.#init(options.renderer ?? 'auto');
  }

  get phase(): Phase {
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
    this.#strip.reset('Rolling…');
    this.#refresh();
    this.#bringStageIntoView();

    bankroll.debit(total);
    let state: RoundState<never, undefined>;
    try {
      state = this.#game.start(bets, this.#rng);
    } catch (error) {
      bankroll.credit(total);
      this.#phase = 'betting';
      this.#notice = error instanceof EngineError ? error.message : 'The round could not start.';
      this.#refresh();
      return;
    }
    this.#pending = state;

    const signal = this.#abort.signal;
    const shoe = this.#shoe;
    const entre = state.settlement.entre;
    try {
      await dealer.clear();
      await replayEvents(
        state.events,
        {
          'shoe-shuffled': async () => {
            dealer.setShoe(shoe.size(), shoe.size());
            await dealer.shuffle();
          },
          'dice-rolled': async ({ dice }) => {
            await roller.roll(dice, { power });
            if (signal.aborted) return;
            this.#showRoll(dice, bets);
            await wait(this.#motion.duration(AFTER_ROLL_MS), signal);
          },
          'card-dealt': async () => {
            dealer.setShoe(shoe.remaining(), shoe.size(), shoe.isCutCardOut());
            // Face down and faceless: the face arrives with card-revealed.
            await dealer.deal(null, ENTRE_DADOS_DEALER, { faceUp: false });
          },
          'card-revealed': async ({ card }) => {
            this.#strip.anticipate();
            await wait(this.#motion.duration(TENSION_MS), signal);
            if (signal.aborted) return;
            await dealer.reveal(ENTRE_DADOS_DEALER, 0, card);
            if (entre !== undefined) this.#strip.showCard(card.rank, entre.outcome);
            this.#reveal = this.#strip.caption;
          },
        },
        { signal },
      );
    } catch (error) {
      // A view torn down mid-animation (the page closed) is not a failure:
      // destroy() has already paid the round out.
      if (!signal.aborted) throw error;
    }
    if (signal.aborted) return;
    this.#settle(state);
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
    this.#felt.destroy();
    this.#rail.destroy();
    this.#wallet.destroy();
    this.element.remove();
  }

  async #init(renderer: 'auto' | 'dom'): Promise<void> {
    const { sound } = this.#services;
    const [roller, dealer] = await Promise.all([
      DiceRoller.create({
        host: this.#diceHost,
        motion: this.#motion,
        sound,
        renderer,
        initial: [2, 5],
        label: 'Roll the dice',
        onThrow: (power) => void this.play(power),
      }),
      CardDealer.create({
        host: this.#cardHost,
        hands: [{ id: ENTRE_DADOS_DEALER, label: 'Dealer', x: 0.29, y: 0.5 }],
        motion: this.#motion,
        sound,
        renderer,
        cardScale: 2,
      }),
    ]);
    if (this.#abort.signal.aborted) {
      roller.destroy();
      dealer.destroy();
      return;
    }
    this.#roller = roller;
    this.#dealer = dealer;
    dealer.setShoe(this.#shoe.remaining(), this.#shoe.size(), this.#shoe.isCutCardOut());
    this.#phase = 'betting';
    this.#refresh();
  }

  /** The dice and the card must be on screen when the round plays. */
  #bringStageIntoView(): void {
    const stage = this.#diceHost.parentElement;
    if (stage === null || typeof stage.scrollIntoView !== 'function') return;
    const { top, bottom } = stage.getBoundingClientRect();
    if (top >= 0 && bottom <= window.innerHeight) return;
    stage.scrollIntoView({
      block: 'start',
      behavior: this.#motion.level === 'full' ? 'smooth' : 'auto',
    });
  }

  /** Shows the range on the strip, the spread on the felt and each bet's outlook. */
  #showRoll(dice: DicePair, bets: Bets): void {
    this.#strip.showRoll(dice);
    this.#felt.showSpread(readEntreDadosRoll(dice).spread);
    const outlook: Partial<Record<EntreDadosBetId, BetOutlook>> = {};
    for (const { id } of ENTRE_DADOS_BETS) {
      if (bets[id] !== undefined) outlook[id] = outlookOf(id, dice);
    }
    this.#felt.showOutlook(outlook);
  }

  /** Pays a settled round out: results on the felt, credit, sounds and RTP stats. */
  #settle(state: RoundState<never, undefined>): void {
    if (this.#pending !== state) return;
    this.#pending = null;
    const { bankroll, sound } = this.#services;
    this.#felt.showOutlook(null);
    for (const [id, line] of Object.entries(state.settlement)) {
      this.#felt.spots[id as EntreDadosBetId].setResult(line);
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
    if (this.#pending !== null) this.#settle(this.#pending);
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

  /** Clears each spot's result and outlook; the round's summary stays in the caption. */
  #clearMarks(): void {
    clearTimeout(this.#resultTimer);
    this.#resultTimer = undefined;
    for (const spot of Object.values(this.#felt.spots)) spot.setResult(null);
    this.#felt.showOutlook(null);
  }

  #placedBets(): Bets {
    const bets: Record<string, Cents> = {};
    for (const [id, spot] of Object.entries(this.#felt.spots)) {
      if (spot.amount > 0) bets[id] = spot.amount;
    }
    return bets;
  }

  #total(): Cents {
    return Object.values(this.#felt.spots).reduce((sum, spot) => sum + spot.amount, 0);
  }

  /** Why the bets on the felt cannot be played, or null if they can. */
  #problem(): string | null {
    const total = this.#total();
    if (this.#felt.spots.entre.amount === 0) {
      return total === 0
        ? 'Place a bet on Entre, then roll the dice.'
        : 'Side bets ride on Entre: add a chip to Entre.';
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
    this.#autoplay.setDisabled(this.#phase === 'loading' || problem !== null);
    for (const spot of Object.values(this.#felt.spots)) spot.setLocked(!betting || running);
    if (betting) {
      this.#rail.setBalance(Math.max(0, this.#services.bankroll.balance - this.#total()));
    }
    // While a round plays the strip narrates it; otherwise it carries the hints.
    if (this.#phase === 'loading') this.#strip.say('Setting up the table…');
    else if (betting && !running) {
      this.#strip.say(this.#notice ?? this.#result ?? problem ?? 'Tap the dice or press Roll.');
    }
  }
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What the roll alone decides for a bet, from its outcome over the six card values. */
function outlookOf(bet: EntreDadosBetId, dice: DicePair): BetOutlook {
  const outcomes = new Set(DIE_FACES.map((card) => resolveEntreDadosBet(bet, dice, card).outcome));
  if (outcomes.size > 1) return 'live';
  if (outcomes.has('win')) return 'won';
  return outcomes.has('push') ? 'push' : 'out';
}
