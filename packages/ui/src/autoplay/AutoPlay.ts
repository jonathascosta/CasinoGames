import { Disposer, h } from '../dom/h.ts';
import { icon } from '../dom/icons.ts';
import type {
  AutoPlayController,
  AutoPlayState,
  AutoPlayStopReason,
} from './AutoPlayController.ts';
import './autoplay.css';

export interface AutoPlayOptions {
  readonly controller: AutoPlayController;
  /** Round counts offered. Default 10, 25, 50, 100. */
  readonly choices?: readonly number[];
}

let nextId = 0;

const STOP_MESSAGES: Readonly<Record<AutoPlayStopReason, string>> = {
  completed: 'Autoplay finished',
  stopped: 'Autoplay stopped',
  'insufficient-funds': 'Autoplay stopped: balance too low for the bet',
  error: 'Autoplay stopped by an error',
};

/**
 * The autoplay control: a menu button offering round counts; while running
 * it becomes a Stop button showing progress. Stop reasons are announced.
 */
export class AutoPlay {
  readonly element: HTMLDivElement;
  readonly #toggle: HTMLButtonElement;
  readonly #menu: HTMLDivElement;
  readonly #status: HTMLSpanElement;
  readonly #controller: AutoPlayController;
  readonly #disposer = new Disposer();
  #disabled = false;

  constructor({ controller, choices = [10, 25, 50, 100] }: AutoPlayOptions) {
    this.#controller = controller;
    const menuId = `cg-autoplay-menu-${++nextId}`;
    // A disclosure: the button shows and hides a group of buttons (not a
    // menu, which aria-haspopup would announce).
    this.#toggle = h('button', {
      type: 'button',
      class: 'cg-btn cg-autoplay__toggle',
      'aria-expanded': 'false',
      'aria-controls': menuId,
    });
    this.#menu = h(
      'div',
      {
        class: 'cg-autoplay__menu',
        id: menuId,
        role: 'group',
        'aria-label': 'Autoplay rounds',
        hidden: true,
      },
      h('span', { class: 'cg-autoplay__hint' }, 'Rounds'),
      ...choices.map((rounds) => {
        const option = h(
          'button',
          { type: 'button', class: 'cg-autoplay__choice cg-num' },
          String(rounds),
        );
        this.#disposer.listen(option, 'click', () => {
          this.#close();
          void controller.start(rounds);
        });
        return option;
      }),
      h('span', { class: 'cg-autoplay__hint' }, 'Stops if the balance cannot cover the bet.'),
    );
    this.#status = h('span', { class: 'cg-sr-only', 'aria-live': 'polite' });
    this.element = h('div', { class: 'cg-autoplay' }, this.#toggle, this.#menu, this.#status);

    this.#disposer.listen(this.#toggle, 'click', () => {
      if (controller.state.running) controller.stop();
      else if (this.#menu.hidden) this.#open();
      else this.#close();
    });
    this.#disposer.listen(document, 'pointerdown', (event) => {
      if (!this.element.contains(event.target as Node)) this.#close();
    });
    this.#disposer.listen(this.element, 'keydown', (event) => {
      if (event.key === 'Escape' && !this.#menu.hidden) this.#close();
    });
    this.#disposer.add(
      controller.subscribe((state, previous) => {
        this.#render(state);
        if (previous.running && !state.running && state.lastStop !== null) {
          this.#status.textContent = STOP_MESSAGES[state.lastStop];
        }
      }),
    );
    this.#render(controller.state);
  }

  /** Disables starting autoplay (e.g. no bet placed); a running autoplay can still be stopped. */
  setDisabled(disabled: boolean): void {
    this.#disabled = disabled;
    if (disabled) this.#close();
    this.#render(this.#controller.state);
  }

  destroy(): void {
    this.#controller.stop();
    this.#disposer.dispose();
    this.element.remove();
  }

  #open(): void {
    if (this.#disabled) return;
    this.#menu.hidden = false;
    this.#toggle.setAttribute('aria-expanded', 'true');
    this.#menu.querySelector('button')?.focus();
  }

  #close(): void {
    const focused = this.#menu.contains(document.activeElement);
    this.#menu.hidden = true;
    this.#toggle.setAttribute('aria-expanded', 'false');
    // Hiding the menu would drop the keyboard focus to the page: back to the
    // toggle, which stops autoplay once it runs.
    if (focused) this.#toggle.focus();
  }

  #render(state: AutoPlayState): void {
    this.element.dataset.running = String(state.running);
    // Unavailable rather than disabled, so it keeps the keyboard focus
    // between rounds (#open() checks).
    this.#toggle.setAttribute('aria-disabled', String(this.#disabled && !state.running));
    if (state.running) {
      this.#toggle.replaceChildren(
        icon('stop'),
        h('span', null, 'Stop'),
        h('span', { class: 'cg-autoplay__count cg-num' }, `${state.played}/${state.total}`),
      );
      this.#toggle.setAttribute(
        'aria-label',
        `Stop autoplay, ${state.played} of ${state.total} rounds played`,
      );
      this.#toggle.style.setProperty('--progress', String(state.played / state.total));
    } else {
      this.#toggle.replaceChildren(icon('autoplay'), h('span', null, 'Auto'));
      this.#toggle.setAttribute('aria-label', 'Autoplay');
      this.#toggle.style.removeProperty('--progress');
    }
  }
}
