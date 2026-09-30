import { lockAndRollWins } from '@casinogames/engine';
import { h } from '@casinogames/ui';

/** Who won once both totals are known; a tie goes to the house. */
export type Leader = 'none' | 'dice' | 'cards' | 'tie';

const VERDICTS: Readonly<Record<Leader, string>> = {
  none: 'vs',
  dice: 'Your dice win',
  cards: 'The dealer wins',
  tie: 'Tie · house wins',
};

/** One side's total: who holds it and the number. */
class Side {
  readonly element: HTMLElement;
  readonly #total: HTMLElement;

  constructor(who: string, side: 'dice' | 'cards') {
    this.#total = h('strong', { class: 'lr-score__total cg-num' }, '—');
    this.element = h(
      'div',
      { class: `lr-score__side lr-score__side--${side}` },
      h('span', { class: 'lr-score__who' }, who),
      this.#total,
    );
  }

  get text(): string {
    return this.#total.textContent;
  }

  set(text: string): void {
    this.#total.textContent = text;
  }
}

/**
 * The two totals side by side: the player's dice and the dealer's cards, as
 * they come, then the winner highlighted. The engine decides the round; the
 * scoreboard reads it with the same rule (lockAndRollWins).
 */
export class Scoreboard {
  readonly element: HTMLElement;
  readonly #dice = new Side('Your dice', 'dice');
  readonly #cards = new Side('Dealer', 'cards');
  readonly #verdict: HTMLElement;

  constructor() {
    this.#verdict = h('span', { class: 'lr-score__verdict' }, VERDICTS.none);
    this.element = h(
      'div',
      { class: 'lr-score', dataset: { leader: 'none' } },
      this.#dice.element,
      this.#verdict,
      this.#cards.element,
    );
  }

  get leader(): Leader {
    return (this.element.dataset.leader ?? 'none') as Leader;
  }

  /** The totals as shown: [dice, cards]. */
  get totals(): readonly [string, string] {
    return [this.#dice.text, this.#cards.text];
  }

  /** A new round: both totals unknown. */
  reset(): void {
    this.#dice.set('—');
    this.#cards.set('—');
    this.#setLeader('none');
  }

  setDice(total: number): void {
    this.#dice.set(String(total));
  }

  /** The dealer's cards as they land: the first alone, then the total. */
  setCards(values: readonly number[]): void {
    const [first, second] = values;
    this.#cards.set(
      first === undefined ? '—' : second === undefined ? `${first} + ?` : String(first + second),
    );
  }

  /** Both totals known: the winner is highlighted. */
  settle(dice: number, cards: number): Leader {
    const leader: Leader = lockAndRollWins(dice, cards) ? 'dice' : dice === cards ? 'tie' : 'cards';
    this.#setLeader(leader);
    return leader;
  }

  #setLeader(leader: Leader): void {
    this.element.dataset.leader = leader;
    this.#verdict.textContent = VERDICTS[leader];
  }
}
