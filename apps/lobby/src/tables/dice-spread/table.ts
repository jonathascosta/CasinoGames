import {
  DIE_FACES,
  DICE_SPREAD_BETS,
  DICE_SPREAD_DEALER,
  createDiceSpread,
  createDiceSpreadShoe,
  readDiceSpreadRoll,
  resolveDiceSpreadBet,
  type Bets,
  type DicePair,
  type DiceSpreadBetId,
  type RoundState,
} from '@casinogames/engine';
import { h, wait } from '@casinogames/ui';
import { DiceTable, type RoundContext, type TableOptions, type TablePhase } from '../dice-table.ts';
import type { BetOutlook } from '../spots.ts';
import { createFelt, type DiceSpreadFelt } from './felt.ts';
import { RangeStrip } from './range-strip.ts';

/** Nominal pauses (the motion policy shortens or skips them). */
const AFTER_ROLL_MS = 450;
const TENSION_MS = 900;

/**
 * One Dice Spread table: the game (with its six-deck shoe), the dice, the
 * dealer's card, the 1–6 strip and the felt, on the shared table (bets,
 * chips, balance, autoplay and the round's life: see DiceTable).
 *
 * A round plays as the engine recorded it: the roll, the winning range on
 * the strip, the card dealt face down, a pause, the reveal, the settlement.
 */
export class DiceSpreadTable {
  readonly element: HTMLElement;
  /** Resolves once the dice and the card views are ready. */
  readonly ready: Promise<void>;
  readonly #table: DiceTable<DiceSpreadBetId>;
  readonly #strip = new RangeStrip();
  #felt!: DiceSpreadFelt;

  constructor(options: TableOptions) {
    const shoe = createDiceSpreadShoe();
    const diceHost = h('div', { class: 'tb-box' });
    const cardHost = h('div', { class: 'tb-box' });
    this.#table = new DiceTable<DiceSpreadBetId>(options, {
      label: 'Dice Spread table',
      className: 'ds-table',
      game: createDiceSpread({ source: shoe }),
      shoe,
      mainBet: { id: 'between', label: 'Between' },
      view: h(
        'div',
        { class: 'tb-view ds-view' },
        h('div', { class: 'ds-stage' }, diceHost, cardHost),
        this.#strip.element,
      ),
      diceHost,
      cardHost,
      initialDice: [2, 5],
      hands: [{ id: DICE_SPREAD_DEALER, label: 'Dealer', x: 0.29, y: 0.5 }],
      cardScale: 2,
      createFelt: (callbacks) => (this.#felt = createFelt(callbacks)),
      narrate: (text) => {
        this.#strip.say(text);
      },
      beginRound: () => {
        this.#strip.reset('Rolling…');
      },
      playRound: (state, round) => this.#playRound(state, round),
    });
    this.element = this.#table.element;
    this.ready = this.#table.ready;
  }

  get phase(): TablePhase {
    return this.#table.phase;
  }

  /** Plays one round with the bets on the felt (the dice tray, Roll and autoplay call this). */
  play(power?: number): Promise<void> {
    return this.#table.play(power);
  }

  destroy(): void {
    this.#table.destroy();
  }

  async #playRound(state: RoundState<never, undefined>, round: RoundContext): Promise<string> {
    const { roller, dealer, bets, power, signal, motion } = round;
    const between = state.settlement.between;
    let reveal = '';
    await round.replay({
      'dice-rolled': async ({ dice }) => {
        await roller.roll(dice, { power });
        if (signal.aborted) return;
        this.#showRoll(dice, bets);
        await wait(motion.duration(AFTER_ROLL_MS), signal);
      },
      'card-dealt': async () => {
        // Face down and faceless: the face arrives with card-revealed.
        await dealer.deal(null, DICE_SPREAD_DEALER, { faceUp: false });
      },
      'card-revealed': async ({ card }) => {
        this.#strip.anticipate();
        await wait(motion.duration(TENSION_MS), signal);
        if (signal.aborted) return;
        await dealer.reveal(DICE_SPREAD_DEALER, 0, card);
        if (between !== undefined) this.#strip.showCard(card.rank, between.outcome);
        reveal = this.#strip.caption;
      },
    });
    return reveal;
  }

  /** Shows the range on the strip, the spread on the felt and each bet's outlook. */
  #showRoll(dice: DicePair, bets: Bets): void {
    this.#strip.showRoll(dice);
    this.#felt.showSpread(readDiceSpreadRoll(dice).spread);
    const outlook: Partial<Record<DiceSpreadBetId, BetOutlook>> = {};
    for (const { id } of DICE_SPREAD_BETS) {
      if (bets[id] !== undefined) outlook[id] = outlookOf(id, dice);
    }
    this.#felt.showOutlook(outlook);
  }
}

/** What the roll alone decides for a bet, from its outcome over the six card values. */
function outlookOf(bet: DiceSpreadBetId, dice: DicePair): BetOutlook {
  const outcomes = new Set(DIE_FACES.map((card) => resolveDiceSpreadBet(bet, dice, card).outcome));
  if (outcomes.size > 1) return 'live';
  if (outcomes.has('win')) return 'won';
  return outcomes.has('push') ? 'push' : 'out';
}
