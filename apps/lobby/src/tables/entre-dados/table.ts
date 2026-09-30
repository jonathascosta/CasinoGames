import {
  DIE_FACES,
  ENTRE_DADOS_BETS,
  ENTRE_DADOS_DEALER,
  createEntreDados,
  createEntreDadosShoe,
  readEntreDadosRoll,
  resolveEntreDadosBet,
  type Bets,
  type DicePair,
  type EntreDadosBetId,
  type RoundState,
} from '@casinogames/engine';
import { h, wait } from '@casinogames/ui';
import { DiceTable, type RoundContext, type TableOptions, type TablePhase } from '../dice-table.ts';
import type { BetOutlook } from '../spots.ts';
import { createFelt, type EntreDadosFelt } from './felt.ts';
import { RangeStrip } from './range-strip.ts';

/** Nominal pauses (the motion policy shortens or skips them). */
const AFTER_ROLL_MS = 450;
const TENSION_MS = 900;

/**
 * One Entre Dados table: the game (with its six-deck shoe), the dice, the
 * dealer's card, the 1–6 strip and the felt, on the shared table (bets,
 * chips, balance, autoplay and the round's life: see DiceTable).
 *
 * A round plays as the engine recorded it: the roll, the winning range on
 * the strip, the card dealt face down, a pause, the reveal, the settlement.
 */
export class EntreDadosTable {
  readonly element: HTMLElement;
  /** Resolves once the dice and the card views are ready. */
  readonly ready: Promise<void>;
  readonly #table: DiceTable<EntreDadosBetId>;
  readonly #strip = new RangeStrip();
  #felt!: EntreDadosFelt;

  constructor(options: TableOptions) {
    const shoe = createEntreDadosShoe();
    const diceHost = h('div', { class: 'tb-box' });
    const cardHost = h('div', { class: 'tb-box' });
    this.#table = new DiceTable<EntreDadosBetId>(options, {
      label: 'Entre Dados table',
      className: 'ed-table',
      game: createEntreDados({ source: shoe }),
      shoe,
      mainBet: { id: 'entre', label: 'Entre' },
      view: h(
        'div',
        { class: 'tb-view ed-view' },
        h('div', { class: 'ed-stage' }, diceHost, cardHost),
        this.#strip.element,
      ),
      diceHost,
      cardHost,
      initialDice: [2, 5],
      hands: [{ id: ENTRE_DADOS_DEALER, label: 'Dealer', x: 0.29, y: 0.5 }],
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
    const entre = state.settlement.entre;
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
        await dealer.deal(null, ENTRE_DADOS_DEALER, { faceUp: false });
      },
      'card-revealed': async ({ card }) => {
        this.#strip.anticipate();
        await wait(motion.duration(TENSION_MS), signal);
        if (signal.aborted) return;
        await dealer.reveal(ENTRE_DADOS_DEALER, 0, card);
        if (entre !== undefined) this.#strip.showCard(card.rank, entre.outcome);
        reveal = this.#strip.caption;
      },
    });
    return reveal;
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
}

/** What the roll alone decides for a bet, from its outcome over the six card values. */
function outlookOf(bet: EntreDadosBetId, dice: DicePair): BetOutlook {
  const outcomes = new Set(DIE_FACES.map((card) => resolveEntreDadosBet(bet, dice, card).outcome));
  if (outcomes.size > 1) return 'live';
  if (outcomes.has('win')) return 'won';
  return outcomes.has('push') ? 'push' : 'out';
}
