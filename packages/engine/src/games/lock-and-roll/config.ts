import { odds } from '../../game/money.ts';

/**
 * The re-roll's rules. The table plays LOCK_AND_ROLL_CONFIG.rules; the exact tests
 * and the game sheet also price variants (without the free 1-1, say).
 */
export interface LockAndRollRules {
  /** FEE: the price of a re-roll as a fraction of the main bet, rounded up to the cent. */
  readonly fee: { readonly numerator: number; readonly denominator: number };
  /** Whether a roll of 1-1 re-rolls for free. */
  readonly freeOneOne: boolean;
}

/**
 * What can be retuned in Lock & Roll without touching its rules: the shoe, the
 * limits, the payout and the price of a re-roll. Everything declared about
 * the game, the strategy included, is computed from these values
 * (strategy.ts, bets.ts) and the exact tests check it against the game, so a
 * change here stays consistent; the game sheet then needs `pnpm docs:sheets`.
 */
export const LOCK_AND_ROLL_CONFIG = {
  /** Decks of aces to sixes in the table's shoe. */
  decks: 6,
  /** Limits of the main bet, in cents. */
  min: 50,
  max: 25_000,
  /** What a winning bet pays. */
  odds: odds(1),
  /** The Lock fee: 40% of the main bet, free on 1-1. */
  rules: {
    fee: { numerator: 2, denominator: 5 },
    freeOneOne: true,
  } as LockAndRollRules,
} as const;
