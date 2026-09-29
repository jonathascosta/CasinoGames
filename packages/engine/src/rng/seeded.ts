import type { Rng } from './rng.ts';

/** A seed: a safe integer, a bigint (taken modulo 2^64) or any string. */
export type Seed = number | bigint | string;

const MASK_64 = (1n << 64n) - 1n;
const TWO_POW_32 = 0x1_0000_0000;

/**
 * A reproducible Rng: xoshiro128** 1.1 (Blackman & Vigna), a small, fast
 * generator with a 2^128 − 1 period that passes BigCrush. Its 128-bit state is
 * expanded from the seed with SplitMix64, as the authors recommend, so nearby
 * seeds (0, 1, 2…) still produce unrelated streams.
 *
 * For tests, simulations and replays only; production draws come from
 * {@link createCryptoRng} or a server-side certified source.
 */
export function createSeededRng(seed: Seed): Rng {
  const nextSeedWord = splitMix64(seedToUint64(seed));
  const a = nextSeedWord();
  const b = nextSeedWord();
  // SplitMix64 is a bijection of its counter, so a and b are never both zero
  // and the forbidden all-zero xoshiro state cannot occur. State words are
  // kept as int32; every operation below is 32-bit, exactly as in the C code.
  let s0 = low32(a);
  let s1 = high32(a);
  let s2 = low32(b);
  let s3 = high32(b);

  return {
    next(): number {
      const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
      const t = s1 << 9;
      s2 ^= s0;
      s3 ^= s1;
      s1 ^= s2;
      s0 ^= s3;
      s2 ^= t;
      s3 = rotl(s3, 11);
      return result / TWO_POW_32;
    },
  };
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

/** SplitMix64 (Steele, Lea & Flood), used only to expand seeds. */
function splitMix64(seed: bigint): () => bigint {
  let state = seed;
  return () => {
    state = (state + 0x9e3779b97f4a7c15n) & MASK_64;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK_64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK_64;
    return z ^ (z >> 31n);
  };
}

function seedToUint64(seed: Seed): bigint {
  if (typeof seed === 'string') return fnv1a64(utf8Bytes(seed));
  if (typeof seed === 'number' && !Number.isSafeInteger(seed)) {
    throw new RangeError(`Seed must be a safe integer, got ${seed}`);
  }
  return BigInt.asUintN(64, BigInt(seed));
}

/** FNV-1a 64-bit over the UTF-8 bytes of the seed string. */
function fnv1a64(bytes: readonly number[]): bigint {
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & MASK_64;
  }
  return hash;
}

/** UTF-8 encoding without TextEncoder, which is not part of the ES library. */
function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return bytes;
}

function low32(value: bigint): number {
  return Number(value & 0xffffffffn) | 0;
}

function high32(value: bigint): number {
  return Number(value >> 32n) | 0;
}
