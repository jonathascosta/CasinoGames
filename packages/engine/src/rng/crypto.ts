import type { Rng } from './rng.ts';

/** The slice of the Web Crypto API the engine needs (browsers, Node ≥ 20, Deno, Bun). */
export interface RandomValuesSource {
  getRandomValues(array: Uint32Array): Uint32Array;
}

const TWO_POW_32 = 0x1_0000_0000;

/**
 * An Rng backed by the platform CSPRNG (`crypto.getRandomValues`). Values are
 * fetched in blocks to amortise the call cost; each draw is k / 2^32 for a
 * uniformly random 32-bit k.
 *
 * @param source defaults to `globalThis.crypto`; injectable for tests.
 * @param blockSize number of 32-bit words fetched per refill.
 */
export function createCryptoRng(source?: RandomValuesSource, blockSize = 256): Rng {
  if (!Number.isInteger(blockSize) || blockSize < 1 || blockSize > 16_384) {
    throw new RangeError(`blockSize must be an integer in [1, 16384], got ${blockSize}`);
  }
  const random = source ?? platformCrypto();
  const block = new Uint32Array(blockSize);
  let index = blockSize;

  return {
    next(): number {
      if (index === blockSize) {
        random.getRandomValues(block);
        index = 0;
      }
      return block[index++]! / TWO_POW_32;
    },
  };
}

function platformCrypto(): RandomValuesSource {
  const candidate = (globalThis as { crypto?: Partial<RandomValuesSource> }).crypto;
  if (typeof candidate?.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues is not available; inject a RandomValuesSource.');
  }
  return candidate as RandomValuesSource;
}
