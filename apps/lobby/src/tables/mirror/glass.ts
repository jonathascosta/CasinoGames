import { compareHands, readHand, type HandValues } from '@casinogames/engine';
import { h } from '@casinogames/ui';

/** Who the mirror tilts toward once both hands are known. */
export type Tilt = 'none' | 'dice' | 'cards' | 'level';

const VERDICTS: Readonly<Record<Tilt, string>> = {
  none: 'vs',
  dice: 'Your dice win',
  cards: "The dealer's cards win",
  level: 'Tie · house wins',
};

/** One side's hand: who holds it and how it reads, the same component for dice and cards. */
class HandLabel {
  readonly element: HTMLElement;
  readonly #value: HTMLElement;

  constructor(who: string) {
    this.#value = h('span', { class: 'mr-hand__value' }, '—');
    this.element = h(
      'p',
      { class: 'mr-hand' },
      h('span', { class: 'mr-hand__who' }, who),
      this.#value,
    );
  }

  get text(): string {
    return this.#value.textContent;
  }

  set(text: string, kind: 'pair' | 'sum' | 'partial' | 'none'): void {
    this.#value.textContent = text;
    this.element.dataset.kind = kind;
  }
}

/**
 * The split-screen mirror: the dealer's cards above, the player's dice
 * below, the glass between them. Both hands are read with the engine's
 * readHand and shown with the same label ("PAIR 4s", "SUM 9 HIGH 6"); once
 * both are known the glass tilts toward the winner and says who won. The
 * caption under it is the table's narration (a polite live region).
 */
export class MirrorGlass {
  readonly element: HTMLElement;
  readonly cardHost: HTMLElement;
  readonly diceHost: HTMLElement;
  readonly caption: HTMLElement;
  readonly #dice = new HandLabel('You');
  readonly #cards = new HandLabel('Dealer');
  readonly #verdict: HTMLElement;

  constructor() {
    this.cardHost = h('div', { class: 'tb-box mr-box mr-cards' });
    this.diceHost = h('div', { class: 'tb-box mr-box mr-dice' });
    this.#verdict = h('span', { class: 'mr-glass__verdict' }, VERDICTS.none);
    this.caption = h('p', { class: 'mr-caption', 'aria-live': 'polite' });
    this.element = h(
      'div',
      { class: 'mr-mirror', dataset: { tilt: 'none' } },
      h('div', { class: 'mr-half mr-half--cards' }, this.#cards.element, this.cardHost),
      h('div', { class: 'mr-glass', 'aria-hidden': 'true' }, this.#verdict),
      h('div', { class: 'mr-half mr-half--dice' }, this.diceHost, this.#dice.element),
    );
    this.reset();
  }

  /** The tilt shown: none while a round plays, then toward the winner. */
  get tilt(): Tilt {
    return (this.element.dataset.tilt ?? 'none') as Tilt;
  }

  /** The labels as shown, for the round's summary: [dice, cards]. */
  get labels(): readonly [string, string] {
    return [this.#dice.text, this.#cards.text];
  }

  /** A new round: both hands unknown and the glass level. */
  reset(): void {
    this.#dice.set('—', 'none');
    this.#cards.set('—', 'none');
    this.#setTilt('none');
  }

  showDice(dice: HandValues): void {
    const hand = readHand(dice);
    this.#dice.set(hand.label, hand.pair ? 'pair' : 'sum');
  }

  /** The dealer's cards as they turn: the first alone, then the hand. */
  showCards(values: readonly number[]): void {
    if (values.length < 2) {
      this.#cards.set(values.length === 0 ? '—' : `${values[0]} and ?`, 'partial');
      return;
    }
    const hand = readHand([values[0]!, values[1]!]);
    this.#cards.set(hand.label, hand.pair ? 'pair' : 'sum');
  }

  /** Both hands are known: the glass tilts toward the winner. */
  settle(dice: HandValues, cards: HandValues): Tilt {
    const result = compareHands(dice, cards);
    const tilt: Tilt = result > 0 ? 'dice' : result < 0 ? 'cards' : 'level';
    this.#setTilt(tilt);
    return tilt;
  }

  say(text: string): void {
    this.caption.textContent = text;
  }

  #setTilt(tilt: Tilt): void {
    this.element.dataset.tilt = tilt;
    this.#verdict.textContent = VERDICTS[tilt];
  }
}
