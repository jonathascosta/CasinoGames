import { isCents, type Cents } from '../game/money.ts';

export interface ProgressiveOptions {
  readonly id: string;
  /** What the pool starts at and is reset to after a full award, in cents. */
  readonly seed: Cents;
  /**
   * Fraction of every qualifying stake added to the pool, e.g. 0.015 for
   * 1.5%. Stored exactly as parts per million, so it must be a multiple of
   * 0.0001%.
   */
  readonly contributionRate: number;
  /** Optional ceiling in cents; contributions beyond it are not added. */
  readonly cap?: Cents;
}

export interface ProgressiveSnapshot {
  readonly id: string;
  /** Current pool in whole cents (what the meter shows and an award pays). */
  readonly amount: Cents;
  readonly seed: Cents;
  readonly hits: number;
  /** Total accrued from stakes, in cents (may include a fraction of a cent). */
  readonly contributed: number;
  /** Total paid to winners, in cents. */
  readonly awarded: Cents;
  /** Total the house added to restore the seed after awards, in cents. */
  readonly seedFunding: number;
}

const MICROS_PER_CENT = 1_000_000;
/** Keeps every internal amount (in millionths of a cent) a safe integer. */
const MAX_POOL: Cents = 1_000_000_000;

/**
 * An in-memory progressive jackpot pool. The demo simulates it per table;
 * a server would persist the snapshot instead.
 *
 * Amounts are tracked in millionths of a cent, so sub-cent contributions
 * accumulate exactly instead of being rounded away. In the long run a
 * progressive bet returns its RTP measured with the pool at seed plus the
 * contribution rate (see docs/MATH.md).
 */
export class ProgressiveJackpot {
  readonly id: string;
  readonly seed: Cents;
  /** Contribution rate in parts per million of the stake. */
  readonly contributionPpm: number;
  readonly cap: Cents | undefined;

  #pool: number;
  #hits = 0;
  #contributed = 0;
  #awarded: Cents = 0;
  #seedFunding = 0;

  constructor(options: ProgressiveOptions) {
    const { id, seed, contributionRate, cap } = options;
    if (!isCents(seed) || seed < 0 || seed > MAX_POOL) {
      throw new RangeError(`seed must be integer cents in [0, ${MAX_POOL}], got ${seed}`);
    }
    if (cap !== undefined && (!isCents(cap) || cap < seed || cap > MAX_POOL)) {
      throw new RangeError(`cap must be integer cents in [seed, ${MAX_POOL}], got ${cap}`);
    }
    const ppm = Math.round(contributionRate * MICROS_PER_CENT);
    if (
      !(contributionRate >= 0 && contributionRate < 1) ||
      Math.abs(contributionRate * MICROS_PER_CENT - ppm) > 1e-6
    ) {
      throw new RangeError(
        `contributionRate must be in [0, 1) and a multiple of 0.0001%, got ${contributionRate}`,
      );
    }
    this.id = id;
    this.seed = seed;
    this.contributionPpm = ppm;
    this.cap = cap;
    this.#pool = seed * MICROS_PER_CENT;
  }

  /** The pool in whole cents. */
  get amount(): Cents {
    return Math.floor(this.#pool / MICROS_PER_CENT);
  }

  /** Adds the contribution for a qualifying stake. */
  contribute(stake: Cents): void {
    if (!isCents(stake) || stake < 0 || stake > MAX_POOL) {
      throw new RangeError(`stake must be integer cents in [0, ${MAX_POOL}], got ${stake}`);
    }
    const micros = stake * this.contributionPpm;
    const ceiling = (this.cap ?? MAX_POOL) * MICROS_PER_CENT;
    const added = Math.min(micros, Math.max(0, ceiling - this.#pool));
    this.#pool += added;
    this.#contributed += added;
  }

  /**
   * Pays `share` of the pool in whole cents (rounded down) and returns the
   * amount. Whatever is left, down to the fraction of a cent, stays in the
   * pool, and the house tops it back up to the seed if needed.
   */
  award(share = 1): Cents {
    if (!(share > 0 && share <= 1)) throw new RangeError(`share must be in (0, 1], got ${share}`);
    const paid = Math.floor(Math.floor(this.#pool * share) / MICROS_PER_CENT);
    const remaining = this.#pool - paid * MICROS_PER_CENT;
    const refill = Math.max(0, this.seed * MICROS_PER_CENT - remaining);
    this.#pool = remaining + refill;
    this.#seedFunding += refill;
    this.#awarded += paid;
    this.#hits++;
    return paid;
  }

  snapshot(): ProgressiveSnapshot {
    return {
      id: this.id,
      amount: this.amount,
      seed: this.seed,
      hits: this.#hits,
      contributed: this.#contributed / MICROS_PER_CENT,
      awarded: this.#awarded,
      seedFunding: this.#seedFunding / MICROS_PER_CENT,
    };
  }
}
