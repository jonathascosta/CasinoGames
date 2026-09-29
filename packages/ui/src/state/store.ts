export type Listener<T> = (value: T, previous: T) => void;

/** A minimal observable value: the only state primitive the kit needs. */
export interface Store<T> {
  get(): T;
  set(value: T): void;
  update(change: (value: T) => T): void;
  /** Calls `listener` on every change; returns the unsubscribe function. */
  subscribe(listener: Listener<T>): () => void;
}

export function createStore<T>(initial: T, equals: (a: T, b: T) => boolean = Object.is): Store<T> {
  let value = initial;
  const listeners = new Set<Listener<T>>();
  const store: Store<T> = {
    get: () => value,
    set(next) {
      if (equals(value, next)) return;
      const previous = value;
      value = next;
      for (const listener of [...listeners]) listener(value, previous);
    },
    update(change) {
      store.set(change(value));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return store;
}
