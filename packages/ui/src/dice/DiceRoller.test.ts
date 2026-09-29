import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Motion } from '../motion/motion.ts';
import { DiceRoller } from './DiceRoller.ts';

function faces(roller: DiceRoller): string[] {
  return [...roller.element.querySelectorAll<HTMLElement>('.cg-die')].map(
    (die) => die.dataset.face!,
  );
}

function pointer(target: Element, type: string): void {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1 }));
}

async function create(motionLevel: 'full' | 'none' = 'none') {
  const onThrow = vi.fn();
  const motion = new Motion({ reducedMotion: false, root: null });
  motion.turbo = motionLevel === 'none';
  const host = document.createElement('div');
  const roller = await DiceRoller.create({
    host,
    motion,
    onThrow,
    renderer: 'dom',
    initial: [3, 4],
  });
  return { roller, onThrow, host };
}

describe('DiceRoller', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'requestAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the initial dice and starts disarmed', async () => {
    const { roller, host } = await create();
    expect(host.contains(roller.element)).toBe(true);
    expect(faces(roller)).toEqual(['3', '4']);
    expect(roller.armed).toBe(false);
    expect(roller.element.getAttribute('aria-disabled')).toBe('true');
    expect(roller.element.tabIndex).toBe(-1);
  });

  it('throws gently on a tap and disarms until the game re-arms it', async () => {
    const { roller, onThrow } = await create();
    roller.arm();
    expect(roller.element.tabIndex).toBe(0);
    pointer(roller.element, 'pointerdown');
    pointer(roller.element, 'pointerup');
    expect(onThrow).toHaveBeenCalledWith(0.35);
    expect(roller.armed).toBe(false);
    pointer(roller.element, 'pointerdown');
    pointer(roller.element, 'pointerup');
    expect(onThrow).toHaveBeenCalledTimes(1);
  });

  it('throws harder the longer the dice are held', async () => {
    const { roller, onThrow } = await create();
    roller.arm();
    pointer(roller.element, 'pointerdown');
    await vi.advanceTimersByTimeAsync(600);
    expect(roller.element.querySelector('.cg-dom-dice')!.classList.contains('is-holding')).toBe(
      true,
    );
    pointer(roller.element, 'pointerup');
    const power = onThrow.mock.calls[0]![0] as number;
    expect(power).toBeGreaterThan(0.6);
    expect(power).toBeLessThan(0.75);
  });

  it('throws from the keyboard and from requestThrow()', async () => {
    const { roller, onThrow } = await create();
    roller.arm();
    roller.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    roller.arm();
    roller.requestThrow(0.9);
    expect(onThrow.mock.calls).toEqual([[0.6], [0.9]]);
  });

  it('ignores gestures while disarmed', async () => {
    const { roller, onThrow } = await create();
    pointer(roller.element, 'pointerdown');
    pointer(roller.element, 'pointerup');
    roller.requestThrow();
    expect(onThrow).not.toHaveBeenCalled();
  });

  it('lands on the given result instantly in turbo mode', async () => {
    const { roller } = await create('none');
    await roller.roll([6, 1]);
    expect(faces(roller)).toEqual(['6', '1']);
  });

  it('animates to the given result', async () => {
    const { roller } = await create('full');
    let settled = false;
    const rolling = roller.roll([2, 5], { power: 1 }).then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(200);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    await rolling;
    expect(faces(roller)).toEqual(['2', '5']);
  });

  it('removes itself on destroy', async () => {
    const { roller, host } = await create();
    roller.destroy();
    expect(host.childElementCount).toBe(0);
  });
});
