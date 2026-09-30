import {
  LOCK_AND_ROLL_BET,
  LOCK_AND_ROLL_CONFIG,
  LOCK_AND_ROLL_DEALER,
  createLockAndRoll,
  createLockAndRollShoe,
  diceTotal,
  lockChoice,
  lockedDie,
  otherDie,
  paidLockFee,
  lockAndRollStrategy,
  type DicePair,
  type DieIndex,
  type DieRerolledEvent,
  type LockAndRollBetId,
  type LockAndRollChoice,
  type LockAndRollData,
  type LockAndRollState,
} from '@casinogames/engine';
import { formatCents, h, wait, type DiceRoller } from '@casinogames/ui';
import { DiceTable, type RoundContext, type TableOptions, type TablePhase } from '../dice-table.ts';
import { DecisionBar } from './decision.ts';
import { createFelt } from './felt.ts';
import { Scoreboard } from './scoreboard.ts';

type LockAndRollRound = RoundContext<DieRerolledEvent, LockAndRollChoice, LockAndRollData>;

/** Nominal pauses (the motion policy shortens or skips them; turbo plays at once). */
const DICE_MS = 360;
/** Autoplay shows the die it locks before the re-roll. */
const AUTO_LOCK_MS = 620;
/** Before each dealer card. */
const CARD_MS = 240;

const ASK = 'Tap a die to lock it and re-roll the other, or press Stand.';

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

/** The Lock fee the round's Lock options carry: none on a free re-roll. */
function feeOf(state: LockAndRollState): number {
  return state.options.find((option) => option.choice !== 'stand')?.fee?.amount ?? 0;
}

/**
 * One Lock & Roll table: the game (with its six-deck shoe of aces to sixes),
 * the dealer's cards, the totals side by side and the dice, with the
 * decision under them, on the shared table (bets, chips, balance, autoplay
 * and the round's life: see DiceTable).
 *
 * A round plays as the engine runs it: the dice roll and the round waits
 * for the player's decision. Tapping a die locks it (a padlock) and reveals
 * Lock with its fee; Lock takes the fee at once and re-rolls the other
 * die, Stand keeps the roll. The dealer's two cards then land face up and the
 * higher total is highlighted. Autoplay decides with the reference strategy.
 */
export class LockAndRollTable {
  readonly element: HTMLElement;
  /** Resolves once the dice and the card views are ready. */
  readonly ready: Promise<void>;
  readonly #table: DiceTable<
    LockAndRollBetId,
    DieRerolledEvent,
    LockAndRollChoice,
    LockAndRollData
  >;
  readonly #scoreboard = new Scoreboard();
  readonly #decision = new DecisionBar();
  readonly #caption: HTMLElement;
  readonly #strategy = lockAndRollStrategy();
  #roller: DiceRoller | null = null;

  constructor(options: TableOptions) {
    const shoe = createLockAndRollShoe();
    const game = createLockAndRoll({ source: shoe });
    const cardHost = h('div', { class: 'tb-box lr-box lr-cards' });
    const diceHost = h('div', { class: 'tb-box lr-box lr-dice' });
    this.#caption = h('p', { class: 'lr-caption', 'aria-live': 'polite' });
    const view = h(
      'div',
      { class: 'tb-view lr-view' },
      cardHost,
      this.#scoreboard.element,
      diceHost,
      this.#decision.element,
      this.#caption,
    );
    this.#table = new DiceTable<
      LockAndRollBetId,
      DieRerolledEvent,
      LockAndRollChoice,
      LockAndRollData
    >(options, {
      label: 'Lock & Roll table',
      className: 'lr-table',
      game,
      shoe,
      mainBet: { id: LOCK_AND_ROLL_BET, label: 'Lock & Roll' },
      view,
      diceHost,
      cardHost,
      initialDice: [5, 2],
      hands: [{ id: LOCK_AND_ROLL_DEALER, x: 0.5, y: 0.5 }],
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
      defaultChoice: () => 'stand',
      reserve: (bets) => paidLockFee(bets[LOCK_AND_ROLL_BET] ?? 0, LOCK_AND_ROLL_CONFIG.rules),
      clearMarks: () => {
        this.#roller?.withdrawDice();
      },
    });
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

  async #playRound(state: LockAndRollState, round: LockAndRollRound): Promise<string> {
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
        this.#say(`Lock fee ${formatCents(amount)} paid, re-rolling…`);
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
        await dealer.deal(card, LOCK_AND_ROLL_DEALER, { faceUp: true });
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
   * unlocks it) and reveals Lock with its fee; Stand keeps the roll at any time.
   */
  #ask(state: LockAndRollState, round: LockAndRollRound): Promise<LockAndRollChoice> {
    const { roller, signal } = round;
    const { dice } = state.data;
    const fee = feeOf(state);
    return new Promise<LockAndRollChoice>((resolve, reject) => {
      let locked: DieIndex | null = null;
      const onAbort = () => {
        reject(new Error('The table closed before the decision'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      const choose = (choice: LockAndRollChoice) => {
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
              : `Locked ${dieName(dice, locked)}. Press Lock to re-roll ${otherName(dice, locked)}.`,
          );
        },
      });
      this.#decision.open({
        dice,
        fee,
        affordable: round.canAfford(lockChoice(0)),
        advice: this.#strategy(state),
        onChoose: (kind) => {
          choose(kind === 'stand' || locked === null ? 'stand' : lockChoice(locked));
        },
      });
      this.#say(ASK);
    });
  }

  /** Autoplay decides with the reference strategy, showing the die it locks. */
  async #autoplayChoice(
    state: LockAndRollState,
    round: LockAndRollRound,
  ): Promise<LockAndRollChoice> {
    const { roller, signal, motion } = round;
    const { dice } = state.data;
    let choice = this.#strategy(state);
    if (choice !== 'stand' && !round.canAfford(choice)) choice = 'stand';
    const locked = lockedDie(choice);
    if (locked === null) {
      this.#say(`Autoplay: Stand on ${String(diceTotal(dice))}.`);
      return choice;
    }
    roller.offerDice({ label: (index) => `Lock ${dieName(dice, index)}`, onPick: () => undefined });
    roller.setHeld(held(locked), { final: true });
    const fee = feeOf(state);
    this.#say(
      `Autoplay: Lock ${dieName(dice, locked)} (${fee === 0 ? 'free' : `+${formatCents(fee)}`}).`,
    );
    await wait(motion.duration(AUTO_LOCK_MS), signal);
    return choice;
  }
}
