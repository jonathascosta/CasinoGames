import type { Cents, ExactAmount, ProgressiveState } from '@casinogames/engine';
import type { SafeStorage } from '../storage/storage.ts';

const MICROS_PER_CENT = 1_000_000;

/** Where a progressive meter's state is kept, beside the bankroll, settings and RTP stats. */
export function jackpotKey(jackpotId: string): string {
  return `jackpot:${jackpotId}`;
}

const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function exactAmount(value: unknown): ExactAmount | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { cents, micros } = value as Record<string, unknown>;
  return count(cents) && count(micros) && micros < MICROS_PER_CENT ? { cents, micros } : undefined;
}

/**
 * Validates a stored meter state: stored data is untrusted, and anything
 * malformed is treated as absent (the meter then starts at its seed).
 */
export function parseJackpotState(value: unknown): ProgressiveState | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const contributed = exactAmount(record.contributed);
  const seedFunding = exactAmount(record.seedFunding);
  const { pool, hits, awarded } = record;
  if (!count(pool) || !count(hits) || !count(awarded) || !contributed || !seedFunding) {
    return undefined;
  }
  return { pool, hits, contributed, awarded, seedFunding };
}

export function readJackpotState(
  storage: SafeStorage,
  jackpotId: string,
): ProgressiveState | undefined {
  return storage.read(jackpotKey(jackpotId), parseJackpotState, undefined);
}

export function writeJackpotState(
  storage: SafeStorage,
  jackpotId: string,
  state: ProgressiveState,
): void {
  storage.write(jackpotKey(jackpotId), state);
}

/**
 * The meter as a page would show it, in whole cents, without loading the
 * game: the stored pool, or the seed when nothing (or nothing valid) is
 * stored or the pool is below it. The lobby shows it on the table's card.
 */
export function storedMeterAmount(storage: SafeStorage, jackpotId: string, seed: Cents): Cents {
  const state = readJackpotState(storage, jackpotId);
  return Math.max(seed, state === undefined ? 0 : Math.floor(state.pool / MICROS_PER_CENT));
}
