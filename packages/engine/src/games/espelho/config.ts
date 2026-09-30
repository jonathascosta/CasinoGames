import { odds } from '../../game/money.ts';

/**
 * What can be retuned in Espelho without touching its rules: the shoe, the
 * limits, the payouts and the progressive meter. The declared math
 * (bets.ts) is computed from these values and the exact tests check it
 * against the game, so a change here stays consistent; the game sheet then
 * needs `pnpm docs:sheets`.
 */
export const ESPELHO_CONFIG = {
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
    espelho: odds(1),
    empate: odds(17),
    somasIguais: odds(7),
    parVsPar: odds(30),
    espelhoPerfeito: odds(200),
    seisSeis: odds(1000),
  },
  /** The progressive meter that 6-6 vs 6-6 pays on top of its fixed odds. */
  jackpot: {
    id: 'espelho',
    /** SEED: what the meter starts at and never drops below, in cents (5,000.00). */
    seed: 500_000,
    /** CONTRIB_RATE: the share of every 6-6 vs 6-6 stake that goes to the meter. */
    contributionRate: 0.1,
  },
} as const;
