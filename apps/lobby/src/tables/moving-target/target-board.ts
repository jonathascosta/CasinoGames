import {
  EXACT_HIT_ODDS,
  TARGETS,
  THREE_PLUS_MIN_CARDS,
  movingTargetOutlook,
  type MovingTargetDeal,
  type MovingTargetOutlook,
  type Odds,
  type Target,
} from '@casinogames/engine';
import { h } from '@casinogames/ui';

/** A payout "to one", as the table prints it: 15 to 2 → "7.5:1". */
export function toOne(odds: Odds): string {
  return `${perUnit(odds)}:1`;
}

/** The same in words, for captions and screen readers: "7.5 to 1". */
export function toOneInWords(odds: Odds): string {
  return `${perUnit(odds)} to 1`;
}

function perUnit({ to, per }: Odds): string {
  return String(Number((to / per).toFixed(2)));
}

/** Chance that the next card ends the deal: it must cover the gap to the target. */
export function chanceToEnd(gap: number): number {
  return Math.min(1, Math.max(0, (11 - gap) / 10));
}

type BoardState = 'idle' | 'rolling' | 'locked' | 'waiting' | 'dealing' | 'hit' | 'over';

/**
 * The hero of the Moving Target table and its readouts:
 *  - the target the dice set, locked in big after the roll, with what Exact Hit
 *    pays on it, and Exact Hit's paytable with that target's column lit;
 *  - the dealer's running total against the target, as a number and a meter
 *    that fills up to the target and shows any overshoot;
 *  - the card count 3+ Cards watches (1, 2, 3+), marked won or lost as
 *    soon as the cards decide it;
 *  - a caption that says all of it in words, for screen readers too.
 * `hero` sits beside the dice, `track` (the paytable) under them, `readout`
 * under the cards.
 */
export class TargetBoard {
  readonly hero: HTMLElement;
  readonly track: HTMLElement;
  readonly readout: HTMLElement;
  readonly #columns: HTMLTableCellElement[] = [];
  readonly #value: HTMLSpanElement;
  readonly #pays: HTMLSpanElement;
  readonly #total: HTMLSpanElement;
  readonly #fill: HTMLSpanElement;
  readonly #count: HTMLElement;
  readonly #pips: HTMLSpanElement[];
  readonly #caption: HTMLParagraphElement;
  #target: Target | null = null;

  constructor() {
    this.#value = h('span', { class: 'mt-target__value cg-num' }, '?');
    this.#pays = h('span', { class: 'mt-target__pays' });
    this.hero = h(
      'div',
      { class: 'mt-target' },
      h('span', { class: 'mt-target__label' }, 'Target'),
      this.#value,
      this.#pays,
    );
    this.track = this.#createTrack();
    this.#total = h('span', { class: 'mt-total__value cg-num' }, '0');
    this.#fill = h('span', { class: 'mt-meter__fill' });
    this.#pips = ['1', '2', '3+'].map((label) => h('span', { class: 'mt-pip' }, label));
    this.#count = h(
      'div',
      { class: 'mt-count' },
      h('span', { class: 'mt-readout__label' }, 'Cards'),
      h('span', { class: 'mt-count__pips', 'aria-hidden': 'true' }, ...this.#pips),
    );
    this.#caption = h('p', { class: 'mt-caption', 'aria-live': 'polite' });
    this.readout = h(
      'div',
      { class: 'mt-readout' },
      h(
        'div',
        { class: 'mt-total' },
        h('span', { class: 'mt-readout__label' }, 'Total'),
        this.#total,
        h('span', { class: 'mt-meter', 'aria-hidden': 'true' }, this.#fill),
      ),
      this.#count,
      this.#caption,
    );
    this.#clear('idle', 'Place your bets, then roll the dice.');
  }

  get caption(): string {
    return this.#caption.textContent;
  }

  /** A round starts: no target until the dice land. */
  reset(): void {
    this.#clear('rolling', 'Rolling…');
  }

  #clear(state: 'idle' | 'rolling', caption: string): void {
    this.#target = null;
    this.#setState(state);
    this.#value.textContent = '?';
    this.#pays.textContent = 'set by the dice';
    this.#showCards(0, 'live');
    this.#showTotal(0, 0);
    this.#light(null);
    this.#caption.textContent = caption;
  }

  /** The dice have landed: the target locks in. */
  lockTarget(target: Target): void {
    this.#target = target;
    this.#setState('locked');
    this.#value.textContent = String(target);
    this.#pays.textContent = `Exact Hit pays ${toOne(EXACT_HIT_ODDS[target])}`;
    this.#showCards(0, movingTargetOutlook('three-plus-cards', target, []));
    this.#showTotal(0, target);
    this.#light(target);
    this.#caption.textContent = `Target ${target} · Exact Hit pays ${toOneInWords(EXACT_HIT_ODDS[target])}`;
  }

  /**
   * A card is on its way, face down: the board tenses with the chance that it
   * ends the deal, which the cards already showing decide.
   */
  anticipate(chance: number): void {
    this.#setState('waiting');
    this.hero.style.setProperty('--tension', chance.toFixed(2));
  }

  /** A card has turned: the total, the meter, the card count and the caption follow. */
  showDeal(deal: MovingTargetDeal, values: readonly number[]): void {
    this.#setState(deal.hit ? 'hit' : deal.over > 0 ? 'over' : 'dealing');
    this.#showTotal(deal.total, deal.target);
    this.#showCards(deal.cards, movingTargetOutlook('three-plus-cards', deal.target, values));
    const gap = deal.target - deal.total;
    this.#caption.textContent = deal.hit
      ? `Total ${deal.total} · on target`
      : deal.over > 0
        ? `Total ${deal.total} · over by ${deal.over}`
        : `Total ${deal.total} · ${gap} to go`;
  }

  /** Replaces the caption, e.g. with a hint or the round's result. */
  say(text: string): void {
    this.#caption.textContent = text;
  }

  /** Exact Hit's paytable: a column per target, the payout "to one" (the ":1" shows where it fits). */
  #createTrack(): HTMLElement {
    const row = (label: string, cell: (target: Target) => (string | HTMLElement)[]) =>
      h(
        'tr',
        null,
        h('th', { scope: 'row' }, label),
        ...TARGETS.map((target) => {
          const column = h('td', { dataset: { target: String(target) } }, ...cell(target));
          this.#columns.push(column);
          return column;
        }),
      );
    return h(
      'div',
      { class: 'mt-track' },
      h(
        'table',
        { class: 'tb-paytable mt-track__table' },
        h('caption', { class: 'cg-sr-only' }, 'Exact Hit pays by target (the sum of the dice)'),
        // Fixed layout takes the widths from here: room for the labels, the targets alike.
        h(
          'colgroup',
          null,
          h('col', { class: 'mt-track__labels' }),
          ...TARGETS.map(() => h('col')),
        ),
        h(
          'tbody',
          null,
          row('Target', (target) => [String(target)]),
          row('Pays', (target) => [
            perUnit(EXACT_HIT_ODDS[target]),
            h('span', { class: 'mt-track__per' }, ':1'),
          ]),
        ),
      ),
    );
  }

  /** Lights the target's column; null clears it. */
  #light(target: Target | null): void {
    for (const column of this.#columns) {
      column.toggleAttribute('data-lit', column.dataset.target === String(target));
    }
  }

  #setState(state: BoardState): void {
    this.hero.dataset.state = state;
    this.readout.dataset.state = state;
    if (state !== 'waiting') this.hero.style.removeProperty('--tension');
  }

  #showTotal(total: number, target: number): void {
    this.#total.textContent = String(total);
    const share = target === 0 ? 0 : Math.min(1, total / target);
    this.#fill.style.setProperty('--share', share.toFixed(4));
  }

  /** Lights one pip per card (the third reads the count past three) and marks 3+ Cards. */
  #showCards(cards: number, outlook: MovingTargetOutlook): void {
    this.#pips.forEach((pip, index) => {
      pip.toggleAttribute('data-on', cards > index);
    });
    this.#pips[THREE_PLUS_MIN_CARDS - 1]!.textContent =
      cards > THREE_PLUS_MIN_CARDS ? String(cards) : '3+';
    this.#count.dataset.outlook = this.#target === null ? 'live' : outlook;
    this.#count.setAttribute(
      'aria-label',
      `${cards} ${cards === 1 ? 'card' : 'cards'} dealt; 3+ Cards ${
        outlook === 'won' ? 'wins' : outlook === 'lost' ? 'loses' : 'needs three'
      }`,
    );
  }
}
