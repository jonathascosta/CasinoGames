import {
  ESPELHO_BET_IDS,
  ESPELHO_DEALER,
  createEspelho,
  createEspelhoJackpot,
  createEspelhoShoe,
  espelhoOutlook,
  type Bets,
  type Cents,
  type EspelhoBetId,
  type EspelhoGame,
  type HandValues,
  type JackpotMeterEvent,
  type ProgressiveJackpot,
  type RoundState,
} from '@casinogames/engine';
import {
  createStore,
  formatCents,
  h,
  motion as pageMotion,
  readJackpotState,
  wait,
  writeJackpotState,
  type SafeStorage,
  type Store,
} from '@casinogames/ui';
import { DiceTable, type RoundContext, type TableOptions, type TablePhase } from '../dice-table.ts';
import type { BetOutlook } from '../spots.ts';
import { createFelt, type EspelhoFelt } from './felt.ts';
import { Mirror } from './mirror.ts';

/** Nominal pauses (the motion policy shortens or skips them; turbo deals instantly). */
const DICE_MS = 420;
/** Before each card turns: a beat, and more when the card still decides the main bet. */
const TURN_MS = 200;
const TENSION_MS = 520;

const OUTLOOKS = { live: 'live', won: 'won', lost: 'out' } as const satisfies Record<
  string,
  BetOutlook
>;

/**
 * The table's meter, carried on from what the browser stored after the last
 * round; a missing or unusable state starts it at its seed.
 */
function restoreJackpot(storage: SafeStorage): ProgressiveJackpot {
  const fresh = createEspelhoJackpot();
  const stored = readJackpotState(storage, fresh.id);
  if (stored === undefined) return fresh;
  try {
    return createEspelhoJackpot(stored);
  } catch {
    return fresh;
  }
}

/**
 * One Espelho table: the game (with its six-deck shoe of aces to sixes and
 * its progressive meter), the mirror (the dealer's cards above, the dice
 * below) and the felt with the meter across the top, on the shared table
 * (bets, chips, balance, autoplay and the round's life: see DiceTable).
 *
 * A round plays as the engine recorded it: a 6-6 vs 6-6 stake feeds the
 * meter, the dice roll and their hand is read, the dealer's two cards land
 * face down and turn one at a time, and the mirror tilts toward the winner.
 * The meter is stored after every round and shown in the lobby.
 */
export class EspelhoTable {
  readonly element: HTMLElement;
  /** Resolves once the dice and the card views are ready. */
  readonly ready: Promise<void>;
  /** The live meter, by jackpot id, for the RTP monitor. */
  readonly meters: Readonly<Record<string, Store<Cents>>>;
  readonly #table: DiceTable<EspelhoBetId, JackpotMeterEvent>;
  readonly #mirror = new Mirror();
  readonly #game: EspelhoGame;
  readonly #meter: Store<Cents>;
  #felt!: EspelhoFelt;

  constructor(options: TableOptions) {
    const { storage } = options.services;
    const shoe = createEspelhoShoe();
    const game = createEspelho({ source: shoe, jackpot: restoreJackpot(storage) });
    const { jackpot } = game;
    this.#game = game;
    this.#meter = createStore(jackpot.amount);
    this.meters = { [jackpot.id]: this.#meter };
    const mirror = this.#mirror;
    this.#table = new DiceTable<EspelhoBetId, JackpotMeterEvent>(options, {
      label: 'Espelho table',
      className: 'es-table',
      game: {
        ...game,
        // The engine settles the whole round here: store the meter at once,
        // so a page closed mid-animation keeps it.
        start(bets, rng) {
          const state = game.start(bets, rng);
          writeJackpotState(storage, jackpot.id, jackpot.state());
          return state;
        },
      },
      shoe,
      mainBet: { id: 'espelho', label: 'Espelho' },
      view: h('div', { class: 'tb-view es-view' }, mirror.element, mirror.caption),
      diceHost: mirror.diceHost,
      cardHost: mirror.cardHost,
      initialDice: [3, 4],
      hands: [{ id: ESPELHO_DEALER, x: 0.5, y: 0.5 }],
      cardScale: 1.7,
      createFelt: (callbacks) =>
        (this.#felt = createFelt(callbacks, this.#meter, options.motion ?? pageMotion)),
      narrate: (text) => {
        mirror.say(text);
      },
      beginRound: () => {
        mirror.reset();
      },
      playRound: (state, round) => this.#playRound(state, round),
    });
    this.element = this.#table.element;
    this.ready = this.#table.ready;
  }

  get phase(): TablePhase {
    return this.#table.phase;
  }

  /** The mirror, for tests and the page. */
  get mirror(): Mirror {
    return this.#mirror;
  }

  /** Plays one round with the bets on the felt (the dice tray, Roll and autoplay call this). */
  play(power?: number): Promise<void> {
    return this.#table.play(power);
  }

  destroy(): void {
    this.#table.destroy();
    // Whatever the round showed, the meter is what the engine holds.
    this.#meter.set(this.#game.jackpot.amount);
  }

  async #playRound(
    _state: RoundState<never, undefined, JackpotMeterEvent>,
    round: RoundContext<JackpotMeterEvent>,
  ): Promise<string> {
    const { roller, dealer, bets, power, signal, motion } = round;
    const mirror = this.#mirror;
    // Set by the dice-rolled handler (a closure the checker cannot follow).
    let dice = null as HandValues | null;
    const values: number[] = [];
    let won = 0;
    await round.replay({
      'jackpot-meter': ({ amount }) => {
        this.#meter.set(amount);
      },
      'dice-rolled': async (event) => {
        await roller.roll(event.dice, { power });
        if (signal.aborted) return;
        dice = event.dice;
        mirror.showDice(event.dice);
        this.#showOutlook(event.dice, values, bets);
        await wait(motion.duration(DICE_MS), signal);
      },
      'card-dealt': async () => {
        await dealer.deal(null, ESPELHO_DEALER, { faceUp: false });
      },
      'card-revealed': async ({ card, index }) => {
        if (dice === null) return;
        const open = espelhoOutlook('espelho', dice, values) === 'live';
        await wait(motion.duration(TURN_MS + (open ? TENSION_MS : 0)), signal);
        if (signal.aborted) return;
        await dealer.reveal(ESPELHO_DEALER, index, card);
        values.push(card.rank);
        mirror.showCards(values);
        this.#showOutlook(dice, values, bets);
        if (values.length === 2) mirror.settle(dice, [values[0]!, values[1]!]);
      },
      'jackpot-won': ({ amount }) => {
        won = amount;
      },
    });
    if (dice === null || values.length < 2) return '';
    const [player, dealt] = mirror.labels;
    const summary = `${player} against ${dealt}`;
    return won > 0 ? `${summary} · 6-6 vs 6-6 takes ${formatCents(won)} from the meter` : summary;
  }

  /** Marks what the dice and the cards so far leave each placed bet. */
  #showOutlook(dice: HandValues, values: readonly number[], bets: Bets): void {
    const outlook: Partial<Record<EspelhoBetId, BetOutlook>> = {};
    for (const id of ESPELHO_BET_IDS) {
      if (bets[id] !== undefined) outlook[id] = OUTLOOKS[espelhoOutlook(id, dice, values)];
    }
    this.#felt.showOutlook(outlook);
  }
}
