import { EngineError } from './errors.ts';

/**
 * An integer number of cents. Money never touches floating point: stakes,
 * payouts and balances are safe integers, and any fractional result is
 * resolved explicitly (see {@link winnings}).
 */
export type Cents = number;

/**
 * Fractional odds in "to" notation: a winning stake of `per` wins `to` and
 * gets the stake back. 3 to 2 is `{ to: 3, per: 2 }`; even money is 1 to 1.
 */
export interface Odds {
  readonly to: number;
  readonly per: number;
}

/** Builds validated odds: odds(3, 2) is "3 to 2". */
export function odds(to: number, per = 1): Odds {
  if (!Number.isSafeInteger(to) || to < 0 || !Number.isSafeInteger(per) || per < 1) {
    throw new EngineError('INVALID_ODDS', `Invalid odds ${to} to ${per}`);
  }
  return { to, per };
}

/** "3 to 2", "1 to 1". */
export function oddsLabel({ to, per }: Odds): string {
  return `${to} to ${per}`;
}

/** Total returned per unit staked on a win: 3 to 2 → 2.5. */
export function oddsMultiplier({ to, per }: Odds): number {
  return (to + per) / per;
}

export function isCents(value: unknown): value is Cents {
  return Number.isSafeInteger(value);
}

/**
 * Winnings (excluding the returned stake) for a winning stake at `odds`,
 * rounded down to the whole cent. The fraction of a cent ("breakage") stays
 * with the house, as is conventional; with chip denominations in multiples
 * of 50¢ the usual table odds pay exactly.
 */
export function winnings(stake: Cents, { to, per }: Odds): Cents {
  return Math.floor((stake * to) / per);
}
