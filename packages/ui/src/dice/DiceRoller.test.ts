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

  it('announces the result outside the button, whose children are hidden from screen readers', async () => {
    const { roller, host } = await create('none');
    const live = host.querySelector('[aria-live]')!;
    expect(roller.element.contains(live)).toBe(false);
    expect(live.textContent).toBe('');
    await roller.roll([6, 1]);
    expect(live.textContent).toBe('Rolled 6 and 1');
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

  it('re-rolls one die while the other stays where it lies', async () => {
    const { roller, host } = await create('full');
    const first = roller.roll([2, 5], { power: 0.5 });
    await vi.runAllTimersAsync();
    await first;
    const dice = [...roller.element.querySelectorAll<HTMLElement>('.cg-die')];
    const kept = dice[1]!.innerHTML;
    const rolling = roller.roll([6, 5], { keep: [false, true] });
    await vi.advanceTimersByTimeAsync(200);
    // While the first die tumbles through faces, the second is locked and still.
    expect(dice[1]!.classList.contains('is-kept')).toBe(true);
    expect(dice[1]!.innerHTML).toBe(kept);
    await vi.runAllTimersAsync();
    await rolling;
    expect(faces(roller)).toEqual(['6', '5']);
    expect(dice[1]!.classList.contains('is-kept')).toBe(false);
    expect(host.querySelector('[aria-live]')!.textContent).toBe('Kept the 5, rolled 6');
  });

  it('offers each die as a button, and marks the held die with a padlock', async () => {
    const { roller, host } = await create();
    const onPick = vi.fn();
    roller.offerDice({ onPick, label: (index) => `Lock die ${String(index + 1)}` });
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('.cg-die-pick')];
    // Beside the tray, which is itself a button, not inside it.
    expect(buttons).toHaveLength(2);
    expect(roller.element.contains(buttons[0]!)).toBe(false);
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Lock die 1',
      'Lock die 2',
    ]);
    // A tap target of at least 48 px, even over small dice.
    expect(parseFloat(buttons[0]!.style.width)).toBeGreaterThanOrEqual(48);
    buttons[1]!.click();
    expect(onPick).toHaveBeenCalledWith(1);
    roller.setHeld([false, true]);
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    expect(buttons[1]!.classList.contains('is-held')).toBe(true);
    expect(buttons[1]!.querySelector('.cg-icon--lock')).not.toBeNull();
    roller.withdrawDice();
    expect(host.querySelector('.cg-die-picks')).toBeNull();
    roller.setHeld([true, true]); // nothing to mark: no error
  });

  it('removes itself on destroy', async () => {
    const { roller, host } = await create();
    roller.offerDice({ onPick: vi.fn(), label: () => 'Lock' });
    roller.destroy();
    expect(host.childElementCount).toBe(0);
  });
});
