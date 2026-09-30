import {
  TRANCAR_BET,
  TRANCAR_CONFIG,
  TRANCAR_DEALER,
  createTrancar,
  createTrancarShoe,
  diceTotal,
  lockChoice,
  lockedDie,
  otherDie,
  paidRerollFee,
  trancarStrategy,
  type DicePair,
  type DieIndex,
  type DieRerolledEvent,
  type TrancarBetId,
  type TrancarChoice,
  type TrancarData,
  type TrancarState,
} from '@casinogames/engine';
import { formatCents, h, wait, type DiceRoller } from '@casinogames/ui';
import { DiceTable, type RoundContext, type TableOptions, type TablePhase } from '../dice-table.ts';
import { DecisionBar } from './decision.ts';
import { createFelt } from './felt.ts';
import { Scoreboard } from './scoreboard.ts';

type TrancarRound = RoundContext<DieRerolledEvent, TrancarChoice, TrancarData>;

/** Nominal pauses (the motion policy shortens or skips them; turbo plays at once). */
const DICE_MS = 360;
/** Autoplay shows the die it locks before the re-roll. */
const AUTO_LOCK_MS = 620;
/** Before each dealer card. */
const CARD_MS = 240;

const ASK = 'Tap a die to lock it and re-roll the other, or Ficar to stand.';

const held = (index: DieIndex | null): readonly [boolean, boolean] => [index === 0, index === 1];

/**
 * A die as the player sees it: "the 6", or on a double "the left 3" and
 * "the right 3" (the first die rests on the left).
 */
export function dieName(dice: DicePair, index: DieIndex): string {
  const side = dice[0] === dice[1] ? `${index === 0 ? 'left' : 'right'} ` : '';
  return `the ${side}${String(dice[index])}`;
}

/** The die a re-roll throws: "the 2", or on a double "the other". */
function otherName(dice: DicePair, locked: DieIndex): string {
  return dice[0] === dice[1] ? 'the other' : `the ${String(dice[otherDie(locked)])}`;
}

/** The fee the round's Trancar options carry: none on a free re-roll. */
function feeOf(state: TrancarState): number {
  return state.options.find((option) => option.choice !== 'ficar')?.fee?.amount ?? 0;
}

/**
 * One Trancar table: the game (with its six-deck shoe of aces to sixes),
 * the dealer's cards, the totals side by side and the dice, with the
 * decision under them, on the shared table (bets, chips, balance, autoplay
 * and the round's life: see DiceTable).
 *
 * A round plays as the engine runs it: the dice roll and the round waits
 * for the player's decision. Tapping a die locks it (a padlock) and reveals
 * Trancar with its fee; Trancar takes the fee at once and re-rolls the other
 * die, Ficar stands. The dealer's two cards then land face up and the
 * higher total is highlighted. Autoplay decides with the reference strategy.
 */
export class TrancarTable {
  readonly element: HTMLElement;
  /** Resolves once the dice and the card views are ready. */
  readonly ready: Promise<void>;
  readonly #table: DiceTable<TrancarBetId, DieRerolledEvent, TrancarChoice, TrancarData>;
  readonly #scoreboard = new Scoreboard();
  readonly #decision = new DecisionBar();
  readonly #caption: HTMLElement;
  readonly #strategy = trancarStrategy();
  #roller: DiceRoller | null = null;

  constructor(options: TableOptions) {
    const shoe = createTrancarShoe();
    const game = createTrancar({ source: shoe });
    const cardHost = h('div', { class: 'tb-box tr-box tr-cards' });
    const diceHost = h('div', { class: 'tb-box tr-box tr-dice' });
    this.#caption = h('p', { class: 'tr-caption', 'aria-live': 'polite' });
    const view = h(
      'div',
      { class: 'tb-view tr-view' },
      cardHost,
      this.#scoreboard.element,
      diceHost,
      this.#decision.element,
      this.#caption,
    );
    this.#table = new DiceTable<TrancarBetId, DieRerolledEvent, TrancarChoice, TrancarData>(
      options,
      {
        label: 'Trancar table',
        className: 'tr-table',
        game,
        shoe,
        mainBet: { id: TRANCAR_BET, label: 'Trancar' },
        view,
        diceHost,
        cardHost,
        initialDice: [5, 2],
        hands: [{ id: TRANCAR_DEALER, x: 0.5, y: 0.5 }],
        cardScale: 1.6,
        createFelt,
        narrate: (text) => {
          this.#say(text);
        },
        beginRound: () => {
          this.#scoreboard.reset();
          this.#decision.close();
          this.#roller?.withdrawDice();
        },
        playRound: (state, round) => this.#playRound(state, round),
        // A round that must end without the player's decision stands: no fee without a choice.
        defaultChoice: () => 'ficar',
        reserve: (bets) => paidRerollFee(bets[TRANCAR_BET] ?? 0, TRANCAR_CONFIG.rules),
        clearMarks: () => {
          this.#roller?.withdrawDice();
        },
      },
    );
    this.element = this.#table.element;
    this.ready = this.#table.ready;
  }

  get phase(): TablePhase {
    return this.#table.phase;
  }

  /** The totals side by side, for tests and the page. */
  get scoreboard(): Scoreboard {
    return this.#scoreboard;
  }

  /** The decision bar, for tests and the page. */
  get decision(): DecisionBar {
    return this.#decision;
  }

  /** Plays one round with the bets on the felt (the dice tray, Roll and autoplay call this). */
  play(power?: number): Promise<void> {
    return this.#table.play(power);
  }

  destroy(): void {
    this.#table.destroy();
    this.#decision.destroy();
  }

  #say(text: string): void {
    this.#caption.textContent = text;
  }

  async #playRound(state: TrancarState, round: TrancarRound): Promise<string> {
    const { roller, dealer, power, signal, motion } = round;
    this.#roller = roller;
    const scoreboard = this.#scoreboard;
    // Set by the event handlers (closures the checker cannot follow).
    let dice = null as DicePair | null;
    const cards: number[] = [];
    await round.replay({
      'dice-rolled': async (event) => {
        await roller.roll(event.dice, { power });
        if (signal.aborted) return;
        dice = event.dice;
        scoreboard.setDice(diceTotal(event.dice));
        await wait(motion.duration(DICE_MS), signal);
      },
    });
    if (signal.aborted || state.phase !== 'awaiting-decision') return '';

    const choice = round.autoplay
      ? await this.#autoplayChoice(state, round)
      : await this.#ask(state, round);
    const locked = lockedDie(choice);
    round.decide(choice);
    await round.replay({
      'fee-charged': ({ amount }) => {
        this.#say(`Trancar: ${formatCents(amount)} paid, re-rolling…`);
      },
      'die-rerolled': async (event) => {
        await roller.roll(event.dice, { power: 0.45, keep: held(locked) });
        if (signal.aborted) return;
        dice = event.dice;
        scoreboard.setDice(diceTotal(event.dice));
        await wait(motion.duration(DICE_MS), signal);
      },
      'card-dealt': async ({ card }) => {
        await wait(motion.duration(CARD_MS), signal);
        if (signal.aborted) return;
        await dealer.deal(card, TRANCAR_DEALER, { faceUp: true });
        cards.push(card.rank);
        scoreboard.setCards(cards);
      },
    });
    if (dice === null || cards.length < 2) return '';
    const total = diceTotal(dice);
    const dealt = cards[0]! + cards[1]!;
    scoreboard.settle(total, dealt);
    return `Your ${String(total)} against the dealer's ${String(dealt)}`;
  }

  /**
   * Asks the player. The dice become buttons: tapping one locks it (or
   * unlocks it) and reveals Trancar with its fee; Ficar stands at any time.
   */
  #ask(state: TrancarState, round: TrancarRound): Promise<TrancarChoice> {
    const { roller, signal } = round;
    const { dice } = state.data;
    const fee = feeOf(state);
    return new Promise<TrancarChoice>((resolve, reject) => {
      let locked: DieIndex | null = null;
      const onAbort = () => {
        reject(new Error('The table closed before the decision'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      const choose = (choice: TrancarChoice) => {
        signal.removeEventListener('abort', onAbort);
        roller.setHeld(held(lockedDie(choice)), { final: true });
        this.#decision.close();
        resolve(choice);
      };
      roller.offerDice({
        label: (index) => `Lock ${dieName(dice, index)}`,
        onPick: (index) => {
          locked = locked === index ? null : index;
          roller.setHeld(held(locked));
          this.#decision.setLocked(locked);
          this.#say(
            locked === null
              ? ASK
              : `Locked ${dieName(dice, locked)}. Trancar re-rolls ${otherName(dice, locked)}.`,
          );
        },
      });
      this.#decision.open({
        dice,
        fee,
        affordable: round.canAfford(lockChoice(0)),
        advice: this.#strategy(state),
        onChoose: (kind) => {
          choose(kind === 'ficar' || locked === null ? 'ficar' : lockChoice(locked));
        },
      });
      this.#say(ASK);
    });
  }

  /** Autoplay decides with the reference strategy, showing the die it locks. */
  async #autoplayChoice(state: TrancarState, round: TrancarRound): Promise<TrancarChoice> {
    const { roller, signal, motion } = round;
    const { dice } = state.data;
    let choice = this.#strategy(state);
    if (choice !== 'ficar' && !round.canAfford(choice)) choice = 'ficar';
    const locked = lockedDie(choice);
    if (locked === null) {
      this.#say(`Autoplay: Ficar on ${String(diceTotal(dice))}.`);
      return choice;
    }
    roller.offerDice({ label: (index) => `Lock ${dieName(dice, index)}`, onPick: () => undefined });
    roller.setHeld(held(locked), { final: true });
    const fee = feeOf(state);
    this.#say(
      `Autoplay: Trancar, ${dieName(dice, locked)} locked (${fee === 0 ? 'free' : `+${formatCents(fee)}`}).`,
    );
    await wait(motion.duration(AUTO_LOCK_MS), signal);
    return choice;
  }
}
