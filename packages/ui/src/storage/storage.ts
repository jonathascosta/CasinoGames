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

/**
 * Every key the kit stores lives under this namespace. Its version is the
 * storage schema: bump it when stored data stops meaning what it did (v2: the
 * games and bets took their English ids), and discardStaleVersions() drops
 * what older versions left behind. Nothing is migrated.
 */
export const STORAGE_NAMESPACE = 'casinogames:v2';

/** A backend whose keys can be listed, as localStorage's can. */
export interface EnumerableBackend extends KeyValueBackend {
  readonly length: number;
  key(index: number): string | null;
}

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

/**
 * Removes every key stored under another version of `namespace`
 * (`<app>:v<n>:…`), so data written for an older schema is dropped cleanly
 * instead of being read with the wrong meaning. Keys of other apps and of the
 * current version stay. Returns how many keys went; storage that cannot be
 * listed or written is left as it is.
 */
export function discardStaleVersions(
  backend: EnumerableBackend | null,
  namespace = STORAGE_NAMESPACE,
): number {
  const versioned = /^(.+):v\d+$/.exec(namespace);
  if (backend === null || versioned === null) return 0;
  const stale = new RegExp(`^${escapeRegExp(versioned[1]!)}:v\\d+:`);
  const current = `${namespace}:`;
  try {
    const keys: string[] = [];
    for (let index = 0; index < backend.length; index++) {
      const key = backend.key(index);
      if (key !== null && stale.test(key) && !key.startsWith(current)) keys.push(key);
    }
    for (const key of keys) backend.removeItem(key);
    return keys.length;
  } catch {
    return 0;
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** localStorage if it exists and accepts a write, otherwise null. */
export function detectLocalStorage(): EnumerableBackend | null {
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

export function createMemoryBackend(): EnumerableBackend {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}
