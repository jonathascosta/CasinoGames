/**
 * Trancar's math, exactly: what each choice is worth on each roll, the best
 * choice (the reference strategy, computed here rather than written down),
 * and what a strategy returns. Fractions throughout, so every figure is
 * exact for any configuration of the rules.
 *
 * Values are net results per unit of the main bet, fees included: standing
 * on a total t is worth 2·P(dealer < t) − 1, and a re-roll with a die of
 * value k locked is worth the average of that over the six faces of the
 * other die, less the fee.
 */
import { DIE_FACES, type DicePair } from '../../dice/dice.ts';
import { Fraction } from '../../math/fraction.ts';
import type { TrancarRules } from './config.ts';
import { isFreeReroll, lockChoice, lockedDie, type DieIndex, type TrancarChoice } from './rules.ts';

/** How the dealer's two cards add up: the chance of each total, indexed by the total (2–12). */
export type DealerTotals = readonly Fraction[];

function totals(chance: (a: number, b: number) => Fraction): DealerTotals {
  const result = Array.from({ length: 13 }, () => Fraction.ZERO);
  for (const a of DIE_FACES) {
    for (const b of DIE_FACES) result[a + b] = result[a + b]!.add(chance(a, b));
  }
  return result;
}

/**
 * Two cards from an infinite shoe of aces to sixes: each ordered pair of
 * values 1 in 36, like two dice. The declared figures assume it.
 */
export const INFINITE_SHOE: DealerTotals = totals(() => Fraction.of(1, 36));

/**
 * Two cards dealt from a full shoe of `decks` decks of aces to sixes: n of
 * each value among 6n cards, the second card from the 6n − 1 left. Trancar
 * deals two cards every round and a fixed number of rounds per shoe, so that
 * is every round's chance, however deep the shoe has been dealt.
 */
export function shoeTotals(decks: number): DealerTotals {
  const n = BigInt(4 * decks);
  const pairs = 6n * n * (6n * n - 1n);
  return totals((a, b) => Fraction.of(a === b ? n * (n - 1n) : n * n, pairs));
}

/** The chance that a total beats the dealer's: a strictly lower dealer total (a tie loses). */
export function beatChance(total: number, dealer: DealerTotals): Fraction {
  let chance = Fraction.ZERO;
  for (let lower = 2; lower < total && lower <= 12; lower++) chance = chance.add(dealer[lower]!);
  return chance;
}

const TWO = Fraction.of(2);

/** Standing on a total: the net result per unit of the main bet, 2·P(win) − 1. */
export function standValue(total: number, dealer: DealerTotals): Fraction {
  return TWO.mul(beatChance(total, dealer)).sub(Fraction.ONE);
}

/** Re-rolling with a die of value `kept` locked, before any fee: the average over the six faces. */
export function rerollValue(kept: number, dealer: DealerTotals): Fraction {
  let sum = Fraction.ZERO;
  for (const face of DIE_FACES) sum = sum.add(standValue(kept + face, dealer));
  return sum.div(Fraction.of(DIE_FACES.length));
}

/** The price of re-rolling this roll, per unit of the main bet: nothing on a free re-roll. */
export function feeRate(dice: DicePair, rules: TrancarRules): Fraction {
  return isFreeReroll(dice, rules)
    ? Fraction.ZERO
    : Fraction.of(rules.fee.numerator, rules.fee.denominator);
}

/** What each choice is worth on a roll, per unit of the main bet, fees included. */
export interface RollValues {
  /** Standing on the roll. */
  readonly ficar: Fraction;
  /** Locking the first die, or the second, and re-rolling the other. */
  readonly trancar: readonly [Fraction, Fraction];
}

export function rollValues(dice: DicePair, rules: TrancarRules, dealer: DealerTotals): RollValues {
  const fee = feeRate(dice, rules);
  const locking = (index: DieIndex) => rerollValue(dice[index], dealer).sub(fee);
  return { ficar: standValue(dice[0] + dice[1], dealer), trancar: [locking(0), locking(1)] };
}

/**
 * The best choice on a roll: Ficar unless a re-roll is worth strictly more,
 * and then locking the die whose re-roll is worth more (the first on a tie,
 * as when both dice show the same face).
 */
export function bestChoice(
  dice: DicePair,
  rules: TrancarRules,
  dealer: DealerTotals = INFINITE_SHOE,
): TrancarChoice {
  const values = rollValues(dice, rules, dealer);
  const lock: DieIndex = values.trancar[1].compare(values.trancar[0]) > 0 ? 1 : 0;
  return values.trancar[lock].compare(values.ficar) > 0 ? lockChoice(lock) : 'ficar';
}

/** One of the 21 distinct rolls (the lower die first) and its chance per round. */
export interface DistinctRoll {
  readonly dice: DicePair;
  readonly probability: Fraction;
}

/** The 21 distinct rolls, grouped by the lower die: 1-1 … 1-6, 2-2 … 2-6, …, 6-6. */
export const DISTINCT_ROLLS: readonly DistinctRoll[] = DIE_FACES.flatMap((low) =>
  DIE_FACES.filter((high) => high >= low).map((high) => ({
    dice: [low, high] as DicePair,
    probability: Fraction.of(low === high ? 1 : 2, 36),
  })),
);

/** A strategy: the choice on each roll. */
export type RollStrategy = (dice: DicePair) => TrancarChoice;

const strategies = new Map<string, RollStrategy>();

/**
 * The best choice on every roll under `rules`, computed once per set of rules
 * for an infinite shoe: the reference strategy the declared figures assume,
 * and the one the autoplay, the simulations and the exact tests play.
 */
export function referenceStrategy(rules: TrancarRules): RollStrategy {
  const key = `${rules.fee.numerator}/${rules.fee.denominator}/${String(rules.freeOneOne)}`;
  let strategy = strategies.get(key);
  if (strategy === undefined) {
    const table = DIE_FACES.map((a) => DIE_FACES.map((b) => bestChoice([a, b], rules)));
    strategy = (dice) => table[dice[0] - 1]![dice[1] - 1]!;
    strategies.set(key, strategy);
  }
  return strategy;
}

/** What a strategy returns, per unit of the main bet, exactly. */
export interface StrategyMath {
  /** 1 + the expected net result: (payout − fee) ÷ stake. */
  readonly rtp: Fraction;
  /** Chance per round that the bet wins. */
  readonly hitFrequency: Fraction;
  /** Variance of the net result per unit, fees included. */
  readonly variance: Fraction;
  /** Chance per round of a re-roll, free or not. */
  readonly rerollFrequency: Fraction;
  /** Chance per round of paying the fee. */
  readonly feeFrequency: Fraction;
  /** Average fee per round, per unit of the main bet. */
  readonly averageFee: Fraction;
  /** The loss per unit of everything paid, the bet and the fees: (1 − rtp) ÷ (1 + averageFee). */
  readonly elementOfRisk: Fraction;
}

/**
 * The exact figures of `strategy` (by default the reference strategy for the
 * rules) under `rules`, against the dealer's cards drawn as `dealer`
 * describes: every roll, every face of a re-rolled die, every dealer total.
 */
export function strategyMath(
  rules: TrancarRules,
  dealer: DealerTotals = INFINITE_SHOE,
  strategy: RollStrategy = referenceStrategy(rules),
): StrategyMath {
  let net = Fraction.ZERO;
  let squares = Fraction.ZERO;
  let hits = Fraction.ZERO;
  let rerolls = Fraction.ZERO;
  let fees = Fraction.ZERO;
  let paid = Fraction.ZERO;
  for (const { dice, probability } of DISTINCT_ROLLS) {
    const locked = lockedDie(strategy(dice));
    const fee = locked === null ? Fraction.ZERO : feeRate(dice, rules);
    // The totals the roll can end on, each with its chance given the roll.
    const ends =
      locked === null
        ? [{ total: dice[0] + dice[1], chance: Fraction.ONE }]
        : DIE_FACES.map((face) => ({
            total: dice[locked] + face,
            chance: Fraction.of(1, DIE_FACES.length),
          }));
    for (const { total, chance } of ends) {
      const p = probability.mul(chance);
      const win = beatChance(total, dealer);
      const up = Fraction.ONE.sub(fee);
      const down = Fraction.ONE.add(fee);
      net = net.add(p.mul(win.mul(up).sub(Fraction.ONE.sub(win).mul(down))));
      squares = squares.add(
        p.mul(win.mul(up.mul(up)).add(Fraction.ONE.sub(win).mul(down.mul(down)))),
      );
      hits = hits.add(p.mul(win));
    }
    if (locked !== null) {
      rerolls = rerolls.add(probability);
      if (fee.compare(Fraction.ZERO) > 0) paid = paid.add(probability);
      fees = fees.add(probability.mul(fee));
    }
  }
  return {
    rtp: Fraction.ONE.add(net),
    hitFrequency: hits,
    variance: squares.sub(net.mul(net)),
    rerollFrequency: rerolls,
    feeFrequency: paid,
    averageFee: fees,
    elementOfRisk: net.neg().div(Fraction.ONE.add(fees)),
  };
}
