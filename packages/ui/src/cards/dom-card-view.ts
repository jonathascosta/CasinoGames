import { cardLabel, isRed, rankLabel, suitSymbol } from '@casinogames/engine';
import { formatCount } from '../format/format.ts';
import { h } from '../dom/h.ts';
import { wait } from '../motion/motion.ts';
import type { CardView, HandLayout } from './card-view.ts';

/**
 * Cards as DOM elements (the fallback renderer): CSS transitions slide them
 * from the shoe and a 3D rotateY turns them over.
 */
export function createDomCardView(container: HTMLElement, hands: readonly HandLayout[]): CardView {
  const table = h('div', { class: 'cg-dom-cards' });
  const shoe = h('div', { class: 'cg-dom-cards__shoe', 'aria-hidden': 'true' });
  const counter = h('span', { class: 'cg-dom-cards__counter cg-num', 'aria-hidden': 'true' });
  table.append(
    shoe,
    counter,
    ...hands
      .map((hand) =>
        hand.label === undefined
          ? null
          : h(
              'span',
              {
                class: 'cg-dom-cards__label',
                style: `--x: ${hand.x * 100}%; --y: ${hand.y * 100}%`,
                'aria-hidden': 'true',
              },
              hand.label,
            ),
      )
      .filter((label) => label !== null),
  );
  container.append(table);
  const dealt = new Map<string, HTMLElement[]>(hands.map((hand) => [hand.id, []]));

  const cardsOf = (handId: string): HTMLElement[] => {
    const cards = dealt.get(handId);
    if (cards === undefined) throw new RangeError(`Unknown hand "${handId}"`);
    return cards;
  };

  const layout = (hand: HandLayout) => {
    const cards = cardsOf(hand.id);
    cards.forEach((element, i) => {
      element.style.setProperty('--x', `${hand.x * 100}%`);
      element.style.setProperty('--y', `${hand.y * 100}%`);
      element.style.setProperty('--slot', String(i - (cards.length - 1) / 2));
    });
  };

  return {
    async deal(card, handId, duration) {
      const hand = hands.find((candidate) => candidate.id === handId);
      if (hand === undefined) throw new RangeError(`Unknown hand "${handId}"`);
      const element = h(
        'div',
        { class: 'cg-dom-card', role: 'img', 'aria-label': 'Face-down card' },
        h('div', { class: 'cg-dom-card__back' }),
        h(
          'div',
          { class: 'cg-dom-card__face', dataset: { red: String(isRed(card.suit)) } },
          h('span', { class: 'cg-dom-card__rank' }, rankLabel(card.rank)),
          h('span', { class: 'cg-dom-card__suit' }, suitSymbol(card.suit)),
        ),
      );
      element.style.setProperty('--deal-ms', `${duration}ms`);
      table.append(element);
      cardsOf(handId).push(element);
      // Start at the shoe, then move to the hand once the start is laid out.
      void element.getBoundingClientRect();
      layout(hand);
      element.classList.add('is-dealt');
      await wait(duration);
    },
    async reveal(handId, index, card, duration) {
      const element = cardsOf(handId)[index];
      if (element === undefined) throw new RangeError(`No card ${index} in "${handId}"`);
      element.style.setProperty('--flip-ms', `${duration}ms`);
      element.setAttribute('aria-label', cardLabel(card));
      element.classList.add('is-face-up');
      await wait(duration);
    },
    async clear(duration) {
      for (const cards of dealt.values()) {
        for (const element of cards) {
          element.style.setProperty('--deal-ms', `${duration}ms`);
          element.classList.add('is-cleared');
        }
      }
      await wait(duration);
      for (const cards of dealt.values()) {
        for (const element of cards.splice(0)) element.remove();
      }
    },
    async shuffle(duration) {
      shoe.classList.add('is-shuffling');
      await wait(duration);
      shoe.classList.remove('is-shuffling');
    },
    setShoe({ remaining, size, cutCardOut }) {
      counter.hidden = !Number.isFinite(size);
      counter.textContent = `${formatCount(remaining)} / ${formatCount(size)}`;
      counter.dataset.cut = String(cutCardOut);
    },
    destroy() {
      table.remove();
    },
  };
}
