import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store.ts';

describe('createStore', () => {
  it('notifies subscribers with the new and previous value', () => {
    const store = createStore(1);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set(2);
    store.update((n) => n * 10);
    expect(listener.mock.calls).toEqual([
      [2, 1],
      [20, 2],
    ]);
    unsubscribe();
    store.set(3);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.get()).toBe(3);
  });

  it('skips notifications when the value is equal', () => {
    const store = createStore({ a: 1 }, (x, y) => x.a === y.a);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ a: 1 });
    expect(listener).not.toHaveBeenCalled();
  });
});
