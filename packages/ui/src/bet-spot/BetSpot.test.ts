import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BetSpot, type BetSpotOptions } from './BetSpot.ts';

function pointer(target: Element, type: string, init: PointerEventInit = {}): void {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, button: 0, clientX: 10, clientY: 10, ...init }),
  );
}

function tap(spot: BetSpot): void {
  pointer(spot.element, 'pointerdown');
  pointer(spot.element, 'pointerup');
}

function create(overrides: Partial<BetSpotOptions> = {}): BetSpot {
  return new BetSpot({
    id: 'main',
    label: 'Main',
    max: 10_000,
    chipValue: () => 500,
    ...overrides,
  });
}

describe('BetSpot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds the selected chip on tap and stacks chips', () => {
    const onChange = vi.fn();
    const spot = create({ onChange });
    tap(spot);
    tap(spot);
    expect(spot.amount).toBe(1_000);
    expect(onChange).toHaveBeenLastCalledWith(1_000);
    expect(spot.element.querySelectorAll('.cg-chip')).toHaveLength(2);
    expect(spot.element.dataset.state).toBe('filled');
    expect(spot.element.getAttribute('aria-label')).toContain('Main: 10.00');
  });

  it('adds on keyboard activation (a click with detail 0) but ignores pointer clicks', () => {
    const spot = create();
    spot.element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    spot.element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(spot.amount).toBe(500);
  });

  it('clears on long press without adding a chip', () => {
    const spot = create();
    spot.setAmount(2_000);
    pointer(spot.element, 'pointerdown');
    expect(spot.element.classList.contains('is-pressing')).toBe(true);
    vi.advanceTimersByTime(600);
    pointer(spot.element, 'pointerup');
    expect(spot.amount).toBe(0);
  });

  it('treats a drag as neither tap nor long press', () => {
    const spot = create();
    pointer(spot.element, 'pointerdown');
    pointer(spot.element, 'pointermove', { clientX: 40 });
    vi.advanceTimersByTime(600);
    pointer(spot.element, 'pointerup');
    expect(spot.amount).toBe(0);
  });

  it('clears with Delete, Backspace and right-click', () => {
    const spot = create();
    for (const clear of [
      () => spot.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' })),
      () => spot.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' })),
      () => spot.element.dispatchEvent(new MouseEvent('contextmenu', { cancelable: true })),
    ]) {
      spot.setAmount(500);
      clear();
      expect(spot.amount).toBe(0);
    }
  });

  it('refuses stakes above the maximum or the bankroll', () => {
    const onReject = vi.fn();
    let funds = true;
    const spot = create({ max: 800, onReject, canAdd: () => funds });
    expect(spot.add(500)).toBe(true);
    expect(spot.add(500)).toBe(false);
    expect(onReject).toHaveBeenLastCalledWith('max');
    expect(spot.element.classList.contains('is-rejected')).toBe(true);
    funds = false;
    expect(spot.add(100)).toBe(false);
    expect(onReject).toHaveBeenLastCalledWith('funds');
    expect(spot.amount).toBe(500);
  });

  it('ignores input while locked', () => {
    const onReject = vi.fn();
    const spot = create({ onReject });
    spot.setAmount(500);
    spot.setLocked(true);
    tap(spot);
    spot.clear();
    expect(spot.amount).toBe(500);
    expect(spot.element.getAttribute('aria-disabled')).toBe('true');
    expect(onReject).not.toHaveBeenCalled();
    expect(spot.add(500)).toBe(false);
    expect(onReject).toHaveBeenCalledWith('locked');
  });

  it('shows the settled result', () => {
    const spot = create();
    spot.setAmount(1_000);
    spot.setResult({ outcome: 'win', net: 1_500 });
    expect(spot.element.dataset.result).toBe('win');
    expect(spot.element.querySelector<HTMLElement>('.cg-bet-spot__result')!.dataset.value).toBe(
      '+15.00',
    );
    expect(spot.element.getAttribute('aria-label')).toContain(': 10.00, win +15.00.');
    spot.setResult(null);
    expect(spot.element.dataset.result).toBeUndefined();
  });

  it('caps the visible stack', () => {
    const spot = create();
    spot.setAmount(10_000 - 50); // 25+25+25+5×4+1×4+0.5 = 12 chips
    expect(spot.element.querySelectorAll('.cg-chip')).toHaveLength(7);
  });
});
