import type { Cents } from '@casinogames/engine';
import { Disposer, h } from '../dom/h.ts';
import { formatCents } from '../format/format.ts';
import { CHIP_DENOMINATIONS, createChip } from './chips.ts';
import './chip-rail.css';

export interface ChipRailOptions {
  readonly denominations?: readonly Cents[];
  /** Initially selected chip; defaults to the smallest. */
  readonly value?: Cents;
  readonly onChange?: (value: Cents) => void;
  /** Accessible name of the group. */
  readonly label?: string;
}

/**
 * The chip selector. A radio group with roving focus: arrow keys move the
 * selection, only the selected chip is in the tab order, and chips worth more
 * than the balance are disabled (the selection steps down automatically).
 */
export class ChipRail {
  readonly element: HTMLDivElement;
  readonly #options: ChipRailOptions;
  readonly #items: { value: Cents; button: HTMLButtonElement }[];
  readonly #disposer = new Disposer();
  #value: Cents;
  #balance = Infinity;

  constructor(options: ChipRailOptions = {}) {
    this.#options = options;
    const denominations = options.denominations ?? CHIP_DENOMINATIONS;
    this.#value = options.value ?? denominations[0] ?? 0;

    this.#items = denominations.map((value) => ({
      value,
      button: h(
        'button',
        {
          type: 'button',
          class: 'cg-chip-rail__item',
          role: 'radio',
          'aria-label': `${formatCents(value)} chip`,
        },
        createChip(value),
      ),
    }));

    this.element = h(
      'div',
      { class: 'cg-chip-rail', role: 'radiogroup', 'aria-label': options.label ?? 'Chip value' },
      ...this.#items.map((item) => item.button),
    );

    for (const item of this.#items) {
      this.#disposer.listen(item.button, 'click', () => {
        this.select(item.value);
      });
    }
    this.#disposer.listen(this.element, 'keydown', (event) => {
      this.#onKeyDown(event);
    });
    this.#render();
  }

  get value(): Cents {
    return this.#value;
  }

  /** Selects a chip (ignored if it is disabled or not on the rail). */
  select(value: Cents, { focus = false } = {}): void {
    const item = this.#items.find((candidate) => candidate.value === value);
    if (item === undefined || !this.#isEnabled(value)) return;
    const changed = value !== this.#value;
    this.#value = value;
    this.#render();
    if (focus) item.button.focus();
    if (changed) this.#options.onChange?.(value);
  }

  /** Disables chips above the balance, stepping the selection down if needed. */
  setBalance(balance: Cents): void {
    this.#balance = balance;
    if (!this.#isEnabled(this.#value)) {
      const affordable = this.#items.filter((item) => item.value <= balance).at(-1);
      if (affordable !== undefined) {
        this.#value = affordable.value;
        this.#options.onChange?.(affordable.value);
      }
    }
    this.#render();
  }

  destroy(): void {
    this.#disposer.dispose();
    this.element.remove();
  }

  #isEnabled(value: Cents): boolean {
    return value <= this.#balance;
  }

  #render(): void {
    for (const { value, button } of this.#items) {
      const selected = value === this.#value;
      button.setAttribute('aria-checked', String(selected));
      button.tabIndex = selected ? 0 : -1;
      button.disabled = !this.#isEnabled(value);
    }
  }

  #onKeyDown(event: KeyboardEvent): void {
    const enabled = this.#items.filter((item) => this.#isEnabled(item.value));
    const index = enabled.findIndex((item) => item.value === this.#value);
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = Math.min(enabled.length - 1, index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = Math.max(0, index - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = enabled.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = enabled[next];
    if (target !== undefined) this.select(target.value, { focus: true });
  }
}
