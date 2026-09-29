import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryBackend,
  createSafeStorage,
  detectLocalStorage,
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

  it('keeps working in memory when there is no storage at all', () => {
    const storage = createSafeStorage('test', null);
    expect(storage.persistent).toBe(false);
    storage.write('x', 9);
    expect(storage.read('x', isNumber, 0)).toBe(9);
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
