import { cardLabel, type Card } from '@casinogames/engine';
import type { SoundEngine } from '../audio/SoundEngine.ts';
import { h } from '../dom/h.ts';
import { motion as defaultMotion, type Motion } from '../motion/motion.ts';
import type { CardView, HandLayout, ShoeDisplay } from './card-view.ts';
import { createDomCardView } from './dom-card-view.ts';
import './cards.css';

export interface CardDealerOptions {
  /** Element the table fills; size it with CSS. */
  readonly host: HTMLElement;
  /** Where each hand sits (fractions of the table size). */
  readonly hands: readonly HandLayout[];
  readonly motion?: Motion;
  readonly sound?: SoundEngine;
  /**
   * 'auto' (the default) draws the cards with PixiJS from the start.
   * 'deferred' starts with DOM cards and moves to PixiJS the next time the
   * table is cleared after enhance(), so a page can load without PixiJS.
   * 'dom' keeps the DOM cards (tests, very old devices).
   */
  readonly renderer?: CardRenderer;
  /**
   * Card size relative to the default, which leaves room for several hands.
   * A table that deals a single card can use about 2. Default 1.
   */
  readonly cardScale?: number;
}

export type CardRenderer = 'auto' | 'deferred' | 'dom';

/** PixiJS cards drawn in `stage`, or null where they cannot start. */
async function loadPixiCards(
  stage: HTMLElement,
  options: CardDealerOptions,
): Promise<CardView | null> {
  try {
    const { createPixiCardView } = await import('../pixi/card-view.ts');
    return await createPixiCardView(stage, options.hands, options.cardScale);
  } catch (error) {
    console.warn('Canvas cards unavailable, using the DOM fallback.', error);
    return null;
  }
}

const DEAL_MS = 380;
const FLIP_MS = 280;
const CLEAR_MS = 360;
const SHUFFLE_MS = 900;

/**
 * The dealer's hands: deals the cards the engine drew, from a shoe, with a
 * slide and a flip. It never draws cards itself. Rendering is delegated to a
 * CardView — PixiJS when available, loaded on demand, else DOM cards.
 */
export class CardDealer {
  readonly element: HTMLDivElement;
  #view: CardView;
  /** The element the view draws in. */
  #stage: HTMLElement;
  readonly #options: CardDealerOptions;
  readonly #motion: Motion;
  readonly #announcer: HTMLSpanElement;
  readonly #counts = new Map<string, number>();
  /** The shoe display last set: what a view that takes over starts from. */
  #shoe: ShoeDisplay | null = null;
  /** Animations under way on the view. */
  #busy = 0;
  /** enhance(): loading the PixiJS cards, then ready to take over at the next clear. */
  #enhancing: Promise<void> | null = null;
  #upgrade: { readonly view: CardView; readonly stage: HTMLElement } | null = null;
  #destroyed = false;

  private constructor(
    options: CardDealerOptions,
    parts: {
      readonly element: HTMLDivElement;
      readonly stage: HTMLElement;
      readonly view: CardView;
      readonly announcer: HTMLSpanElement;
    },
  ) {
    this.#options = options;
    this.element = parts.element;
    this.#stage = parts.stage;
    this.#view = parts.view;
    this.#motion = options.motion ?? defaultMotion;
    this.#announcer = parts.announcer;
    for (const hand of options.hands) this.#counts.set(hand.id, 0);
  }

  static async create(options: CardDealerOptions): Promise<CardDealer> {
    const stage = h('div', { class: 'cg-card-table__stage' });
    const announcer = h('span', { class: 'cg-sr-only', 'aria-live': 'polite' });
    const element = h('div', { class: 'cg-card-table' }, stage, announcer);
    options.host.append(element);

    const view =
      ((options.renderer ?? 'auto') === 'auto' ? await loadPixiCards(stage, options) : null) ??
      createDomCardView(stage, options.hands, options.cardScale);
    return new CardDealer(options, { element, stage, view, announcer });
  }

  /**
   * With the 'deferred' renderer, loads the PixiJS cards in the background;
   * they take over from the DOM cards the next time the table is cleared.
   * Call it on the player's first interaction. Resolves once they are ready,
   * or unavailable; does nothing more when called again, or with another
   * renderer.
   */
  enhance(): Promise<void> {
    if (this.#options.renderer !== 'deferred' || this.#destroyed) return Promise.resolve();
    this.#enhancing ??= (async () => {
      // Drawn out of sight, beside the DOM cards, until it takes over.
      const stage = h('div', { class: 'cg-card-table__stage is-pending' });
      this.#stage.after(stage);
      const view = await loadPixiCards(stage, this.#options);
      if (view === null || this.#destroyed) {
        view?.destroy();
        stage.remove();
        return;
      }
      this.#upgrade = { view, stage };
    })();
    return this.#enhancing;
  }

  /** Number of cards currently in a hand. */
  count(hand: string): number {
    return this.#counts.get(hand) ?? 0;
  }

  /**
   * Deals a card from the shoe to the end of `hand`, face up unless told
   * otherwise. A face-down card is drawn as a back only and its face is not
   * put on the page until reveal(), so `card` may be null when the face is
   * unknown, as when a server withholds hidden cards.
   */
  async deal(
    card: Card | null,
    hand: string,
    { faceUp = true }: { faceUp?: boolean } = {},
  ): Promise<void> {
    if (!this.#counts.has(hand)) throw new RangeError(`Unknown hand "${hand}"`);
    const face = faceUp ? card : null;
    if (faceUp && face === null) throw new TypeError('A card dealt face up needs its face');
    const index = this.count(hand);
    this.#counts.set(hand, index + 1);
    this.#options.sound?.play('card-slide');
    await this.#animate((view) => view.deal(face, hand, this.#motion.duration(DEAL_MS)));
    if (face !== null) await this.reveal(hand, index, face);
    else this.#announce(`${this.#label(hand)}: face-down card`);
  }

  /** Turns over the card at `index` in `hand`, painting its face if it was unknown. */
  async reveal(hand: string, index: number, card: Card): Promise<void> {
    this.#options.sound?.play('card-flip');
    await this.#animate((view) => view.reveal(hand, index, card, this.#motion.duration(FLIP_MS)));
    this.#announce(`${this.#label(hand)}: ${cardLabel(card)}`);
  }

  /** Sweeps the cards off the table. */
  async clear(): Promise<void> {
    for (const hand of this.#counts.keys()) this.#counts.set(hand, 0);
    await this.#animate((view) => view.clear(this.#motion.duration(CLEAR_MS)));
    this.#adoptUpgrade();
  }

  /** Plays the shuffle (e.g. on a shoe-shuffled event). */
  async shuffle(): Promise<void> {
    this.#options.sound?.play('shuffle');
    this.#announce('Shuffling the shoe');
    await this.#animate((view) => view.shuffle(this.#motion.duration(SHUFFLE_MS)));
  }

  /** Updates the shoe display: cards left and whether the cut card is out. */
  setShoe(remaining: number, size: number, cutCardOut = false): void {
    this.#shoe = { remaining, size, cutCardOut };
    this.#view.setShoe(this.#shoe);
  }

  destroy(): void {
    this.#destroyed = true;
    this.#upgrade?.view.destroy();
    this.#upgrade = null;
    this.#view.destroy();
    this.element.remove();
  }

  async #animate(animation: (view: CardView) => Promise<void>): Promise<void> {
    this.#busy += 1;
    try {
      await animation(this.#view);
    } finally {
      this.#busy -= 1;
    }
  }

  /**
   * The PixiJS cards loaded by enhance() take over, with the same shoe
   * display: only on a bare, still table, so no card has to move across.
   */
  #adoptUpgrade(): void {
    const upgrade = this.#upgrade;
    if (upgrade === null || this.#busy > 0) return;
    if ([...this.#counts.values()].some((count) => count > 0)) return;
    this.#upgrade = null;
    if (this.#shoe !== null) upgrade.view.setShoe(this.#shoe);
    this.#view.destroy();
    this.#stage.remove();
    upgrade.stage.classList.remove('is-pending');
    this.#view = upgrade.view;
    this.#stage = upgrade.stage;
  }

  #label(hand: string): string {
    return this.#options.hands.find((candidate) => candidate.id === hand)?.label ?? hand;
  }

  #announce(text: string): void {
    this.#announcer.textContent = text;
  }
}
