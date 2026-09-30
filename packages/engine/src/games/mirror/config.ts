import { odds } from '../../game/money.ts';

/**
 * What can be retuned in Mirror without touching its rules: the shoe, the
 * limits, the payouts and the progressive meter. The declared math
 * (bets.ts) is computed from these values and the exact tests check it
 * against the game, so a change here stays consistent; the tests' records
 * and the documents then need `pnpm test -u`, `pnpm test:math -u` and
 * `pnpm docs:generate`.
 */
export const MIRROR_CONFIG = {
  /** Decks of aces to sixes in the table's shoe. */
  decks: 6,
  /** Main bet limits, in cents. */
  mainMin: 50,
  mainMax: 25_000,
  /** Side bet limits, in cents. SIDE_MAX is also the stake that wins the whole meter. */
  sideMin: 50,
  sideMax: 2_500,
  /** The fixed payouts, "to one". */
  odds: {
    mirror: odds(1),
    tie: odds(17),
    equalSums: odds(7),
    pairVsPair: odds(30),
    perfectMirror: odds(200),
    doubleSixes: odds(1000),
  },
  /** The progressive meter that Double Sixes pays on top of its fixed odds. */
  jackpot: {
    id: 'mirror',
    /** SEED: what the meter starts at and never drops below, in cents (5,000.00). */
    seed: 500_000,
    /** CONTRIB_RATE: the share of every Double Sixes stake that goes to the meter. */
    contributionRate: 0.1,
  },
} as const;
