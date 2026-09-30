import { createSeededRng, type DicePair, type Rng } from '@casinogames/engine';
import type { SoundEngine } from '../audio/SoundEngine.ts';
import { Disposer, h } from '../dom/h.ts';
import { icon } from '../dom/icons.ts';
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
  /**
   * 'auto' (the default) draws PixiJS 3D dice from the start. 'deferred'
   * starts with the CSS dice and moves to PixiJS at the first throw after
   * enhance(), so a page can load without PixiJS. 'dom' keeps the CSS dice
   * (tests, very old devices).
   */
  readonly renderer?: DiceRenderer;
  /**
   * The tray's accessible name. Keep the words of its hint, "Tap or hold to
   * roll", in it: speech control users say what they see.
   */
  readonly label?: string;
}

export type DiceRenderer = 'auto' | 'deferred' | 'dom';

/** A die of the pair, by position. */
export type DieIndex = 0 | 1;

export interface DicePickOptions {
  /** Called when the player taps a die's button, or activates it from the keyboard. */
  readonly onPick: (index: DieIndex) => void;
  /** Each die's accessible name, e.g. "Lock the 6". */
  readonly label: (index: DieIndex) => string;
}

export interface RollOptions {
  /** Shapes the throw animation only. */
  readonly power?: number;
  /** Dice that stay where they lie (a locked die); only the others are thrown. */
  readonly keep?: readonly [boolean, boolean];
}

/** PixiJS 3D dice drawn in `stage`, or null where they cannot start. */
async function loadPixiDice(
  stage: HTMLElement,
  dice: DicePair,
  rng: Rng,
): Promise<DiceView | null> {
  try {
    const { createPixiDiceView } = await import('../pixi/dice-view.ts');
    return await createPixiDiceView(stage, dice, rng);
  } catch (error) {
    console.warn('3D dice unavailable, using the CSS fallback.', error);
    return null;
  }
}

/** What the tray shows while the player can throw. */
const HINT = 'Tap or hold to roll';
/** The smallest tap target over a die, in CSS pixels. */
const MIN_PICK = 48;
const FULL_HOLD_MS = 1_200;
const TAP_POWER = 0.35;
const KEYBOARD_POWER = 0.6;
const THROW_MS = 1_250;

/**
 * The player's dice. The roller never decides an outcome: it animates the
 * result the engine drew. Rendering is delegated to a DiceView — PixiJS 3D
 * dice when available, loaded on demand, else flat CSS dice.
 *
 * For a choice made by pointing at a die (Lock & Roll's lock), offerDice() lays
 * a button over each die, in the host (which must be positioned), beside
 * the tray: the tray itself is a button.
 */
export class DiceRoller {
  readonly element: HTMLDivElement;
  readonly #options: DiceRollerOptions;
  #view: DiceView;
  /** The element the view draws in. */
  #stage: HTMLElement;
  /** The dice showing: where a view that takes over starts from. */
  #dice: DicePair;
  readonly #cosmetic: Rng;
  /** enhance(): loading the PixiJS dice, then ready to take over at the next throw. */
  #enhancing: Promise<void> | null = null;
  #upgrade: { readonly view: DiceView; readonly stage: HTMLElement } | null = null;
  #destroyed = false;
  readonly #motion: Motion;
  /** Outside the tray: a role="button" hides its descendants from assistive tech. */
  readonly #announcer: HTMLSpanElement;
  readonly #disposer = new Disposer();
  #armed = false;
  #hold: { start: number; frame: number; lastShake: number } | null = null;
  /** The buttons over the dice while offerDice() is in force, and their teardown. */
  #picks: {
    readonly element: HTMLElement;
    readonly buttons: readonly HTMLButtonElement[];
    readonly off: () => void;
  } | null = null;

  private constructor(
    options: DiceRollerOptions,
    parts: {
      readonly element: HTMLDivElement;
      readonly stage: HTMLElement;
      readonly view: DiceView;
      readonly dice: DicePair;
      readonly cosmetic: Rng;
      readonly announcer: HTMLSpanElement;
    },
  ) {
    this.#options = options;
    this.element = parts.element;
    this.#stage = parts.stage;
    this.#view = parts.view;
    this.#dice = parts.dice;
    this.#cosmetic = parts.cosmetic;
    this.#announcer = parts.announcer;
    this.#motion = options.motion ?? defaultMotion;
    this.#bindEvents();
    this.disarm();
  }

  static async create(options: DiceRollerOptions): Promise<DiceRoller> {
    const initial = options.initial ?? [5, 2];
    const cosmetic = createSeededRng('dice-cosmetics');
    const hint = h('span', { class: 'cg-dice-tray__hint', 'aria-hidden': 'true' }, HINT);
    const stage = h('div', { class: 'cg-dice-tray__stage' });
    const element = h(
      'div',
      {
        class: 'cg-dice-tray',
        role: 'button',
        'aria-label': options.label ?? `${HINT} the dice`,
      },
      stage,
      hint,
    );
    const announcer = h('span', { class: 'cg-sr-only', 'aria-live': 'polite' });
    options.host.append(element, announcer);

    const view =
      ((options.renderer ?? 'auto') === 'auto'
        ? await loadPixiDice(stage, initial, cosmetic)
        : null) ?? createDomDiceView(stage, initial, cosmetic);
    return new DiceRoller(options, { element, stage, view, dice: initial, cosmetic, announcer });
  }

  /**
   * With the 'deferred' renderer, loads the PixiJS dice in the background;
   * they take over from the CSS dice at the next throw (not while a die is
   * kept). Call it on the player's first interaction. Resolves once they are
   * ready, or unavailable; does nothing more when called again, or with
   * another renderer.
   */
  enhance(): Promise<void> {
    if (this.#options.renderer !== 'deferred' || this.#destroyed) return Promise.resolve();
    this.#enhancing ??= (async () => {
      // Drawn out of sight, beside the CSS dice, until it takes over.
      const stage = h('div', { class: 'cg-dice-tray__stage is-pending' });
      this.#stage.after(stage);
      const view = await loadPixiDice(stage, this.#dice, this.#cosmetic);
      if (view === null || this.#destroyed) {
        view?.destroy();
        stage.remove();
        return;
      }
      this.#upgrade = { view, stage };
    })();
    return this.#enhancing;
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

  /**
   * Animates the dice to the engine's result, then announces it. Dice in
   * `keep` stay where they lie: a locked die while the other is re-rolled.
   */
  async roll(dice: DicePair, { power = 0.55, keep }: RollOptions = {}): Promise<void> {
    if (keep?.[0] !== true && keep?.[1] !== true) this.#adoptUpgrade();
    const level = this.#motion.level;
    const sound = this.#options.sound;
    this.#dice = dice;
    await this.#view.throw(dice, {
      power,
      duration: this.#motion.duration(THROW_MS * (0.85 + 0.3 * power)),
      travel: level === 'full',
      onBounce: (intensity) => sound?.play('dice-bounce', { intensity }),
      ...(keep === undefined ? {} : { keep }),
    });
    if (level !== 'full') sound?.play('dice-bounce', { intensity: 0.6 });
    const kept = keep?.[0] === true ? 0 : keep?.[1] === true ? 1 : null;
    this.#announcer.textContent =
      kept === null
        ? `Rolled ${dice[0]} and ${dice[1]}`
        : `Kept the ${dice[kept]}, rolled ${dice[kept === 0 ? 1 : 0]}`;
  }

  /**
   * Lays a button over each die, following the dice as they move, for a
   * choice made by pointing at a die. setHeld() marks the dice chosen.
   */
  offerDice(options: DicePickOptions): void {
    this.withdrawDice();
    const buttons = ([0, 1] as const).map((index) => {
      const button = h(
        'button',
        {
          type: 'button',
          class: 'cg-die-pick',
          'aria-pressed': 'false',
          'aria-label': options.label(index),
          title: options.label(index),
          dataset: { die: String(index) },
        },
        h('span', { class: 'cg-die-pick__lock' }, icon('lock')),
      );
      button.addEventListener('click', () => {
        options.onPick(index);
      });
      return button;
    });
    const element = h('div', { class: 'cg-die-picks' }, ...buttons);
    this.#options.host.append(element);
    const place = () => {
      this.#view.spots().forEach((spot, index) => {
        const size = Math.max(MIN_PICK, spot.size * 1.3);
        const button = buttons[index]!;
        button.style.left = `${spot.x - size / 2}px`;
        button.style.top = `${spot.y - size / 2}px`;
        button.style.width = `${size}px`;
        button.style.height = `${size}px`;
      });
    };
    place();
    this.#picks = { element, buttons, off: this.#view.onLayout(place) };
  }

  /**
   * Marks the dice that are held (a padlock over each), while offerDice() is
   * in force. `final`: the choice is made, so the padlocks stay and the
   * buttons stop responding.
   */
  setHeld(held: readonly [boolean, boolean], { final = false }: { final?: boolean } = {}): void {
    this.#picks?.buttons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(held[index] === true));
      button.classList.toggle('is-held', held[index] === true);
      button.disabled = final;
    });
  }

  /** Takes the buttons over the dice away. */
  withdrawDice(): void {
    if (this.#picks === null) return;
    this.#picks.off();
    this.#picks.element.remove();
    this.#picks = null;
  }

  /** Shows the dice at rest without animation. */
  show(dice: DicePair): void {
    this.#dice = dice;
    this.#view.show(dice);
  }

  destroy(): void {
    this.#destroyed = true;
    this.#cancelHold();
    this.withdrawDice();
    this.#disposer.dispose();
    this.#upgrade?.view.destroy();
    this.#upgrade = null;
    this.#view.destroy();
    this.element.remove();
    this.#announcer.remove();
  }

  /**
   * The PixiJS dice loaded by enhance() take over, showing the same faces:
   * at a throw of both dice, so the change passes with the throw.
   */
  #adoptUpgrade(): void {
    const upgrade = this.#upgrade;
    if (upgrade === null || this.#hold !== null || this.#picks !== null) return;
    this.#upgrade = null;
    upgrade.view.show(this.#dice);
    this.#view.destroy();
    this.#stage.remove();
    upgrade.stage.classList.remove('is-pending');
    this.#view = upgrade.view;
    this.#stage = upgrade.stage;
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
        // With reduced motion the held dice stay put; the shake is heard.
        if (this.#motion.level !== 'reduced') this.#view.hold(Math.max(0.05, intensity));
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
