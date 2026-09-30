import type { Cents, SettlementLine } from '@casinogames/engine';
import { Disposer, h } from '../dom/h.ts';
import { breakIntoChips, createChip } from '../chips/chips.ts';
import { formatCents } from '../format/format.ts';
import './bet-spot.css';

export type BetRejection = 'max' | 'funds' | 'locked';

export interface BetSpotOptions {
  readonly id: string;
  readonly label: string;
  /** Short hint under the label, e.g. "pays 1 to 1". */
  readonly caption?: string;
  readonly variant?: 'main' | 'side';
  readonly max: Cents;
  /** The chip currently selected on the rail. */
  readonly chipValue: () => Cents;
  /** Extra check before a chip is added (typically: can the bankroll cover it?). */
  readonly canAdd?: (amount: Cents) => boolean;
  readonly onChange?: (amount: Cents) => void;
  readonly onReject?: (reason: BetRejection) => void;
  /** Hold duration that clears the spot. Default 550 ms. */
  readonly longPressMs?: number;
}

const MAX_VISIBLE_CHIPS = 7;
const MOVE_TOLERANCE_PX = 12;

/**
 * A betting area on the felt. Tap (or Enter/Space) adds the selected chip,
 * a long press (or right-click, Delete, Backspace) clears it. Locked while a
 * round is in play; shows the result once the round settles.
 */
export class BetSpot {
  readonly id: string;
  readonly element: HTMLButtonElement;
  readonly #options: BetSpotOptions;
  readonly #stack: HTMLSpanElement;
  readonly #amountText: HTMLSpanElement;
  readonly #result: HTMLSpanElement;
  readonly #disposer = new Disposer();
  #amount: Cents = 0;
  #locked = false;
  #press: { timer: ReturnType<typeof setTimeout>; x: number; y: number; fired: boolean } | null =
    null;

  constructor(options: BetSpotOptions) {
    this.#options = options;
    this.id = options.id;
    this.#stack = h('span', { class: 'cg-bet-spot__stack', 'aria-hidden': 'true' });
    this.#amountText = h('span', { class: 'cg-bet-spot__amount cg-num', 'aria-hidden': 'true' });
    this.#result = h('span', { class: 'cg-bet-spot__result cg-num', 'aria-hidden': 'true' });
    this.element = h(
      'button',
      {
        type: 'button',
        class: 'cg-bet-spot',
        dataset: { variant: options.variant ?? 'main', bet: options.id },
        style: `--press-ms: ${options.longPressMs ?? 550}ms`,
      },
      h('span', { class: 'cg-bet-spot__press', 'aria-hidden': 'true' }),
      h(
        'span',
        { class: 'cg-bet-spot__text', 'aria-hidden': 'true' },
        h('span', { class: 'cg-bet-spot__label' }, options.label),
        // The grid lays the two out; the space keeps their words apart in the text.
        options.caption === undefined ? null : ' ',
        options.caption === undefined
          ? null
          : h('span', { class: 'cg-bet-spot__caption' }, options.caption),
      ),
      this.#stack,
      this.#amountText,
      this.#result,
    );
    this.#bindEvents();
    this.#render();
  }

  get amount(): Cents {
    return this.#amount;
  }

  get locked(): boolean {
    return this.#locked;
  }

  /** Adds `amount` if the table maximum and `canAdd` allow it. */
  add(amount: Cents): boolean {
    const rejection = this.#check(amount);
    if (rejection !== null) {
      this.#reject(rejection);
      return false;
    }
    this.#setAmount(this.#amount + amount);
    return true;
  }

  /** Sets the stake directly (rebet, restoring a layout); bypasses canAdd. */
  setAmount(amount: Cents): void {
    this.#setAmount(Math.max(0, Math.min(amount, this.#options.max)));
  }

  clear(): void {
    if (this.#locked) return;
    this.#setAmount(0);
  }

  setLocked(locked: boolean): void {
    this.#locked = locked;
    this.#cancelPress();
    this.element.setAttribute('aria-disabled', String(locked));
  }

  /** Shows how the bet ended (a settlement line); null clears it. */
  setResult(line: Pick<SettlementLine, 'outcome' | 'net'> | null): void {
    if (line === null) {
      delete this.element.dataset.result;
      this.#result.dataset.value = '';
    } else {
      this.element.dataset.result = line.outcome;
      this.#result.dataset.value =
        line.outcome === 'win' ? formatCents(line.net, { sign: true }) : '';
    }
    this.#renderLabel();
  }

  destroy(): void {
    this.#cancelPress();
    this.#disposer.dispose();
    this.element.remove();
  }

  #check(amount: Cents): BetRejection | null {
    if (this.#locked) return 'locked';
    if (this.#amount + amount > this.#options.max) return 'max';
    if (this.#options.canAdd !== undefined && !this.#options.canAdd(amount)) return 'funds';
    return null;
  }

  #setAmount(amount: Cents): void {
    if (amount === this.#amount) return;
    this.#amount = amount;
    this.#render();
    this.#options.onChange?.(amount);
  }

  #reject(reason: BetRejection): void {
    if (reason !== 'locked') {
      // Remove, force a reflow, re-add: restarts the shake animation.
      this.element.classList.remove('is-rejected');
      void this.element.getBoundingClientRect();
      this.element.classList.add('is-rejected');
    }
    this.#options.onReject?.(reason);
  }

  #bindEvents(): void {
    const d = this.#disposer;
    d.listen(this.element, 'pointerdown', (event) => {
      if (this.#locked || event.button !== 0) return;
      this.#cancelPress();
      const press = {
        x: event.clientX,
        y: event.clientY,
        fired: false,
        timer: setTimeout(() => {
          press.fired = true;
          this.element.classList.remove('is-pressing');
          this.clear();
        }, this.#options.longPressMs ?? 550),
      };
      this.#press = press;
      this.element.classList.add('is-pressing');
    });
    d.listen(this.element, 'pointermove', (event) => {
      const press = this.#press;
      if (press === null) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE_PX) {
        this.#cancelPress();
      }
    });
    d.listen(this.element, 'pointerup', () => {
      const press = this.#press;
      if (press === null) return;
      const tapped = !press.fired;
      this.#cancelPress();
      if (tapped) this.add(this.#options.chipValue());
    });
    d.listen(this.element, 'pointercancel', () => {
      this.#cancelPress();
    });
    d.listen(this.element, 'pointerleave', () => {
      this.#cancelPress();
    });
    // Keyboard activation arrives as a click with detail 0; pointer clicks
    // were already handled on pointerup.
    d.listen(this.element, 'click', (event) => {
      if (event.detail === 0) this.add(this.#options.chipValue());
    });
    d.listen(this.element, 'keydown', (event) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        this.clear();
      }
    });
    d.listen(this.element, 'contextmenu', (event) => {
      event.preventDefault();
      this.clear();
    });
    d.listen(this.element, 'animationend', () => {
      this.element.classList.remove('is-rejected');
    });
  }

  #cancelPress(): void {
    if (this.#press !== null) clearTimeout(this.#press.timer);
    this.#press = null;
    this.element.classList.remove('is-pressing');
  }

  #render(): void {
    const chips = breakIntoChips(this.#amount);
    const visible = chips.slice(0, MAX_VISIBLE_CHIPS).reverse();
    this.#stack.replaceChildren(
      ...visible.map((value, index) => {
        const chip = createChip(value);
        // Deterministic jitter so the stack looks hand-placed.
        chip.style.setProperty('--i', String(index));
        chip.style.setProperty('--tilt', `${((index * 37) % 11) - 5}deg`);
        return chip;
      }),
    );
    this.element.dataset.state = this.#amount > 0 ? 'filled' : 'empty';
    this.#amountText.dataset.value = this.#amount > 0 ? formatCents(this.#amount) : '';
    this.#renderLabel();
  }

  /**
   * The spot's name: the words on it (its label and caption), as they read,
   * then what its chips and figures show, which the stylesheet draws.
   */
  #renderLabel(): void {
    const { label, caption, max } = this.#options;
    const stake = this.#amount > 0 ? formatCents(this.#amount) : 'no bet';
    const result = this.element.dataset.result;
    const net = this.#result.dataset.value ?? '';
    const outcome = result === undefined ? '' : `, ${result}${net === '' ? '' : ` ${net}`}`;
    this.element.setAttribute(
      'aria-label',
      `${label}${caption === undefined ? '' : `, ${caption}`}: ${stake}${outcome}. ` +
        `Maximum ${formatCents(max)}. Tap to add the selected chip; long press or Delete to clear.`,
    );
  }
}
