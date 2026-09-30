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

/** An amount of money kept exactly: whole cents plus millionths of a cent. */
export interface ExactAmount {
  readonly cents: number;
  /** Millionths of a cent beyond `cents`, in [0, 1,000,000). */
  readonly micros: number;
}

/**
 * Everything a pool needs to carry on where it stopped, in exact integers:
 * what a page stores between visits, or a server between requests.
 */
export interface ProgressiveState {
  /** The pool, in millionths of a cent. */
  readonly pool: number;
  readonly hits: number;
  readonly contributed: ExactAmount;
  /** Total paid to winners, in cents. */
  readonly awarded: Cents;
  readonly seedFunding: ExactAmount;
}

const MICROS_PER_CENT = 1_000_000;
/** Keeps every internal amount (in millionths of a cent) a safe integer. */
const MAX_POOL: Cents = 1_000_000_000;

/**
 * A running total in whole cents plus millionths. A pool stays small, but
 * what flows through it over a long simulation does not: hundreds of
 * millions of stakes would take a count of millionths past 2^53.
 */
class Tally {
  cents = 0;
  micros = 0;

  constructor(amount?: ExactAmount) {
    if (amount !== undefined) ({ cents: this.cents, micros: this.micros } = amount);
  }

  add(micros: number): void {
    const total = this.micros + micros;
    this.cents += Math.floor(total / MICROS_PER_CENT);
    this.micros = total % MICROS_PER_CENT;
  }

  get value(): ExactAmount {
    return { cents: this.cents, micros: this.micros };
  }

  /** In cents, with the fraction (exact while it fits a double). */
  get total(): number {
    return this.cents + this.micros / MICROS_PER_CENT;
  }
}

/**
 * An in-memory progressive jackpot pool. The demo simulates it per table and
 * stores its state between visits; a server would persist the state instead.
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
  readonly #contributed: Tally;
  #awarded: Cents = 0;
  readonly #seedFunding: Tally;

  /**
   * A pool at its seed, or, given `state`, the pool that state describes. A
   * restored pool below the seed (the seed was raised since) is topped up to
   * it, and the top-up counts as seed funding.
   */
  constructor(options: ProgressiveOptions, state?: ProgressiveState) {
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
    this.#contributed = new Tally();
    this.#seedFunding = new Tally();
    if (state === undefined) return;

    checkState(state, (cap ?? MAX_POOL) * MICROS_PER_CENT);
    this.#pool = state.pool;
    this.#hits = state.hits;
    this.#contributed = new Tally(state.contributed);
    this.#awarded = state.awarded;
    this.#seedFunding = new Tally(state.seedFunding);
    this.#refill();
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
    this.#contributed.add(added);
  }

  /**
   * Pays `share` of the pool in whole cents (rounded down) and returns the
   * amount. Whatever is left, down to the fraction of a cent, stays in the
   * pool, and the house tops it back up to the seed if needed.
   */
  award(share = 1): Cents {
    if (!(share > 0 && share <= 1)) throw new RangeError(`share must be in (0, 1], got ${share}`);
    return this.#pay(Math.floor(Math.floor(this.#pool * share) / MICROS_PER_CENT));
  }

  /**
   * Pays `numerator ÷ denominator` of the pool, computed exactly and rounded
   * down to the cent: a stake's share of a meter paid in proportion to it
   * (awardFraction(stake, fullShareStake)). The rest stays in the pool, which
   * is topped back up to the seed if it fell below.
   */
  awardFraction(numerator: number, denominator: number): Cents {
    if (
      !Number.isSafeInteger(numerator) ||
      !Number.isSafeInteger(denominator) ||
      numerator < 1 ||
      numerator > denominator
    ) {
      throw new RangeError(`share must be a fraction in (0, 1], got ${numerator}/${denominator}`);
    }
    const paid =
      (BigInt(this.#pool) * BigInt(numerator)) / (BigInt(denominator) * BigInt(MICROS_PER_CENT));
    return this.#pay(Number(paid));
  }

  snapshot(): ProgressiveSnapshot {
    return {
      id: this.id,
      amount: this.amount,
      seed: this.seed,
      hits: this.#hits,
      contributed: this.#contributed.total,
      awarded: this.#awarded,
      seedFunding: this.#seedFunding.total,
    };
  }

  /** The exact state, to store and restore with `new ProgressiveJackpot(options, state)`. */
  state(): ProgressiveState {
    return {
      pool: this.#pool,
      hits: this.#hits,
      contributed: this.#contributed.value,
      awarded: this.#awarded,
      seedFunding: this.#seedFunding.value,
    };
  }

  #pay(cents: Cents): Cents {
    this.#pool -= cents * MICROS_PER_CENT;
    this.#awarded += cents;
    this.#hits++;
    this.#refill();
    return cents;
  }

  /** The house tops the pool back up to its seed. */
  #refill(): void {
    const refill = Math.max(0, this.seed * MICROS_PER_CENT - this.#pool);
    this.#pool += refill;
    this.#seedFunding.add(refill);
  }
}

function checkState(state: ProgressiveState, ceiling: number): void {
  const count = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
  const exact = (amount: ExactAmount | undefined) =>
    count(amount?.cents) && count(amount?.micros) && (amount?.micros ?? 0) < MICROS_PER_CENT;
  if (
    !count(state.pool) ||
    state.pool > ceiling ||
    !count(state.hits) ||
    !count(state.awarded) ||
    !exact(state.contributed) ||
    !exact(state.seedFunding)
  ) {
    throw new RangeError('Invalid progressive state');
  }
}
