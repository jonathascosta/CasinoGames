import { describe, expect, it } from 'vitest';
import { Motion } from '../motion/motion.ts';
import { createMemoryBackend, createSafeStorage } from '../storage/storage.ts';
import { Bankroll } from './bankroll.ts';
import { BankrollDisplay } from './BankrollDisplay.ts';

function setup(initial = 10_000) {
  const bankroll = new Bankroll({
    storage: createSafeStorage('t', createMemoryBackend()),
    initial,
  });
  const motion = new Motion({ reducedMotion: false, root: null });
  motion.turbo = true; // instant tweens
  const display = new BankrollDisplay({ bankroll, motion, topUpBelow: 50 });
  const text = (selector: string) => display.element.querySelector(selector)!.textContent;
  return { bankroll, display, text };
}

describe('BankrollDisplay', () => {
  it('shows the balance and follows changes with a signed delta', () => {
    const { bankroll, display, text } = setup();
    expect(text('.cg-bankroll__value')).toBe('100.00');
    bankroll.credit(2_550);
    expect(text('.cg-bankroll__value')).toBe('125.50');
    expect(text('.cg-bankroll__delta')).toBe('+25.50');
    expect(display.element.dataset.trend).toBe('up');
    bankroll.debit(550);
    expect(text('.cg-bankroll__delta')).toBe('−5.50');
    expect(display.element.dataset.trend).toBe('down');
  });

  it('offers a top-up below the threshold', () => {
    const { bankroll, display } = setup(100);
    const topUp = display.element.querySelector<HTMLButtonElement>('.cg-bankroll__top-up')!;
    expect(topUp.hidden).toBe(true);
    bankroll.debit(80);
    expect(topUp.hidden).toBe(false);
    topUp.click();
    expect(bankroll.balance).toBe(100);
    expect(topUp.hidden).toBe(true);
  });

  it('stops listening once destroyed', () => {
    const { bankroll, display, text } = setup();
    display.destroy();
    bankroll.credit(100);
    expect(text('.cg-bankroll__value')).toBe('100.00');
  });
});
