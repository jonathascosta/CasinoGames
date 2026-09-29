import type { IntegerRng } from '../rng/rng.ts';
import { Fraction } from './fraction.ts';

export interface WeightedOutcome<T> {
  readonly value: T;
  /** Exact probability of the draw sequence that produced `value`. */
  readonly probability: Fraction;
  /** The integer drawn at each step, in order. */
  readonly draws: readonly number[];
}

export interface EnumerateOptions {
  /** Safety valve against accidentally exponential games. Default 5,000,000. */
  readonly maxOutcomes?: number;
}

class NeedsDraw extends Error {
  readonly range: number;

  constructor(range: number) {
    super('enumeration branch needs another draw');
    this.range = range;
  }
}

/**
 * Runs `play` once for every possible sequence of random draws and yields
 * each result with its exact probability.
 *
 * `play` receives an Rng whose draws are scripted; whenever it asks for a
 * draw past the current script, the enumeration branches on every value of
 * that draw (each with probability 1/n) and replays. Because the real game
 * code runs on every branch, an exact RTP computed this way checks the
 * implementation itself, not a separate model of it.
 *
 * Only for sources without hidden state between draws: dice and infinite
 * shoes. A shuffled finite shoe has far too many orderings to enumerate.
 */
export function* enumerateOutcomes<T>(
  play: (rng: IntegerRng) => T,
  options: EnumerateOptions = {},
): Generator<WeightedOutcome<T>> {
  const maxOutcomes = options.maxOutcomes ?? 5_000_000;
  // Each pending branch: the draws to replay and the probability of reaching it.
  const pending: { draws: number[]; probability: Fraction }[] = [
    { draws: [], probability: Fraction.ONE },
  ];
  let yielded = 0;

  while (pending.length > 0) {
    const branch = pending.pop()!;
    let index = 0;
    const rng: IntegerRng = {
      next(): number {
        throw new Error('The enumerating Rng only serves integer draws (use randomInt)');
      },
      nextInt(n: number): number {
        if (index < branch.draws.length) return branch.draws[index++]!;
        throw new NeedsDraw(n);
      },
    };

    let value: T;
    try {
      value = play(rng);
    } catch (error) {
      if (!(error instanceof NeedsDraw)) throw error;
      const probability = branch.probability.div(Fraction.of(error.range));
      for (let k = error.range - 1; k >= 0; k--) {
        pending.push({ draws: [...branch.draws, k], probability });
      }
      continue;
    }

    if (index !== branch.draws.length) {
      throw new Error(
        'play() drew a different number of values on replay: it is not deterministic',
      );
    }
    if (++yielded > maxOutcomes) {
      throw new Error(`More than ${maxOutcomes} outcomes; raise maxOutcomes if this is intended`);
    }
    yield { value, probability: branch.probability, draws: branch.draws };
  }
}
