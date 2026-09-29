import { describe, expect, it, vi } from 'vitest';
import { createMemoryBackend, createSafeStorage } from '../storage/storage.ts';
import { Bankroll } from './bankroll.ts';

function storage(backend = createMemoryBackend()) {
  return createSafeStorage('t', backend);
}

describe('Bankroll', () => {
  it('starts at the initial balance and persists every change', () => {
    const backend = createMemoryBackend();
    const bankroll = new Bankroll({ storage: storage(backend), initial: 10_000 });
    expect(bankroll.balance).toBe(10_000);
    bankroll.debit(2_500);
    bankroll.credit(5_000);
    expect(bankroll.balance).toBe(12_500);
    expect(new Bankroll({ storage: storage(backend), initial: 10_000 }).balance).toBe(12_500);
  });

  it('refuses to go negative or accept fractional cents', () => {
    const bankroll = new Bankroll({ storage: storage(), initial: 100 });
    expect(bankroll.canAfford(100)).toBe(true);
    expect(bankroll.canAfford(101)).toBe(false);
    expect(() => bankroll.debit(101)).toThrow(RangeError);
    expect(() => bankroll.credit(0.5)).toThrow(RangeError);
    expect(() => bankroll.debit(-1)).toThrow(RangeError);
    expect(bankroll.balance).toBe(100);
  });

  it('resets to the initial balance and notifies subscribers', () => {
    const bankroll = new Bankroll({ storage: storage(), initial: 1_000 });
    const listener = vi.fn();
    bankroll.subscribe(listener);
    bankroll.debit(1_000);
    bankroll.reset();
    expect(listener.mock.calls).toEqual([
      [0, 1_000],
      [1_000, 0],
    ]);
  });

  it('ignores a tampered stored balance', () => {
    const backend = createMemoryBackend();
    backend.setItem('t:bankroll', '-500');
    expect(new Bankroll({ storage: storage(backend) }).balance).toBe(1_000_00);
    backend.setItem('t:bankroll', '12.34');
    expect(new Bankroll({ storage: storage(backend) }).balance).toBe(1_000_00);
  });
});
