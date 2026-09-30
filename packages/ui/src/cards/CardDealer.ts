import { cardLabel, type Card } from '@casinogames/engine';
import type { SoundEngine } from '../audio/SoundEngine.ts';
import { h } from '../dom/h.ts';
import { motion as defaultMotion, type Motion } from '../motion/motion.ts';
import type { CardView, HandLayout } from './card-view.ts';
import { createDomCardView } from './dom-card-view.ts';
import './cards.css';

export interface CardDealerOptions {
  /** Element the table fills; size it with CSS. */
  readonly host: HTMLElement;
  /** Where each hand sits (fractions of the table size). */
  readonly hands: readonly HandLayout[];
  readonly motion?: Motion;
  readonly sound?: SoundEngine;
  /** 'dom' forces the fallback renderer (tests, very old devices). */
  readonly renderer?: 'auto' | 'dom';
  /**
   * Card size relative to the default, which leaves room for several hands.
   * A table that deals a single card can use about 2. Default 1.
   */
  readonly cardScale?: number;
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
  readonly #view: CardView;
  readonly #options: CardDealerOptions;
  readonly #motion: Motion;
  readonly #announcer: HTMLSpanElement;
  readonly #counts = new Map<string, number>();

  private constructor(
    options: CardDealerOptions,
    element: HTMLDivElement,
    view: CardView,
    announcer: HTMLSpanElement,
  ) {
    this.#options = options;
    this.element = element;
    this.#view = view;
    this.#motion = options.motion ?? defaultMotion;
    this.#announcer = announcer;
    for (const hand of options.hands) this.#counts.set(hand.id, 0);
  }

  static async create(options: CardDealerOptions): Promise<CardDealer> {
    const stage = h('div', { class: 'cg-card-table__stage' });
    const announcer = h('span', { class: 'cg-sr-only', 'aria-live': 'polite' });
    const element = h('div', { class: 'cg-card-table' }, stage, announcer);
    options.host.append(element);

    let view: CardView | null = null;
    if (options.renderer !== 'dom') {
      try {
        const { createPixiCardView } = await import('../pixi/card-view.ts');
        view = await createPixiCardView(stage, options.hands, options.cardScale);
      } catch (error) {
        console.warn('Canvas cards unavailable, using the DOM fallback.', error);
      }
    }
    view ??= createDomCardView(stage, options.hands, options.cardScale);
    return new CardDealer(options, element, view, announcer);
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
    await this.#view.deal(face, hand, this.#motion.duration(DEAL_MS));
    if (face !== null) await this.reveal(hand, index, face);
    else this.#announce(`${this.#label(hand)}: face-down card`);
  }

  /** Turns over the card at `index` in `hand`, painting its face if it was unknown. */
  async reveal(hand: string, index: number, card: Card): Promise<void> {
    this.#options.sound?.play('card-flip');
    await this.#view.reveal(hand, index, card, this.#motion.duration(FLIP_MS));
    this.#announce(`${this.#label(hand)}: ${cardLabel(card)}`);
  }

  /** Sweeps the cards off the table. */
  async clear(): Promise<void> {
    for (const hand of this.#counts.keys()) this.#counts.set(hand, 0);
    await this.#view.clear(this.#motion.duration(CLEAR_MS));
  }

  /** Plays the shuffle (e.g. on a shoe-shuffled event). */
  async shuffle(): Promise<void> {
    this.#options.sound?.play('shuffle');
    this.#announce('Shuffling the shoe');
    await this.#view.shuffle(this.#motion.duration(SHUFFLE_MS));
  }

  /** Updates the shoe display: cards left and whether the cut card is out. */
  setShoe(remaining: number, size: number, cutCardOut = false): void {
    this.#view.setShoe({ remaining, size, cutCardOut });
  }

  destroy(): void {
    this.#view.destroy();
    this.element.remove();
  }

  #label(hand: string): string {
    return this.#options.hands.find((candidate) => candidate.id === hand)?.label ?? hand;
  }

  #announce(text: string): void {
    this.#announcer.textContent = text;
  }
}
