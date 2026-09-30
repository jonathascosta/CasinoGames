import { rollDie, type DicePair, type DieFace, type Rng } from '@casinogames/engine';
import { h } from '../dom/h.ts';
import { wait } from '../motion/motion.ts';
import type { DiceView, DieSpot, ThrowOptions } from './dice-view.ts';

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
 * while a CSS animation tumbles them, then land on the result. A die kept
 * out of a throw (a locked die) neither flickers nor moves.
 */
export function createDomDiceView(container: HTMLElement, initial: DicePair, rng: Rng): DiceView {
  const dice = [h('div', { class: 'cg-die' }), h('div', { class: 'cg-die' })] as const;
  const root = h('div', { class: 'cg-dom-dice' }, ...dice);
  container.append(root);
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  // The dice are laid out by CSS: they move when the tray is resized.
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(notify);
  resize?.observe(root);

  const setFaces = (next: DicePair, keep: readonly [boolean, boolean] = [false, false]) => {
    next.forEach((face, i) => {
      if (keep[i] === true) return;
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
    show(next) {
      setFaces(next);
      notify();
    },
    hold(intensity) {
      root.classList.toggle('is-holding', intensity > 0);
    },
    async throw(result: DicePair, options: ThrowOptions) {
      root.classList.remove('is-holding');
      const keep = options.keep ?? [false, false];
      if (options.duration <= 0) {
        setFaces(result, keep);
        notify();
        return;
      }
      dice.forEach((die, i) => die.classList.toggle('is-kept', keep[i] === true));
      root.style.setProperty('--roll-ms', `${options.duration}ms`);
      root.classList.add(options.travel ? 'is-rolling' : 'is-settling');
      const flicks = options.travel ? Math.max(1, Math.round(options.duration / 110)) : 1;
      for (let i = 0; i < flicks - 1; i++) {
        setFaces([rollDie(rng), rollDie(rng)], keep);
        await wait(options.duration / flicks);
        if (i % 3 === 0) options.onBounce?.(1 - i / flicks);
      }
      await wait(options.duration / flicks);
      setFaces(result, keep);
      root.classList.remove('is-rolling', 'is-settling');
      for (const die of dice) die.classList.remove('is-kept');
      notify();
    },
    spots() {
      const spot = (die: HTMLElement): DieSpot => ({
        x: die.offsetLeft + die.offsetWidth / 2,
        y: die.offsetTop + die.offsetHeight / 2,
        size: die.offsetWidth,
      });
      return [spot(dice[0]), spot(dice[1])];
    },
    onLayout(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      resize?.disconnect();
      listeners.clear();
      root.remove();
    },
  };
}
