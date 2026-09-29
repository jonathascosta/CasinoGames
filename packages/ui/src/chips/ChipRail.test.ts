import { describe, expect, it, vi } from 'vitest';
import { ChipRail } from './ChipRail.ts';
import { breakIntoChips, chipTone } from './chips.ts';

function buttons(rail: ChipRail): HTMLButtonElement[] {
  return [...rail.element.querySelectorAll('button')];
}

function press(rail: ChipRail, key: string): void {
  rail.element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('ChipRail', () => {
  it('renders the chips as a radio group with one tab stop', () => {
    const rail = new ChipRail({ value: 500 });
    expect(rail.element.getAttribute('role')).toBe('radiogroup');
    expect(buttons(rail).map((b) => b.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
      'false',
      'false',
    ]);
    expect(buttons(rail).map((b) => b.tabIndex)).toEqual([-1, -1, 0, -1, -1]);
    expect(buttons(rail)[0]!.getAttribute('aria-label')).toBe('0.50 chip');
  });

  it('selects on click and reports changes', () => {
    const onChange = vi.fn();
    const rail = new ChipRail({ onChange });
    buttons(rail)[3]!.click();
    expect(rail.value).toBe(2_500);
    buttons(rail)[3]!.click();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('moves the selection with arrow keys, Home and End', () => {
    const rail = new ChipRail({ value: 100 });
    press(rail, 'ArrowRight');
    expect(rail.value).toBe(500);
    press(rail, 'ArrowLeft');
    press(rail, 'ArrowLeft');
    press(rail, 'ArrowLeft');
    expect(rail.value).toBe(50);
    press(rail, 'End');
    expect(rail.value).toBe(10_000);
    press(rail, 'Home');
    expect(rail.value).toBe(50);
  });

  it('disables chips above the balance and steps the selection down', () => {
    const onChange = vi.fn();
    const rail = new ChipRail({ value: 10_000, onChange });
    rail.setBalance(3_000);
    expect(buttons(rail).map((b) => b.disabled)).toEqual([false, false, false, false, true]);
    expect(rail.value).toBe(2_500);
    expect(onChange).toHaveBeenCalledWith(2_500);
    rail.select(10_000);
    expect(rail.value).toBe(2_500);
    press(rail, 'End');
    expect(rail.value).toBe(2_500);
  });
});

describe('chip helpers', () => {
  it('breaks an amount into chips, largest first', () => {
    expect(breakIntoChips(1_750)).toEqual([500, 500, 500, 100, 100, 50]);
    expect(breakIntoChips(30)).toEqual([]);
    expect(breakIntoChips(12_550)).toEqual([10_000, 2_500, 50]);
  });

  it('picks the colour of the largest chip not above the value', () => {
    expect(chipTone(50)).toBe('50');
    expect(chipTone(700)).toBe('500');
    expect(chipTone(1_000_000)).toBe('10000');
    expect(chipTone(10)).toBe('50');
  });
});
