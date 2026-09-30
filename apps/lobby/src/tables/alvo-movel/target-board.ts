import {
  ACERTA_ODDS,
  TARGETS,
  TRES_OU_MAIS_CARDS,
  alvoMovelOutlook,
  type AlvoMovelDeal,
  type AlvoMovelOutlook,
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
 * The hero of the Alvo Móvel table and its readouts:
 *  - the target the dice set, locked in big after the roll, with what Acerta
 *    pays on it, and Acerta's paytable with that target's column lit;
 *  - the dealer's running total against the target, as a number and a meter
 *    that fills up to the target and shows any overshoot;
 *  - the card count Três ou Mais watches (1, 2, 3+), marked won or lost as
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
    this.#value = h('span', { class: 'am-target__value cg-num' }, '?');
    this.#pays = h('span', { class: 'am-target__pays' });
    this.hero = h(
      'div',
      { class: 'am-target' },
      h('span', { class: 'am-target__label' }, 'Target'),
      this.#value,
      this.#pays,
    );
    this.track = this.#createTrack();
    this.#total = h('span', { class: 'am-total__value cg-num' }, '0');
    this.#fill = h('span', { class: 'am-meter__fill' });
    this.#pips = ['1', '2', '3+'].map((label) => h('span', { class: 'am-pip' }, label));
    this.#count = h(
      'div',
      { class: 'am-count' },
      h('span', { class: 'am-readout__label' }, 'Cards'),
      h('span', { class: 'am-count__pips', 'aria-hidden': 'true' }, ...this.#pips),
    );
    this.#caption = h('p', { class: 'am-caption', 'aria-live': 'polite' });
    this.readout = h(
      'div',
      { class: 'am-readout' },
      h(
        'div',
        { class: 'am-total' },
        h('span', { class: 'am-readout__label' }, 'Total'),
        this.#total,
        h('span', { class: 'am-meter', 'aria-hidden': 'true' }, this.#fill),
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
    this.#pays.textContent = `Acerta pays ${toOne(ACERTA_ODDS[target])}`;
    this.#showCards(0, alvoMovelOutlook('tres-ou-mais', target, []));
    this.#showTotal(0, target);
    this.#light(target);
    this.#caption.textContent = `Target ${target} · Acerta pays ${toOneInWords(ACERTA_ODDS[target])}`;
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
  showDeal(deal: AlvoMovelDeal, values: readonly number[]): void {
    this.#setState(deal.hit ? 'hit' : deal.over > 0 ? 'over' : 'dealing');
    this.#showTotal(deal.total, deal.target);
    this.#showCards(deal.cards, alvoMovelOutlook('tres-ou-mais', deal.target, values));
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

  /** Acerta's paytable: a column per target, the payout "to one" (the ":1" shows where it fits). */
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
      { class: 'am-track' },
      h(
        'table',
        { class: 'tb-paytable am-track__table' },
        h('caption', { class: 'cg-sr-only' }, 'Acerta pays by target (the sum of the dice)'),
        // Fixed layout takes the widths from here: room for the labels, the targets alike.
        h(
          'colgroup',
          null,
          h('col', { class: 'am-track__labels' }),
          ...TARGETS.map(() => h('col')),
        ),
        h(
          'tbody',
          null,
          row('Target', (target) => [String(target)]),
          row('Pays', (target) => [
            perUnit(ACERTA_ODDS[target]),
            h('span', { class: 'am-track__per' }, ':1'),
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

  /** Lights one pip per card (the third reads the count past three) and marks Três ou Mais. */
  #showCards(cards: number, outlook: AlvoMovelOutlook): void {
    this.#pips.forEach((pip, index) => {
      pip.toggleAttribute('data-on', cards > index);
    });
    this.#pips[TRES_OU_MAIS_CARDS - 1]!.textContent =
      cards > TRES_OU_MAIS_CARDS ? String(cards) : '3+';
    this.#count.dataset.outlook = this.#target === null ? 'live' : outlook;
    this.#count.setAttribute(
      'aria-label',
      `${cards} ${cards === 1 ? 'card' : 'cards'} dealt; Três ou Mais ${
        outlook === 'won' ? 'wins' : outlook === 'lost' ? 'loses' : 'needs three'
      }`,
    );
  }
}
