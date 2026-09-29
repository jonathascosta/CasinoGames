import { rollDie, type DicePair, type DieFace, type Rng } from '@casinogames/engine';
import { h } from '../dom/h.ts';
import { wait } from '../motion/motion.ts';
import type { DiceView, ThrowOptions } from './dice-view.ts';

/** Grid cells (row, column) of the pips of each face on a 3×3 grid. */
const PIP_CELLS: Readonly<Record<DieFace, readonly (readonly [number, number])[]>> = {
  1: [[2, 2]],
  2: [
    [1, 1],
    [3, 3],
  ],
  3: [
    [1, 1],
    [2, 2],
    [3, 3],
  ],
  4: [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ],
  5: [
    [1, 1],
    [1, 3],
    [2, 2],
    [3, 1],
    [3, 3],
  ],
  6: [
    [1, 1],
    [2, 1],
    [3, 1],
    [1, 3],
    [2, 3],
    [3, 3],
  ],
};

/**
 * Flat CSS dice: the fallback renderer. Faces flicker through random values
 * while a CSS animation tumbles them, then land on the result.
 */
export function createDomDiceView(container: HTMLElement, initial: DicePair, rng: Rng): DiceView {
  const dice = [h('div', { class: 'cg-die' }), h('div', { class: 'cg-die' })] as const;
  const root = h('div', { class: 'cg-dom-dice' }, ...dice);
  container.append(root);

  const setFaces = (faces: DicePair) => {
    faces.forEach((face, i) => {
      const die = dice[i]!;
      die.dataset.face = String(face);
      die.replaceChildren(
        ...PIP_CELLS[face].map(([row, column]) =>
          h('span', { class: 'cg-die__pip', style: `grid-area: ${row} / ${column}` }),
        ),
      );
    });
  };

  setFaces(initial);

  return {
    show: setFaces,
    hold(intensity) {
      root.classList.toggle('is-holding', intensity > 0);
    },
    async throw(result: DicePair, options: ThrowOptions) {
      root.classList.remove('is-holding');
      if (options.duration <= 0) {
        setFaces(result);
        return;
      }
      root.style.setProperty('--roll-ms', `${options.duration}ms`);
      root.classList.add(options.travel ? 'is-rolling' : 'is-settling');
      const flicks = options.travel ? Math.max(1, Math.round(options.duration / 110)) : 1;
      for (let i = 0; i < flicks - 1; i++) {
        setFaces([rollDie(rng), rollDie(rng)]);
        await wait(options.duration / flicks);
        if (i % 3 === 0) options.onBounce?.(1 - i / flicks);
      }
      await wait(options.duration / flicks);
      setFaces(result);
      root.classList.remove('is-rolling', 'is-settling');
    },
    destroy() {
      root.remove();
    },
  };
}
