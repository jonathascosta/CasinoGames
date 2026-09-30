import {
  ALVO_MOVEL_BETS,
  ALVO_MOVEL_DEALER,
  alvoMovelOutlook,
  cardValue,
  createAlvoMovel,
  createAlvoMovelShoe,
  readAlvoMovelDeal,
  targetOf,
  type AlvoMovelBetId,
  type Bets,
  type RoundState,
  type Target,
} from '@casinogames/engine';
import { h, wait } from '@casinogames/ui';
import { DiceTable, type RoundContext, type TableOptions, type TablePhase } from '../dice-table.ts';
import type { BetOutlook } from '../spots.ts';
import type { TableFelt } from '../spots.ts';
import { createFelt } from './felt.ts';
import { TargetBoard, chanceToEnd } from './target-board.ts';

/** Nominal pauses (the motion policy shortens or skips them; turbo deals instantly). */
const LOCK_MS = 650;
/** Before a card turns: a beat, plus up to this much more as the card gets likelier to end the deal. */
const TURN_MS = 160;
const TENSION_MS = 720;

const OUTLOOKS = { live: 'live', won: 'won', lost: 'out' } as const satisfies Record<
  string,
  BetOutlook
>;

/**
 * One Alvo Móvel table: the game (with its six-deck shoe of aces to tens),
 * the dice, the target board, the dealer's cards and the felt, on the shared
 * table (bets, chips, balance, autoplay and the round's life: see DiceTable).
 *
 * A round plays as the engine recorded it: the roll, the target locking in
 * with its payout lit on the board's paytable, then the cards one at a time. Each lands
 * face down and turns after a pause that grows with its chance to end the
 * deal (a public figure: the gap left to the target), so the last card is
 * the reveal. The side bets are marked as soon as the cards decide them.
 */
export class AlvoMovelTable {
  readonly element: HTMLElement;
  /** Resolves once the dice and the card views are ready. */
  readonly ready: Promise<void>;
  readonly #table: DiceTable<AlvoMovelBetId>;
  readonly #board = new TargetBoard();
  #felt!: TableFelt<AlvoMovelBetId>;

  constructor(options: TableOptions) {
    const shoe = createAlvoMovelShoe();
    const diceHost = h('div', { class: 'tb-box' });
    const cardHost = h('div', { class: 'tb-box am-cards' });
    this.#table = new DiceTable<AlvoMovelBetId>(options, {
      label: 'Alvo Móvel table',
      className: 'am-table',
      game: createAlvoMovel({ source: shoe }),
      shoe,
      mainBet: { id: 'acerta', label: 'Acerta' },
      view: h(
        'div',
        { class: 'tb-view am-view' },
        h('div', { class: 'am-stage' }, diceHost, this.#board.hero),
        this.#board.track,
        cardHost,
        this.#board.readout,
      ),
      diceHost,
      cardHost,
      initialDice: [3, 4],
      // A little above the middle, so the label fits under the cards in short boxes.
      hands: [{ id: ALVO_MOVEL_DEALER, label: 'Dealer', x: 0.4, y: 0.44 }],
      cardScale: 2,
      createFelt: (callbacks) => (this.#felt = createFelt(callbacks)),
      narrate: (text) => {
        this.#board.say(text);
      },
      beginRound: () => {
        this.#board.reset();
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

  async #playRound(_state: RoundState<never, undefined>, round: RoundContext): Promise<string> {
    const { roller, dealer, bets, power, signal, motion } = round;
    // Set by the dice-rolled handler (a closure the checker cannot follow).
    let target = null as Target | null;
    const values: number[] = [];
    await round.replay({
      'dice-rolled': async ({ dice }) => {
        await roller.roll(dice, { power });
        if (signal.aborted) return;
        target = targetOf(dice);
        this.#board.lockTarget(target);
        this.#showOutlook(target, values, bets);
        await wait(motion.duration(LOCK_MS), signal);
      },
      'card-dealt': async ({ card }) => {
        if (target === null) return;
        const gap = target - values.reduce((sum, value) => sum + value, 0);
        const chance = chanceToEnd(gap);
        await dealer.deal(null, ALVO_MOVEL_DEALER, { faceUp: false });
        this.#board.anticipate(chance);
        await wait(motion.duration(TURN_MS + TENSION_MS * chance), signal);
        if (signal.aborted) return;
        await dealer.reveal(ALVO_MOVEL_DEALER, values.length, card);
        values.push(cardValue(card.rank));
        this.#board.showDeal(readAlvoMovelDeal(target, values), values);
        this.#showOutlook(target, values, bets);
      },
    });
    return target === null ? '' : this.#board.caption;
  }

  /** Marks what the target and the cards so far leave each placed bet. */
  #showOutlook(target: Target, values: readonly number[], bets: Bets): void {
    const outlook: Partial<Record<AlvoMovelBetId, BetOutlook>> = {};
    for (const { id } of ALVO_MOVEL_BETS) {
      if (bets[id] !== undefined) outlook[id] = OUTLOOKS[alvoMovelOutlook(id, target, values)];
    }
    this.#felt.showOutlook(outlook);
  }
}
