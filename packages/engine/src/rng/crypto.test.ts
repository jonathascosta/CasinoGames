import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCryptoRng, type RandomValuesSource } from './crypto.ts';

function countingSource(): RandomValuesSource & { calls: number } {
  let next = 0;
  const source = {
    calls: 0,
    getRandomValues(array: Uint32Array): Uint32Array {
      source.calls++;
      for (let i = 0; i < array.length; i++) array[i] = next++;
      return array;
    },
  };
  return source;
}

describe('createCryptoRng', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps each 32-bit word k to k / 2^32, refilling one block at a time', () => {
    const source = countingSource();
    const rng = createCryptoRng(source, 4);
    const values = Array.from({ length: 9 }, () => rng.next() * 0x1_0000_0000);
    expect(values).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(source.calls).toBe(3);
  });

  it('uses the platform CSPRNG by default', () => {
    const rng = createCryptoRng();
    const values = Array.from({ length: 1_000 }, () => rng.next());
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(990);
  });

  it('fails loudly when no CSPRNG is available', () => {
    vi.stubGlobal('crypto', undefined);
    expect(() => createCryptoRng()).toThrow(/getRandomValues/);
  });

  it.each([0, 1.5, 16_385])('rejects the block size %s', (blockSize) => {
    expect(() => createCryptoRng(countingSource(), blockSize)).toThrow(RangeError);
  });
});
