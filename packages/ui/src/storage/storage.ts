/** The slice of the Web Storage API the kit uses; injectable for tests. */
export interface KeyValueBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * localStorage that cannot break the app. Access is wrapped in try/catch
 * (private browsing, disabled storage, quota), reads are validated because
 * stored data is untrusted, and when storage is unavailable an in-memory map
 * keeps the session working.
 */
export interface SafeStorage {
  /** False when values will not survive a reload. */
  readonly persistent: boolean;
  /**
   * Reads a JSON value and passes it through `parse`, which returns undefined
   * for anything malformed. Missing, corrupt or invalid data yields `fallback`.
   */
  read<T>(key: string, parse: (value: unknown) => T | undefined, fallback: T): T;
  /** Writes a JSON value; returns false if it could not be stored. */
  write(key: string, value: unknown): boolean;
  remove(key: string): void;
}

export const STORAGE_NAMESPACE = 'casinogames:v1';

/**
 * @param backend defaults to localStorage when usable; pass null to force
 * the in-memory fallback.
 */
export function createSafeStorage(
  namespace = STORAGE_NAMESPACE,
  backend: KeyValueBackend | null = detectLocalStorage(),
): SafeStorage {
  const store = backend ?? createMemoryBackend();
  const fullKey = (key: string) => `${namespace}:${key}`;

  return {
    persistent: backend !== null,
    read(key, parse, fallback) {
      try {
        const raw = store.getItem(fullKey(key));
        if (raw === null) return fallback;
        return parse(JSON.parse(raw)) ?? fallback;
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try {
        store.setItem(fullKey(key), JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        store.removeItem(fullKey(key));
      } catch {
        // Nothing to clean up if storage is unreachable.
      }
    },
  };
}

/** localStorage if it exists and accepts a write, otherwise null. */
export function detectLocalStorage(): KeyValueBackend | null {
  try {
    const storage = globalThis.localStorage;
    const probe = `${STORAGE_NAMESPACE}:probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function createMemoryBackend(): KeyValueBackend {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}
