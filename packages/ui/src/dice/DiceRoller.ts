import { createSeededRng, type DicePair } from '@casinogames/engine';
import type { SoundEngine } from '../audio/SoundEngine.ts';
import { Disposer, h } from '../dom/h.ts';
import { motion as defaultMotion, type Motion } from '../motion/motion.ts';
import type { DiceView } from './dice-view.ts';
import { createDomDiceView } from './dom-dice-view.ts';
import './dice.css';

export interface DiceRollerOptions {
  /** Element the tray fills; size it with CSS. */
  readonly host: HTMLElement;
  readonly motion?: Motion;
  readonly sound?: SoundEngine;
  /** Dice shown before the first roll. */
  readonly initial?: DicePair;
  /**
   * Called when the player throws: a tap, a hold-and-release (longer holds
   * throw harder), or Enter/Space. The game then decides the result with its
   * Rng and hands it to roll().
   */
  readonly onThrow?: (power: number) => void;
  /** 'dom' forces the fallback renderer (tests, very old devices). */
  readonly renderer?: 'auto' | 'dom';
  readonly label?: string;
}

const FULL_HOLD_MS = 1_200;
const TAP_POWER = 0.35;
const KEYBOARD_POWER = 0.6;
const THROW_MS = 1_250;

/**
 * The player's dice. The roller never decides an outcome: it animates the
 * result the engine drew. Rendering is delegated to a DiceView — PixiJS 3D
 * dice when available, loaded on demand, else flat CSS dice.
 */
export class DiceRoller {
  readonly element: HTMLDivElement;
  readonly #options: DiceRollerOptions;
  readonly #view: DiceView;
  readonly #motion: Motion;
  readonly #disposer = new Disposer();
  #armed = false;
  #hold: { start: number; frame: number; lastShake: number } | null = null;

  private constructor(options: DiceRollerOptions, element: HTMLDivElement, view: DiceView) {
    this.#options = options;
    this.element = element;
    this.#view = view;
    this.#motion = options.motion ?? defaultMotion;
    this.#bindEvents();
    this.disarm();
  }

  static async create(options: DiceRollerOptions): Promise<DiceRoller> {
    const initial = options.initial ?? [5, 2];
    const cosmetic = createSeededRng('dice-cosmetics');
    const hint = h(
      'span',
      { class: 'cg-dice-tray__hint', 'aria-hidden': 'true' },
      'Tap or hold to roll',
    );
    const stage = h('div', { class: 'cg-dice-tray__stage' });
    const element = h(
      'div',
      { class: 'cg-dice-tray', role: 'button', 'aria-label': options.label ?? 'Roll the dice' },
      stage,
      hint,
    );
    options.host.append(element);

    let view: DiceView | null = null;
    if (options.renderer !== 'dom') {
      try {
        const { createPixiDiceView } = await import('../pixi/dice-view.ts');
        view = await createPixiDiceView(stage, initial, cosmetic);
      } catch (error) {
        console.warn('3D dice unavailable, using the CSS fallback.', error);
      }
    }
    view ??= createDomDiceView(stage, initial, cosmetic);
    return new DiceRoller(options, element, view);
  }

  get armed(): boolean {
    return this.#armed;
  }

  /** Lets the player throw. */
  arm(): void {
    this.#armed = true;
    this.element.classList.add('is-armed');
    this.element.tabIndex = 0;
    this.element.setAttribute('aria-disabled', 'false');
  }

  disarm(): void {
    this.#armed = false;
    this.#cancelHold();
    this.element.classList.remove('is-armed');
    this.element.tabIndex = -1;
    this.element.setAttribute('aria-disabled', 'true');
  }

  /** Throws now, as if the player had (e.g. from a separate Roll button). */
  requestThrow(power = KEYBOARD_POWER): void {
    if (!this.#armed) return;
    this.disarm();
    this.#options.onThrow?.(power);
  }

  /** Animates the dice to the engine's result. */
  async roll(dice: DicePair, { power = 0.55 }: { power?: number } = {}): Promise<void> {
    const level = this.#motion.level;
    const sound = this.#options.sound;
    await this.#view.throw(dice, {
      power,
      duration: this.#motion.duration(THROW_MS * (0.85 + 0.3 * power)),
      travel: level === 'full',
      onBounce: (intensity) => sound?.play('dice-bounce', { intensity }),
    });
    if (level !== 'full') sound?.play('dice-bounce', { intensity: 0.6 });
  }

  /** Shows the dice at rest without animation. */
  show(dice: DicePair): void {
    this.#view.show(dice);
  }

  destroy(): void {
    this.#cancelHold();
    this.#disposer.dispose();
    this.#view.destroy();
    this.element.remove();
  }

  #bindEvents(): void {
    const d = this.#disposer;
    d.listen(this.element, 'pointerdown', (event) => {
      if (!this.#armed || event.button !== 0 || this.#hold !== null) return;
      // Keep receiving pointerup if the finger slides off (not in every environment).
      if ('setPointerCapture' in this.element) this.element.setPointerCapture(event.pointerId);
      const start = performance.now();
      this.#hold = { start, frame: 0, lastShake: 0 };
      const tick = (now: number) => {
        const hold = this.#hold;
        if (hold === null) return;
        const intensity = Math.min(1, (now - hold.start) / FULL_HOLD_MS);
        this.#view.hold(Math.max(0.05, intensity));
        if (now - hold.lastShake > 170 - intensity * 60) {
          hold.lastShake = now;
          this.#options.sound?.play('dice-shake');
        }
        hold.frame = requestAnimationFrame(tick);
      };
      this.#hold.frame = requestAnimationFrame(tick);
    });
    d.listen(this.element, 'pointerup', () => {
      const hold = this.#hold;
      if (hold === null) return;
      const intensity = Math.min(1, (performance.now() - hold.start) / FULL_HOLD_MS);
      this.#cancelHold({ settle: false });
      this.requestThrow(TAP_POWER + (1 - TAP_POWER) * intensity);
    });
    d.listen(this.element, 'pointercancel', () => {
      this.#cancelHold();
    });
    d.listen(this.element, 'keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      this.requestThrow(KEYBOARD_POWER);
    });
  }

  #cancelHold({ settle = true } = {}): void {
    if (this.#hold === null) return;
    cancelAnimationFrame(this.#hold.frame);
    this.#hold = null;
    if (settle) this.#view.hold(0);
  }
}
