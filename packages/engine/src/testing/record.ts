/**
 * Records the figures a test computes, for the documents generated from them.
 *
 * tools/generate-docs.ts writes the Math Reports and docs/results.json from
 * the games' math summaries and from these records, and nothing else: a
 * figure the documents quote is either declared by the engine or computed by
 * a test. Each record is a file snapshot at results/<name>.json beside the
 * test file, with the test's file and name, so every figure can be traced to
 * the test that reproduces it. A run that computes anything else fails, and
 * `vitest run -u` (`pnpm test -u`, `pnpm test:math -u`) rewrites the records.
 *
 * Test code only (it imports Vitest): the package build leaves it out.
 */
import { expect } from 'vitest';
import { Shoe, type CardSource } from '../cards/shoe.ts';
import type { Odds } from '../game/money.ts';
import { playRound, type Strategy } from '../game/play.ts';
import type { Bets, CustomEvent, Game, PaytableEntry } from '../game/types.ts';
import { enumerateOutcomes } from '../math/enumerate.ts';
import type { ExactReturn } from '../math/exact.ts';
import { Fraction } from '../math/fraction.ts';
import { SEEDED_RNG } from '../rng/seeded.ts';

/** A figure computed as an exact fraction: the fraction, and its value as a number. */
export interface Exact {
  readonly fraction: string;
  readonly value: number;
}

export function exact(fraction: Fraction): Exact {
  return { fraction: fraction.toString(), value: fraction.toNumber() };
}

/** The two-sided 95% quantile of the normal distribution: a 95% confidence interval is ±1.96 σ. */
export const Z_95 = 1.959963984540054;

/** Where a run's cards came from, as a record states it. */
export type SourceRecord =
  | {
      readonly kind: 'shoe';
      readonly decks: number;
      readonly ranks: readonly number[];
      readonly suits: number;
      readonly cards: number;
      readonly penetration: number;
      /** Cards dealt before the cut card comes out. */
      readonly cutCard: number;
      /** Cards behind the cut card. */
      readonly behindCutCard: number;
    }
  | { readonly kind: 'infinite shoe'; readonly ranks: readonly number[]; readonly suits: number }
  | { readonly kind: 'uniform ranks'; readonly ranks: readonly number[] };

export function describeShoe(shoe: Shoe): SourceRecord {
  if (shoe.infinite) return { kind: 'infinite shoe', ranks: shoe.ranks, suits: 4 };
  return {
    kind: 'shoe',
    decks: shoe.decks,
    ranks: shoe.ranks,
    suits: 4,
    cards: shoe.size(),
    penetration: shoe.penetration,
    cutCard: shoe.cutCardPosition(),
    behindCutCard: shoe.size() - shoe.cutCardPosition(),
  };
}

/** A card source a record can describe: a Shoe, or ranks drawn uniformly (an infinite shoe's values). */
export function describeSource(source: CardSource | { readonly uniformRanks: readonly number[] }) {
  if (source instanceof Shoe) return describeShoe(source);
  if ('uniformRanks' in source) {
    return { kind: 'uniform ranks', ranks: source.uniformRanks } satisfies SourceRecord;
  }
  throw new TypeError('Only a Shoe or uniform ranks can be described');
}

/** What a seeded simulation was: enough to replay it. */
export function simulationRecord(run: {
  readonly rounds: number;
  readonly seed: string;
  readonly source: SourceRecord;
  /** Stakes in cents, per bet; several sets when they turn round by round. */
  readonly stakes: object;
  /** For a game with decisions: who decided. */
  readonly strategy?: string;
  /** The test's criterion: its z (standard errors allowed) and, where it has one, its tolerance. */
  readonly z: number;
  readonly tolerance?: number;
}) {
  return { ...run, rng: SEEDED_RNG, confidence: { level: 0.95, z: Z_95 } };
}

/**
 * A simulated figure against the one it is checked against: the difference,
 * the 95% confidence interval of the simulated value, the test's bound on the
 * difference and whether the run is within it.
 */
export function verification(
  expected: number,
  observed: number,
  standardError: number,
  allowed: number,
) {
  const difference = observed - expected;
  return {
    expected,
    observed,
    difference,
    standardError,
    ci95: [observed - Z_95 * standardError, observed + Z_95 * standardError] as const,
    /** How many standard errors the difference is. */
    errors: standardError === 0 ? 0 : Math.abs(difference) / standardError,
    allowed,
    pass: Math.abs(difference) <= allowed,
  };
}

/**
 * The most a round can cost the house and the player at the stakes `bets`
 * (the table maximums, say), found by running the real game over every draw:
 * each bet's largest net win and largest net loss, fees included, and the
 * same for all the bets of a round together. Needs dice and infinite-shoe
 * sources, as exact enumeration does.
 */
export function exposure<TChoice extends string, TData, TEvent extends CustomEvent>(
  createGame: () => Game<TChoice, TData, TEvent>,
  bets: Bets,
  strategy?: Strategy<TChoice, TData, TEvent>,
) {
  const perBet: Record<string, { win: number; loss: number }> = {};
  const layout = { win: 0, loss: 0 };
  const rounds = enumerateOutcomes(
    (rng) => playRound(createGame(), bets, rng, strategy).settlement,
  );
  for (const { value: settlement } of rounds) {
    let net = 0;
    for (const [betId, line] of Object.entries(settlement)) {
      const bet = (perBet[betId] ??= { win: 0, loss: 0 });
      bet.win = Math.max(bet.win, line.net);
      bet.loss = Math.max(bet.loss, -line.net);
      net += line.net;
    }
    layout.win = Math.max(layout.win, net);
    layout.loss = Math.max(layout.loss, -net);
  }
  return { stakes: bets, bets: perBet, layout };
}

/**
 * A bet's outcome table, from its paytable and the exact enumeration of the
 * game: each line's chance, what it returns per unit staked (the stake
 * included; a push returns the stake) and its contribution to the RTP, then
 * every other outcome, which loses. Checks that the chances add up to one,
 * the contributions to the enumerated RTP, and their second moment to its
 * variance. A line paid from a jackpot counts its fixed odds only: enumerate
 * with the meter at zero.
 */
export function outcomeTable(paytable: readonly PaytableEntry[], result: ExactReturn) {
  const lines = paytable.map((entry) => ({
    entry: entry.id,
    label: entry.label,
    odds: 'odds' in entry ? entry.odds : undefined,
    probability: result.entries[entry.id] ?? Fraction.ZERO,
    returns:
      'odds' in entry
        ? Fraction.of(entry.odds.to + entry.odds.per, entry.odds.per)
        : 'push' in entry
          ? Fraction.ONE
          : Fraction.ZERO,
  }));
  const settled = lines.reduce((sum, line) => sum.add(line.probability), Fraction.ZERO);
  const rows = [
    ...lines,
    {
      entry: 'lose',
      label: 'Any other outcome',
      odds: undefined,
      probability: Fraction.ONE.sub(settled),
      returns: Fraction.ZERO,
    },
  ];
  const rtp = rows.reduce((sum, row) => sum.add(row.probability.mul(row.returns)), Fraction.ZERO);
  const square = rows.reduce(
    (sum, row) => sum.add(row.probability.mul(row.returns).mul(row.returns)),
    Fraction.ZERO,
  );
  expect(rows.every((row) => row.probability.compare(Fraction.ZERO) >= 0)).toBe(true);
  expect(rtp.equals(result.rtp), `${rtp.toString()} ≠ ${result.rtp.toString()}`).toBe(true);
  expect(square.sub(rtp.mul(rtp)).equals(result.variance)).toBe(true);
  return rows.map((row) => ({
    entry: row.entry,
    label: row.label,
    ...(row.odds === undefined ? {} : { odds: oddsRecord(row.odds) }),
    probability: exact(row.probability),
    returns: exact(row.returns),
    contribution: exact(row.probability.mul(row.returns)),
  }));
}

/** A bet's exact figures, as the Math Report states them. */
export function exactFigures(result: ExactReturn) {
  return {
    rtp: exact(result.rtp),
    houseEdge: exact(Fraction.ONE.sub(result.rtp)),
    hitFrequency: exact(result.hitFrequency),
    pushFrequency: exact(result.pushFrequency),
    variance: exact(result.variance),
    standardDeviation: result.standardDeviation,
  };
}

/** Odds as a record states them: "to" per "per", and what a win returns per unit (stake included). */
export function oddsRecord({ to, per }: Odds) {
  return { to, per, returns: (to + per) / per };
}

/**
 * Records `figures` for the documents as results/<name>.json beside the
 * calling test file, with the test's file and name. Call it last, once the
 * test's assertions have passed: a failing test leaves the record as it was.
 */
export async function recordFigures(name: string, figures: object): Promise<void> {
  const { currentTestName, testPath } = expect.getState();
  if (currentTestName === undefined || testPath === undefined) {
    throw new Error('recordFigures() must be called from inside a test');
  }
  const path = testPath.replace(/\\/g, '/');
  const record = {
    test: {
      file: path.slice(path.lastIndexOf('/packages/') + 1),
      name: currentTestName.split(' > ').join(' › '),
    },
    figures,
  };
  await expect(`${JSON.stringify(record, null, 2)}\n`).toMatchFileSnapshot(`results/${name}.json`);
}
