import type { Cents } from '@casinogames/engine';
import { Disposer, h } from '../dom/h.ts';
import { formatCents } from '../format/format.ts';
import { motion as defaultMotion, tween, type Motion } from '../motion/motion.ts';
import type { Bankroll } from './bankroll.ts';
import './bankroll-display.css';

export interface BankrollDisplayOptions {
  readonly bankroll: Bankroll;
  readonly motion?: Motion;
  readonly label?: string;
  /**
   * Shows a "Top up" button when the balance falls below this amount
   * (typically the table minimum), restoring the starting balance.
   */
  readonly topUpBelow?: Cents;
}

/**
 * The balance, counting up or down to each new value with a floating delta.
 * Not a live region: games announce round results themselves, so autoplay
 * does not flood screen readers.
 */
export class BankrollDisplay {
  readonly element: HTMLDivElement;
  readonly #value: HTMLSpanElement;
  readonly #delta: HTMLSpanElement;
  readonly #topUp: HTMLButtonElement;
  readonly #motion: Motion;
  readonly #options: BankrollDisplayOptions;
  readonly #disposer = new Disposer();
  #shown: Cents;
  #animation: AbortController | null = null;

  constructor(options: BankrollDisplayOptions) {
    this.#options = options;
    this.#motion = options.motion ?? defaultMotion;
    this.#shown = options.bankroll.balance;
    this.#value = h('span', { class: 'cg-bankroll__value cg-num' }, formatCents(this.#shown));
    this.#delta = h('span', { class: 'cg-bankroll__delta cg-num', 'aria-hidden': 'true' });
    this.#topUp = h('button', { type: 'button', class: 'cg-btn cg-bankroll__top-up' }, 'Top up');
    this.element = h(
      'div',
      { class: 'cg-bankroll', role: 'group', 'aria-label': options.label ?? 'Balance' },
      h('span', { class: 'cg-bankroll__label' }, options.label ?? 'Balance'),
      h(
        'span',
        { class: 'cg-bankroll__amount' },
        h('span', { class: 'cg-bankroll__coin' }),
        this.#value,
      ),
      this.#delta,
      this.#topUp,
    );

    this.#disposer.add(
      options.bankroll.subscribe((balance, previous) => {
        this.#show(balance, balance - previous);
      }),
    );
    this.#disposer.listen(this.#topUp, 'click', () => {
      options.bankroll.reset();
    });
    this.#disposer.add(() => this.#animation?.abort());
    this.#renderTopUp(options.bankroll.balance);
  }

  destroy(): void {
    this.#disposer.dispose();
    this.element.remove();
  }

  #show(balance: Cents, delta: Cents): void {
    this.#animation?.abort();
    const controller = new AbortController();
    this.#animation = controller;
    const from = this.#shown;

    this.element.dataset.trend = delta > 0 ? 'up' : 'down';
    this.#delta.textContent = formatCents(delta, { sign: true });
    this.#delta.classList.remove('is-visible');
    void this.#delta.getBoundingClientRect();
    this.#delta.classList.add('is-visible');

    void tween(
      this.#motion.duration(Math.min(900, 300 + Math.abs(delta) / 20)),
      (progress) => {
        this.#shown = Math.round(from + (balance - from) * progress);
        this.#value.textContent = formatCents(this.#shown);
      },
      { signal: controller.signal },
    );
    this.#renderTopUp(balance);
  }

  #renderTopUp(balance: Cents): void {
    const threshold = this.#options.topUpBelow;
    this.#topUp.hidden = threshold === undefined || balance >= threshold;
  }
}
