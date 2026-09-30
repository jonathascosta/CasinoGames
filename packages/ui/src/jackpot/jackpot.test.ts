import { ProgressiveJackpot } from '@casinogames/engine';
import { describe, expect, it } from 'vitest';
import { Motion } from '../motion/motion.ts';
import { createStore } from '../state/store.ts';
import { createMemoryBackend, createSafeStorage } from '../storage/storage.ts';
import { ProgressiveMeter } from './ProgressiveMeter.ts';
import {
  jackpotKey,
  parseJackpotState,
  readJackpotState,
  storedMeterAmount,
  writeJackpotState,
} from './jackpot-storage.ts';

const OPTIONS = { id: 'house', seed: 500_000, contributionRate: 0.1 };

describe('jackpot storage', () => {
  it('stores a meter state and reads it back exactly', () => {
    const storage = createSafeStorage('test', createMemoryBackend());
    const jackpot = new ProgressiveJackpot(OPTIONS);
    jackpot.contribute(1_235); // 123.5¢
    jackpot.award(0.5);
    writeJackpotState(storage, 'house', jackpot.state());
    const read = readJackpotState(storage, 'house');
    expect(read).toEqual(jackpot.state());
    expect(new ProgressiveJackpot(OPTIONS, read).snapshot()).toEqual(jackpot.snapshot());
    expect(jackpotKey('house')).toBe('jackpot:house');
  });

  it.each<[string, unknown]>([
    ['not an object', 'meter'],
    ['a negative pool', { ...new ProgressiveJackpot(OPTIONS).state(), pool: -1 }],
    ['a fractional count', { ...new ProgressiveJackpot(OPTIONS).state(), hits: 0.5 }],
    [
      'millionths of a whole cent',
      { ...new ProgressiveJackpot(OPTIONS).state(), contributed: { cents: 0, micros: 1_000_000 } },
    ],
    ['a missing total', { pool: 1, hits: 0, awarded: 0, contributed: { cents: 0, micros: 0 } }],
  ])('treats a stored state with %s as absent', (_, value) => {
    expect(parseJackpotState(value)).toBeUndefined();
  });

  it('shows the stored meter, or the seed when nothing usable is stored', () => {
    const storage = createSafeStorage('test', createMemoryBackend());
    expect(storedMeterAmount(storage, 'house', 500_000)).toBe(500_000);
    const jackpot = new ProgressiveJackpot(OPTIONS);
    jackpot.contribute(2_500);
    writeJackpotState(storage, 'house', jackpot.state());
    expect(storedMeterAmount(storage, 'house', 500_000)).toBe(500_250);
    // A seed raised since the state was stored.
    expect(storedMeterAmount(storage, 'house', 600_000)).toBe(600_000);
    storage.write(jackpotKey('house'), { pool: 'lots' });
    expect(storedMeterAmount(storage, 'house', 500_000)).toBe(500_000);
  });
});

describe('ProgressiveMeter', () => {
  const setup = () => {
    const store = createStore(500_000);
    const motion = new Motion({ reducedMotion: false, root: null });
    motion.turbo = true; // instant count-ups
    const meter = new ProgressiveMeter({
      store,
      label: 'House progressive',
      caption: 'fed by 10%',
      motion,
    });
    const text = (selector: string) => meter.element.querySelector(selector)!.textContent;
    return { store, meter, text };
  };

  it('shows the amount with its label and caption, and names itself for screen readers', () => {
    const { meter, text } = setup();
    expect(text('.cg-meter__value')).toBe('5,000.00');
    expect(text('.cg-meter__label')).toBe('House progressive');
    expect(text('.cg-meter__caption')).toBe('fed by 10%');
    expect(meter.element.getAttribute('aria-label')).toBe('House progressive: 5,000.00');
  });

  it('counts up as stakes feed it and flashes when a hit pays from it', () => {
    const { store, meter, text } = setup();
    store.set(500_250);
    expect(text('.cg-meter__value')).toBe('5,002.50');
    expect(meter.element.dataset.trend).toBe('up');
    expect(meter.element.classList.contains('is-paid')).toBe(false);
    store.set(500_000);
    expect(meter.element.dataset.trend).toBe('paid');
    expect(meter.element.classList.contains('is-paid')).toBe(true);
    expect(meter.element.getAttribute('aria-label')).toBe('House progressive: 5,000.00');
  });

  it('stops following the store once destroyed', () => {
    const { store, meter, text } = setup();
    meter.destroy();
    store.set(600_000);
    expect(text('.cg-meter__value')).toBe('5,000.00');
    expect(meter.element.isConnected).toBe(false);
  });
});
