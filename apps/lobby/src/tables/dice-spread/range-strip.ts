import {
  oddsLabel,
  rankLabel,
  readDiceSpreadRoll,
  type DicePair,
  type Outcome,
  type Rank,
} from '@casinogames/engine';
import { h } from '@casinogames/ui';

const VALUES: readonly Rank[] = [1, 2, 3, 4, 5, 6];

/** What a card value means once the dice are down. */
type Role = 'die' | 'between' | 'out';

/**
 * The six card values, ace to six, and where the card has to land. After the
 * roll the dice mark the edges, the values strictly between them light up
 * under Between's odds, and the middle of a spread of 2 carries Bullseye's
 * bull's eye; then the reveal marks the card that came. The caption says the
 * same in words for screen readers.
 */
export class RangeStrip {
  readonly element: HTMLElement;
  readonly #cells: HTMLLIElement[];
  readonly #band: HTMLSpanElement;
  readonly #caption: HTMLParagraphElement;

  constructor() {
    this.#cells = VALUES.map((value) =>
      h(
        'li',
        { class: 'ds-strip__cell', dataset: { value: String(value) } },
        h('span', { class: 'ds-strip__rank' }, rankLabel(value)),
      ),
    );
    this.#band = h('span', { class: 'ds-strip__band', hidden: true });
    this.#caption = h('p', { class: 'ds-strip__caption', 'aria-live': 'polite' });
    this.element = h(
      'div',
      { class: 'ds-strip' },
      h(
        'div',
        { class: 'ds-strip__track' },
        this.#band,
        h(
          'ol',
          // display: contents drops list semantics in some browsers.
          { class: 'ds-strip__cells', role: 'list', 'aria-label': 'Card values, ace to six' },
          ...this.#cells,
        ),
      ),
      this.#caption,
    );
    this.reset('Place your bets, then roll the dice.');
  }

  /** Back to neutral, with a message. */
  reset(caption: string): void {
    this.element.dataset.state = 'idle';
    this.#band.hidden = true;
    for (const [index, cell] of this.#cells.entries()) {
      delete cell.dataset.role;
      delete cell.dataset.hit;
      delete cell.dataset.bullseye;
      cell.setAttribute('aria-label', rankLabel(VALUES[index]!));
    }
    this.#caption.textContent = caption;
  }

  /** Shows what the roll needs from the card. */
  showRoll(dice: DicePair): void {
    const roll = readDiceSpreadRoll(dice);
    this.element.dataset.state = 'rolled';
    this.element.dataset.spread = String(roll.spread);
    for (const [index, cell] of this.#cells.entries()) {
      const value = VALUES[index]!;
      const role: Role =
        value === roll.low || value === roll.high
          ? 'die'
          : roll.between.includes(value)
            ? 'between'
            : 'out';
      cell.dataset.role = role;
      if (value === roll.bullseye) cell.dataset.bullseye = '';
      cell.setAttribute(
        'aria-label',
        `${rankLabel(value)}: ${describeRole(role, value, roll.bullseye)}`,
      );
    }
    if (roll.betweenOdds === null) {
      this.#band.hidden = true;
    } else {
      this.#band.hidden = false;
      // Cells sit in grid columns 1–6, one per value: span the values between.
      this.#band.style.gridColumn = `${roll.low + 1} / ${roll.high}`;
      this.#band.textContent = `pays ${oddsLabel(roll.betweenOdds)}`;
    }
    this.#caption.textContent = captionForRoll(roll);
  }

  /** Replaces the caption, e.g. with a hint or the round's result. */
  say(text: string): void {
    this.#caption.textContent = text;
  }

  get caption(): string {
    return this.#caption.textContent;
  }

  /** The card is on its way: the winning values pulse until the reveal. */
  anticipate(): void {
    this.element.dataset.state = 'waiting';
  }

  /** Marks the card that came, coloured by Between's outcome. */
  showCard(value: Rank, between: Outcome): void {
    this.element.dataset.state = 'revealed';
    this.#cells[value - 1]!.dataset.hit = between;
    const verdict = between === 'win' ? 'wins' : between === 'push' ? 'pushes' : 'loses';
    this.#caption.textContent = `Card ${rankLabel(value)} · Between ${verdict}`;
  }
}

function describeRole(role: Role, value: Rank, bullseye: Rank | null): string {
  if (role === 'die') return 'on a die, wins Match';
  if (role === 'out') return 'outside the dice';
  return value === bullseye ? 'between the dice, and the bull’s eye' : 'between the dice';
}

function captionForRoll(roll: ReturnType<typeof readDiceSpreadRoll>): string {
  const low = rankLabel(roll.low);
  if (roll.pair) return `A pair of ${low}s · Between pushes · Triple needs a ${low}`;
  if (roll.betweenOdds === null) return `Spread 1 · Between pushes`;
  const needs = listOf(roll.between.map(rankLabel));
  const bullseye = roll.bullseye === null ? '' : ` · Bullseye needs a ${rankLabel(roll.bullseye)}`;
  return `Spread ${roll.spread} · Between pays ${oddsLabel(roll.betweenOdds)} on ${needs}${bullseye}`;
}

/** "3", "3 or 4", "2, 3, 4 or 5". */
function listOf(items: readonly string[]): string {
  return items.length < 2
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} or ${items.at(-1)!}`;
}
