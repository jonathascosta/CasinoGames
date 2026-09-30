import { parseCardCode, type Card } from '@casinogames/engine';
import { describe, expect, it, vi } from 'vitest';
import { Motion } from '../motion/motion.ts';
import { createPixiCardView } from '../pixi/card-view.ts';
import type { CardView, ShoeDisplay } from './card-view.ts';
import { CardDealer, type CardRenderer } from './CardDealer.ts';

/** What each stand-in PixiJS view was asked to do. */
interface FakeView {
  readonly stage: HTMLElement;
  readonly shoe: ShoeDisplay[];
  readonly dealt: (Card | null)[];
  destroyed: boolean;
}

const views = vi.hoisted((): FakeView[] => []);

vi.mock('../pixi/card-view.ts', () => ({
  createPixiCardView: vi.fn((stage: HTMLElement): Promise<CardView> => {
    const record: FakeView = { stage, shoe: [], dealt: [], destroyed: false };
    views.push(record);
    stage.append(Object.assign(document.createElement('canvas'), { className: 'fake-pixi' }));
    return Promise.resolve({
      deal: (card) => {
        record.dealt.push(card);
        return Promise.resolve();
      },
      reveal: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      shuffle: () => Promise.resolve(),
      setShoe: (shoe) => void record.shoe.push(shoe),
      destroy: () => {
        record.destroyed = true;
        stage.replaceChildren();
      },
    });
  }),
}));

async function create(renderer: CardRenderer) {
  views.length = 0;
  vi.mocked(createPixiCardView).mockClear();
  const motion = new Motion({ reducedMotion: false, root: null });
  motion.turbo = true;
  const host = document.createElement('div');
  const dealer = await CardDealer.create({
    host,
    motion,
    renderer,
    hands: [{ id: 'dealer', label: 'Dealer', x: 0.5, y: 0.4 }],
  });
  const stages = () => [...dealer.element.querySelectorAll<HTMLElement>('.cg-card-table__stage')];
  const domCards = () => dealer.element.querySelectorAll('.cg-dom-card').length;
  return { dealer, stages, domCards };
}

describe('CardDealer renderers', () => {
  it("'deferred' opens on DOM cards without loading PixiJS", async () => {
    const { dealer, stages, domCards } = await create('deferred');
    await dealer.deal(parseCardCode('AS'), 'dealer');
    expect(domCards()).toBe(1);
    expect(stages()).toHaveLength(1);
    expect(createPixiCardView).not.toHaveBeenCalled();
  });

  it('enhance() prepares the PixiJS cards out of sight; they take over once the table is cleared', async () => {
    const { dealer, stages, domCards } = await create('deferred');
    dealer.setShoe(300, 312, true);
    await dealer.deal(parseCardCode('AS'), 'dealer');
    await dealer.enhance();
    const view = views[0]!;
    expect(stages()).toEqual([expect.any(HTMLElement), view.stage]);
    expect(view.stage.classList.contains('is-pending')).toBe(true);

    // Cards on the table: the DOM cards stay.
    await dealer.deal(parseCardCode('KH'), 'dealer');
    expect(domCards()).toBe(2);
    expect(view.dealt).toEqual([]);

    await dealer.clear();
    expect(stages()).toEqual([view.stage]);
    expect(view.stage.classList.contains('is-pending')).toBe(false);
    expect(domCards()).toBe(0);
    // It took over the shoe display, and deals from here on.
    expect(view.shoe).toEqual([{ remaining: 300, size: 312, cutCardOut: true }]);
    await dealer.deal(null, 'dealer', { faceUp: false });
    expect(view.dealt).toEqual([null]);
    expect(dealer.count('dealer')).toBe(1);
  });

  it('drops PixiJS cards that finish loading after the dealer is gone', async () => {
    const { dealer } = await create('deferred');
    const loading = dealer.enhance();
    dealer.destroy();
    await loading;
    expect(views[0]!.destroyed).toBe(true);
    expect(views[0]!.stage.isConnected).toBe(false);
  });

  it("'auto' draws PixiJS cards from the start, and 'dom' never loads them", async () => {
    const auto = await create('auto');
    await auto.dealer.enhance();
    expect(createPixiCardView).toHaveBeenCalledOnce();

    const dom = await create('dom');
    await dom.dealer.enhance();
    await dom.dealer.clear();
    expect(createPixiCardView).not.toHaveBeenCalled();
    expect(dom.stages()).toHaveLength(1);
  });
});
