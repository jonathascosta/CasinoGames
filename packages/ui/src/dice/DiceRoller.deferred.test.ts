import type { DicePair } from '@casinogames/engine';
import { describe, expect, it, vi } from 'vitest';
import { Motion } from '../motion/motion.ts';
import { createPixiDiceView } from '../pixi/dice-view.ts';
import type { DiceView } from './dice-view.ts';
import { DiceRoller, type DiceRenderer } from './DiceRoller.ts';

/** What each stand-in PixiJS view was asked to do. */
interface FakeView {
  readonly stage: HTMLElement;
  readonly shown: DicePair[];
  readonly thrown: DicePair[];
  destroyed: boolean;
}

const views = vi.hoisted((): FakeView[] => []);

vi.mock('../pixi/dice-view.ts', () => ({
  createPixiDiceView: vi.fn((stage: HTMLElement, initial: DicePair): Promise<DiceView> => {
    const record: FakeView = { stage, shown: [initial], thrown: [], destroyed: false };
    views.push(record);
    stage.append(Object.assign(document.createElement('canvas'), { className: 'fake-pixi' }));
    return Promise.resolve({
      show: (dice) => void record.shown.push(dice),
      hold: () => undefined,
      throw: (dice) => {
        record.thrown.push(dice);
        return Promise.resolve();
      },
      spots: () => [
        { x: 20, y: 20, size: 30 },
        { x: 60, y: 20, size: 30 },
      ],
      onLayout: () => () => undefined,
      destroy: () => {
        record.destroyed = true;
        stage.replaceChildren();
      },
    });
  }),
}));

async function create(renderer: DiceRenderer) {
  views.length = 0;
  vi.mocked(createPixiDiceView).mockClear();
  const motion = new Motion({ reducedMotion: false, root: null });
  motion.turbo = true;
  const host = document.createElement('div');
  const roller = await DiceRoller.create({ host, motion, renderer, initial: [3, 4] });
  const stages = () => [...roller.element.querySelectorAll<HTMLElement>('.cg-dice-tray__stage')];
  const cssDice = () => roller.element.querySelectorAll('.cg-dom-dice').length;
  return { roller, stages, cssDice };
}

describe('DiceRoller renderers', () => {
  it("'deferred' opens on the CSS dice without loading PixiJS", async () => {
    const { stages, cssDice } = await create('deferred');
    expect(cssDice()).toBe(1);
    expect(stages()).toHaveLength(1);
    expect(createPixiDiceView).not.toHaveBeenCalled();
  });

  it('enhance() prepares the PixiJS dice out of sight; they take over at the next throw', async () => {
    const { roller, stages, cssDice } = await create('deferred');
    roller.show([6, 1]);
    await roller.enhance();
    expect(views).toHaveLength(1);
    const view = views[0]!;
    // Beside the CSS dice, hidden, until the throw.
    expect(stages()).toEqual([expect.any(HTMLElement), view.stage]);
    expect(view.stage.classList.contains('is-pending')).toBe(true);
    expect(cssDice()).toBe(1);

    await roller.roll([2, 5]);
    expect(stages()).toEqual([view.stage]);
    expect(view.stage.classList.contains('is-pending')).toBe(false);
    expect(cssDice()).toBe(0);
    // It took over from the faces showing, then threw.
    expect(view.shown.at(-1)).toEqual([6, 1]);
    expect(view.thrown).toEqual([[2, 5]]);

    // Called again, it loads nothing more.
    await roller.enhance();
    expect(createPixiDiceView).toHaveBeenCalledTimes(1);
  });

  it('keeps the CSS dice through a throw that keeps a die', async () => {
    const { roller, cssDice } = await create('deferred');
    await roller.enhance();
    await roller.roll([2, 5], { keep: [true, false] });
    expect(cssDice()).toBe(1);
    expect(views[0]!.thrown).toEqual([]);
    await roller.roll([2, 2]);
    expect(cssDice()).toBe(0);
    expect(views[0]!.shown.at(-1)).toEqual([2, 5]);
    expect(views[0]!.thrown).toEqual([[2, 2]]);
  });

  it('stays on the CSS dice when PixiJS cannot start', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { roller, stages, cssDice } = await create('deferred');
    vi.mocked(createPixiDiceView).mockRejectedValueOnce(new Error('no WebGL'));
    await roller.enhance();
    await roller.roll([1, 1]);
    expect(stages()).toHaveLength(1);
    expect(cssDice()).toBe(1);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('drops PixiJS dice that finish loading after the roller is gone', async () => {
    const { roller } = await create('deferred');
    const loading = roller.enhance();
    roller.destroy();
    await loading;
    expect(views[0]!.destroyed).toBe(true);
    expect(views[0]!.stage.isConnected).toBe(false);
  });

  it("'auto' draws PixiJS dice from the start, and 'dom' never loads them", async () => {
    const auto = await create('auto');
    expect(auto.cssDice()).toBe(0);
    expect(createPixiDiceView).toHaveBeenCalledOnce();
    await auto.roller.enhance();
    expect(createPixiDiceView).toHaveBeenCalledOnce();

    const dom = await create('dom');
    await dom.roller.enhance();
    await dom.roller.roll([4, 4]);
    expect(dom.cssDice()).toBe(1);
    expect(createPixiDiceView).not.toHaveBeenCalled();
  });
});
