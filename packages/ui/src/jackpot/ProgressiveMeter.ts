import type { Cents } from '@casinogames/engine';
import { Disposer, h } from '../dom/h.ts';
import { formatCents } from '../format/format.ts';
import { motion as defaultMotion, tween, type Motion } from '../motion/motion.ts';
import type { Store } from '../state/store.ts';
import './progressive-meter.css';

export interface ProgressiveMeterOptions {
  /** The amount shown, in cents; the meter follows it. */
  readonly store: Store<Cents>;
  /** e.g. "6-6 vs 6-6 progressive". */
  readonly label: string;
  /** A line under the amount, e.g. how the meter is fed. */
  readonly caption?: string;
  readonly motion?: Motion;
}

/**
 * A progressive meter: the amount counts up as stakes feed it and flashes
 * when a hit pays from it. Not a live region, since it moves every round;
 * games announce a hit themselves.
 */
export class ProgressiveMeter {
  readonly element: HTMLDivElement;
  readonly #value: HTMLSpanElement;
  readonly #motion: Motion;
  readonly #label: string;
  readonly #disposer = new Disposer();
  #shown: Cents;
  #animation: AbortController | null = null;

  constructor(options: ProgressiveMeterOptions) {
    this.#motion = options.motion ?? defaultMotion;
    this.#label = options.label;
    this.#shown = options.store.get();
    this.#value = h('span', { class: 'cg-meter__value cg-num' }, formatCents(this.#shown));
    this.element = h(
      'div',
      { class: 'cg-meter', role: 'group' },
      h('span', { class: 'cg-meter__label', 'aria-hidden': 'true' }, options.label),
      h('span', { class: 'cg-meter__amount' }, h('span', { class: 'cg-meter__coin' }), this.#value),
      options.caption === undefined
        ? null
        : h('span', { class: 'cg-meter__caption', 'aria-hidden': 'true' }, options.caption),
    );
    this.#describe(this.#shown);
    this.#disposer.add(
      options.store.subscribe((amount, previous) => {
        this.#show(amount, amount < previous);
      }),
    );
    this.#disposer.add(() => this.#animation?.abort());
  }

  destroy(): void {
    this.#disposer.dispose();
    this.element.remove();
  }

  #show(amount: Cents, paid: boolean): void {
    this.#animation?.abort();
    const controller = new AbortController();
    this.#animation = controller;
    const from = this.#shown;
    this.element.dataset.trend = paid ? 'paid' : 'up';
    if (paid) {
      // Restart the flash even if the last one has not finished.
      this.element.classList.remove('is-paid');
      void this.element.getBoundingClientRect();
      this.element.classList.add('is-paid');
    }
    this.#describe(amount);
    void tween(
      this.#motion.duration(paid ? 900 : 450),
      (progress) => {
        this.#shown = Math.round(from + (amount - from) * progress);
        this.#value.textContent = formatCents(this.#shown);
      },
      { signal: controller.signal },
    );
  }

  #describe(amount: Cents): void {
    this.element.setAttribute('aria-label', `${this.#label}: ${formatCents(amount)}`);
  }
}
