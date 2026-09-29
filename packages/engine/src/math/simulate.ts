import { playRound, type Strategy } from '../game/play.ts';
import type { BetId, Bets, CustomEvent, Game } from '../game/types.ts';
import type { Rng } from '../rng/rng.ts';

export interface SimulationOptions<TChoice extends string, TData, TEvent extends CustomEvent> {
  readonly rounds: number;
  /** Use a seeded Rng so a simulation (and a test built on it) is reproducible. */
  readonly rng: Rng;
  readonly bets: Bets;
  /** Required when the game asks for decisions. */
  readonly strategy?: Strategy<TChoice, TData, TEvent>;
}

export interface BetStatistics {
  /** Rounds in which the bet was settled. */
  readonly rounds: number;
  /** Total wagered, in cents. */
  readonly staked: number;
  /** Total returned, in cents, stakes included. */
  readonly returned: number;
  /** returned ÷ staked. */
  readonly rtp: number;
  readonly houseEdge: number;
  /** Share of rounds the bet won. */
  readonly hitFrequency: number;
  /** Standard deviation of one round's return, per unit of average stake. */
  readonly standardDeviation: number;
  /** Standard error of the RTP estimate: standardDeviation ÷ √rounds. */
  readonly standardError: number;
}

export interface SimulationReport {
  readonly rounds: number;
  readonly bets: Readonly<Record<BetId, BetStatistics>>;
  /** All bets together, per round. */
  readonly total: BetStatistics;
}

/**
 * Monte Carlo simulation: plays `rounds` rounds and measures each bet's RTP
 * with its standard error. With a seeded Rng the report is deterministic,
 * which is what lets a test assert a tolerance without flaking.
 */
export function simulate<TChoice extends string, TData, TEvent extends CustomEvent>(
  game: Game<TChoice, TData, TEvent>,
  options: SimulationOptions<TChoice, TData, TEvent>,
): SimulationReport {
  const { rounds, rng, bets, strategy } = options;
  if (!Number.isSafeInteger(rounds) || rounds < 2) {
    throw new RangeError(`rounds must be an integer >= 2, got ${rounds}`);
  }
  const perBet = new Map<BetId, RatioAccumulator>();
  const total = new RatioAccumulator();

  for (let round = 0; round < rounds; round++) {
    const { settlement } = playRound(game, bets, rng, strategy);
    let stake = 0;
    let payout = 0;
    for (const betId in settlement) {
      const line = settlement[betId]!;
      let accumulator = perBet.get(betId);
      if (accumulator === undefined) perBet.set(betId, (accumulator = new RatioAccumulator()));
      accumulator.add(line.stake, line.payout, line.outcome === 'win');
      stake += line.stake;
      payout += line.payout;
    }
    total.add(stake, payout, payout > stake);
  }

  return {
    rounds,
    bets: Object.fromEntries([...perBet].map(([betId, acc]) => [betId, acc.statistics()])),
    total: total.statistics(),
  };
}

/**
 * Streams (stake, payout) pairs and estimates the ratio Σpayout ÷ Σstake with
 * its delta-method standard error, which stays valid when stakes vary from
 * round to round (raises). Values are scaled by the first stake seen to keep
 * the sums of squares well inside double precision.
 */
class RatioAccumulator {
  #n = 0;
  #wins = 0;
  #scale = 0;
  #stake = 0;
  #payout = 0;
  #stake2 = 0;
  #payout2 = 0;
  #cross = 0;
  #stakeCents = 0;
  #payoutCents = 0;

  add(stake: number, payout: number, won: boolean): void {
    if (this.#scale === 0) this.#scale = stake;
    const s = stake / this.#scale;
    const p = payout / this.#scale;
    this.#n++;
    if (won) this.#wins++;
    this.#stake += s;
    this.#payout += p;
    this.#stake2 += s * s;
    this.#payout2 += p * p;
    this.#cross += s * p;
    this.#stakeCents += stake;
    this.#payoutCents += payout;
  }

  statistics(): BetStatistics {
    const n = this.#n;
    const rtp = this.#payout / this.#stake;
    const residual = Math.max(
      0,
      (this.#payout2 - 2 * rtp * this.#cross + rtp * rtp * this.#stake2) / (n - 1),
    );
    const standardDeviation = Math.sqrt(residual) / (this.#stake / n);
    return {
      rounds: n,
      staked: this.#stakeCents,
      returned: this.#payoutCents,
      rtp,
      houseEdge: 1 - rtp,
      hitFrequency: this.#wins / n,
      standardDeviation,
      standardError: standardDeviation / Math.sqrt(n),
    };
  }
}

/**
 * Rounds a Monte Carlo test needs so that a correct implementation lands
 * within ±tolerance of the declared RTP with the confidence implied by `z`
 * (default 3.29: 99.9%, two-sided). A fixed round count such as 2,000,000
 * is plenty for even-money bets but not for volatile side bets.
 */
export function roundsForTolerance(
  standardDeviation: number,
  tolerance = 0.0015,
  z = 3.29,
): number {
  if (!(standardDeviation > 0 && tolerance > 0 && z > 0)) {
    throw new RangeError('standardDeviation, tolerance and z must be positive');
  }
  return Math.ceil(((z * standardDeviation) / tolerance) ** 2);
}
