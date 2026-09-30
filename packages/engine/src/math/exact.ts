import { playRound, type Strategy } from '../game/play.ts';
import type { BetId, Bets, CustomEvent, Game } from '../game/types.ts';
import { enumerateOutcomes, type EnumerateOptions } from './enumerate.ts';
import { Fraction } from './fraction.ts';

export interface ExactReturn {
  /** Expected amount wagered per round, in cents (decisions can add stake). */
  readonly expectedStake: Fraction;
  /** Expected amount returned per round, in cents, stakes included. */
  readonly expectedPayout: Fraction;
  /** expectedPayout ÷ expectedStake: the long-run RTP. */
  readonly rtp: Fraction;
  /** Probability that the bet is made (settled) in a round. */
  readonly frequency: Fraction;
  /** Probability that the bet wins, given that it is made. */
  readonly hitFrequency: Fraction;
  /** Probability that the bet pushes (the stake comes back), given that it is made. */
  readonly pushFrequency: Fraction;
  /**
   * Probability per round that each paytable entry decided the bet, keyed by
   * the entryId of the settlement lines; checks the declared probabilities.
   */
  readonly entries: Readonly<Record<string, Fraction>>;
  /**
   * Standard deviation of the return of one round in which the bet is made,
   * per unit of average stake — the same measure the simulator reports.
   */
  readonly standardDeviation: number;
}

export interface ExactReport {
  readonly bets: Readonly<Record<BetId, ExactReturn>>;
  /** All bets together. */
  readonly total: ExactReturn;
  /** Number of distinct draw sequences enumerated. */
  readonly outcomes: number;
}

/**
 * The exact RTP of every bet, obtained by running the real game over every
 * possible sequence of draws (see {@link enumerateOutcomes}). A fresh game is
 * created for every replay so table state (jackpot pools…) cannot leak
 * between branches. Requires dice and/or infinite-shoe card sources.
 */
export function exactReturns<TChoice extends string, TData, TEvent extends CustomEvent>(
  createGame: () => Game<TChoice, TData, TEvent>,
  bets: Bets,
  strategy?: Strategy<TChoice, TData, TEvent>,
  options?: EnumerateOptions,
): ExactReport {
  const perBet = new Map<BetId, Sums>();
  const total = new Sums();
  let outcomes = 0;

  const rounds = enumerateOutcomes(
    (rng) => playRound(createGame(), bets, rng, strategy).settlement,
    options,
  );
  for (const { value: settlement, probability } of rounds) {
    outcomes++;
    let stake = 0;
    let payout = 0;
    for (const [betId, line] of Object.entries(settlement)) {
      let sums = perBet.get(betId);
      if (sums === undefined) perBet.set(betId, (sums = new Sums()));
      sums.add(probability, line.stake, line.payout, line.entryId);
      stake += line.stake;
      payout += line.payout;
    }
    total.add(probability, stake, payout);
  }

  return {
    bets: Object.fromEntries([...perBet].map(([betId, sums]) => [betId, sums.result()])),
    total: total.result(),
    outcomes,
  };
}

/** Exact first and second moments of (stake, payout) over the enumeration. */
class Sums {
  #made = Fraction.ZERO;
  #hits = Fraction.ZERO;
  #pushes = Fraction.ZERO;
  readonly #entries = new Map<string, Fraction>();
  #stake = Fraction.ZERO;
  #payout = Fraction.ZERO;
  #stake2 = Fraction.ZERO;
  #payout2 = Fraction.ZERO;
  #cross = Fraction.ZERO;

  add(probability: Fraction, stake: number, payout: number, entryId?: string): void {
    const s = Fraction.of(stake);
    const p = Fraction.of(payout);
    this.#made = this.#made.add(probability);
    if (payout > stake) this.#hits = this.#hits.add(probability);
    if (payout === stake) this.#pushes = this.#pushes.add(probability);
    if (entryId !== undefined) {
      this.#entries.set(entryId, (this.#entries.get(entryId) ?? Fraction.ZERO).add(probability));
    }
    this.#stake = this.#stake.add(probability.mul(s));
    this.#payout = this.#payout.add(probability.mul(p));
    this.#stake2 = this.#stake2.add(probability.mul(s.mul(s)));
    this.#payout2 = this.#payout2.add(probability.mul(p.mul(p)));
    this.#cross = this.#cross.add(probability.mul(s.mul(p)));
  }

  result(): ExactReturn {
    const rtp = this.#payout.div(this.#stake);
    // E[(payout − rtp·stake)²] over all rounds; conditioning on the bet being
    // made divides it by P(made) and the mean stake by P(made) as well.
    const residual = this.#payout2
      .sub(Fraction.of(2).mul(rtp).mul(this.#cross))
      .add(rtp.mul(rtp).mul(this.#stake2));
    return {
      expectedStake: this.#stake,
      expectedPayout: this.#payout,
      rtp,
      frequency: this.#made,
      hitFrequency: this.#hits.div(this.#made),
      pushFrequency: this.#pushes.div(this.#made),
      entries: Object.fromEntries(this.#entries),
      standardDeviation: Math.sqrt(residual.mul(this.#made).toNumber()) / this.#stake.toNumber(),
    };
  }
}
