import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STORAGE_NAMESPACE,
  createMemoryBackend,
  createSafeStorage,
  detectLocalStorage,
  discardStaleVersions,
  type EnumerableBackend,
  type KeyValueBackend,
} from './storage.ts';

const isNumber = (value: unknown) => (typeof value === 'number' ? value : undefined);

describe('createSafeStorage', () => {
  it('round-trips namespaced JSON values', () => {
    const backend = createMemoryBackend();
    const storage = createSafeStorage('test', backend);
    expect(storage.write('answer', 42)).toBe(true);
    expect(backend.getItem('test:answer')).toBe('42');
    expect(storage.read('answer', isNumber, 0)).toBe(42);
    storage.remove('answer');
    expect(storage.read('answer', isNumber, 7)).toBe(7);
  });

  it('falls back on missing, corrupt or invalid data', () => {
    const backend = createMemoryBackend();
    const storage = createSafeStorage('test', backend);
    backend.setItem('test:corrupt', '{not json');
    backend.setItem('test:wrong', '"a string"');
    expect(storage.read('missing', isNumber, 1)).toBe(1);
    expect(storage.read('corrupt', isNumber, 2)).toBe(2);
    expect(storage.read('wrong', isNumber, 3)).toBe(3);
  });

  it('survives a backend that throws on every call', () => {
    const hostile: KeyValueBackend = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const storage = createSafeStorage('test', hostile);
    expect(storage.read('x', isNumber, 5)).toBe(5);
    expect(storage.write('x', 1)).toBe(false);
    expect(() => {
      storage.remove('x');
    }).not.toThrow();
  });

  it('tells a watcher when another tab changes its key, until it unsubscribes', () => {
    const storage = createSafeStorage('test', createMemoryBackend());
    const listener = vi.fn();
    const stop = storage.watch('meter', listener);
    window.dispatchEvent(new StorageEvent('storage', { key: 'test:other' }));
    expect(listener).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent('storage', { key: 'test:meter' }));
    window.dispatchEvent(new StorageEvent('storage', { key: null })); // the other tab cleared it all
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    window.dispatchEvent(new StorageEvent('storage', { key: 'test:meter' }));
    expect(listener).toHaveBeenCalledTimes(2);
    // Storage kept in memory is this tab's alone: nothing to watch.
    const memory = createSafeStorage('test', null);
    const unheard = vi.fn();
    memory.watch('meter', unheard);
    window.dispatchEvent(new StorageEvent('storage', { key: 'test:meter' }));
    expect(unheard).not.toHaveBeenCalled();
  });

  it('keeps working in memory when there is no storage at all', () => {
    const storage = createSafeStorage('test', null);
    expect(storage.persistent).toBe(false);
    storage.write('x', 9);
    expect(storage.read('x', isNumber, 0)).toBe(9);
  });
});

describe('discardStaleVersions', () => {
  it('drops every key of another schema version, and nothing else', () => {
    const backend = createMemoryBackend();
    const keep = [
      'casinogames:v2:bankroll',
      'casinogames:v2:rtp:mirror',
      'other:v1:x',
      'casinogames:version',
    ];
    for (const key of [
      ...keep,
      'casinogames:v1:bankroll',
      'casinogames:v1:rtp:old-id',
      'casinogames:v3:x',
    ]) {
      backend.setItem(key, '1');
    }
    expect(discardStaleVersions(backend, 'casinogames:v2')).toBe(3);
    expect(Array.from({ length: backend.length }, (_, index) => backend.key(index)).sort()).toEqual(
      [...keep].sort(),
    );
    expect(discardStaleVersions(backend, 'casinogames:v2')).toBe(0);
  });

  it("is the kit's current namespace by default, at version 2", () => {
    expect(STORAGE_NAMESPACE).toBe('casinogames:v2');
    const backend = createMemoryBackend();
    backend.setItem('casinogames:v1:settings', '{}');
    backend.setItem('casinogames:v2:settings', '{}');
    expect(discardStaleVersions(backend)).toBe(1);
    expect(backend.getItem('casinogames:v2:settings')).toBe('{}');
  });

  it('leaves unversioned namespaces, missing storage and failing storage alone', () => {
    const backend = createMemoryBackend();
    backend.setItem('test:v1:x', '1');
    expect(discardStaleVersions(backend, 'test')).toBe(0);
    expect(discardStaleVersions(null)).toBe(0);
    const hostile: EnumerableBackend = {
      get length(): number {
        throw new Error('SecurityError');
      },
      key: () => null,
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(discardStaleVersions(hostile)).toBe(0);
  });
});

describe('detectLocalStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('finds a working localStorage', () => {
    expect(detectLocalStorage()).toBe(globalThis.localStorage);
  });

  it('returns null when access throws', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('disabled');
      },
    });
    expect(detectLocalStorage()).toBeNull();
  });
});
