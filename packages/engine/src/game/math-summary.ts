import { oddsMultiplier } from './money.ts';
import type {
  BetBreakdown,
  BetDefinition,
  BetMath,
  BreakdownRow,
  DecisionSummary,
  MathSummary,
  PaytableEntry,
  ProgressiveMath,
  ProgressiveTerms,
} from './types.ts';

/**
 * Builds a game's math summary from its bet definitions, so the declared
 * figures shown in the paytable and written to the Math Reports come from one
 * place: the code the tests verify.
 */
export function summarizeMath(game: {
  readonly id: string;
  readonly name: string;
  readonly bets: readonly BetDefinition[];
  /** Names the table's shoe (e.g. "six-deck shoe") when bets declare finite-shoe figures. */
  readonly finiteShoe?: string;
  /** For a game with decisions: its reference strategy and what it returns. */
  readonly decisions?: DecisionSummary;
}): MathSummary {
  if (game.finiteShoe === undefined && game.bets.some((bet) => bet.finiteShoe !== undefined)) {
    throw new TypeError(`${game.id}: bets declare finite-shoe figures, but the shoe is not named`);
  }
  if (game.decisions !== undefined) checkDecisions(game.id, game.decisions);
  return {
    gameId: game.id,
    gameName: game.name,
    bets: game.bets.map(summarizeBet),
    ...(game.finiteShoe === undefined ? {} : { finiteShoe: game.finiteShoe }),
    ...(game.decisions === undefined ? {} : { decisions: game.decisions }),
  };
}

/**
 * A strategy card must be complete and consistent: a value for every choice
 * in every row, the best choice among them (no other choice worth more),
 * situations whose chances add up to 1, and at least the table's figures.
 */
function checkDecisions(gameId: string, { card, figures }: DecisionSummary): void {
  const where = `${gameId}: strategy card`;
  if (card.choices.length < 2 || card.rows.length === 0) {
    throw new TypeError(`${where} needs at least two choices and one situation`);
  }
  let total = 0;
  for (const row of card.rows) {
    const best = row.values[row.best];
    if (row.values.length !== card.choices.length || best === undefined) {
      throw new TypeError(`${where}, ${row.situation}: one value per choice, and a best choice`);
    }
    if (row.values.some((value) => value > best)) {
      throw new TypeError(`${where}, ${row.situation}: the best choice is not the most valuable`);
    }
    total += row.probability;
  }
  if (Math.abs(total - 1) > 1e-9) {
    throw new TypeError(`${where}: the situations' chances add up to ${total}, not 1`);
  }
  if (figures.length === 0) throw new TypeError(`${gameId}: the strategy needs its figures`);
}

function summarizeBet(bet: BetDefinition): BetMath {
  const wins = bet.paytable.filter((entry) => !('push' in entry));
  const pushes = bet.paytable.filter((entry) => 'push' in entry);
  const hitFrequency = sumProbabilities(wins);
  const pushFrequency = pushes.length === 0 ? undefined : sumProbabilities(pushes);
  const maxExposure = wins.some((entry) => 'jackpot' in entry)
    ? undefined
    : Math.max(0, ...wins.map((entry) => ('odds' in entry ? entry.odds.to / entry.odds.per : 0)));
  const breakdown = breakdownOf(bet.paytable);
  const progressive =
    bet.progressive === undefined ? undefined : progressiveMath(bet, bet.progressive);
  return {
    betId: bet.id,
    label: bet.label,
    kind: bet.kind,
    min: bet.min,
    max: bet.max,
    rtp: bet.rtp,
    houseEdge: 1 - bet.rtp,
    ...(bet.standardDeviation === undefined ? {} : { standardDeviation: bet.standardDeviation }),
    ...(hitFrequency === undefined ? {} : { hitFrequency }),
    ...(pushFrequency === undefined ? {} : { pushFrequency }),
    ...(maxExposure === undefined ? {} : { maxExposure }),
    ...(breakdown === undefined ? {} : { breakdown }),
    ...(progressive === undefined ? {} : { progressive }),
    ...(bet.finiteShoe === undefined ? {} : { finiteShoe: bet.finiteShoe }),
    ...(bet.description === undefined ? {} : { description: bet.description }),
    paytable: bet.paytable,
  };
}

/** The sum of the entries' probabilities, or undefined if any entry lacks one. */
function sumProbabilities(entries: readonly PaytableEntry[]): number | undefined {
  let sum = 0;
  for (const entry of entries) {
    if (entry.probability === undefined) return undefined;
    sum += entry.probability;
  }
  return sum;
}

/**
 * Splits a paytable by the condition its lines are paid under. Each value's
 * return is what its lines pay, weighted by their probability given the
 * value; the outcomes not listed lose. Undefined unless every line names a
 * condition and declares a probability, and none pays a jackpot (the pool
 * sets that payout).
 */
function breakdownOf(paytable: readonly PaytableEntry[]): BetBreakdown | undefined {
  const [first] = paytable;
  if (first?.given === undefined) return undefined;
  const rows = new Map<string, { probability: number; lines: PaytableEntry[] }>();
  for (const entry of paytable) {
    if (entry.given === undefined || entry.probability === undefined || 'jackpot' in entry) {
      return undefined;
    }
    const row = rows.get(entry.given.value);
    if (row === undefined) {
      rows.set(entry.given.value, { probability: entry.given.probability, lines: [entry] });
    } else {
      row.lines.push(entry);
    }
  }
  return {
    by: first.given.name,
    rows: [...rows].map(([value, { probability, lines }]): BreakdownRow => {
      let hits = 0;
      let returned = 0;
      for (const line of lines) {
        const p = line.probability ?? 0;
        if ('odds' in line) {
          hits += p;
          returned += p * oddsMultiplier(line.odds);
        } else {
          returned += p;
        }
      }
      const rtp = returned / probability;
      return {
        value,
        probability,
        hitFrequency: hits / probability,
        rtp,
        houseEdge: 1 - rtp,
        paytable: lines,
      };
    }),
  };
}

/**
 * One round's RTP when a hit would pay from a meter of `meter` cents: the
 * fixed pays, plus the meter's share per unit staked (meter ÷ fullShareStake)
 * weighted by the chance of the hit. The meter already holds what earlier
 * stakes contributed, so the contribution rate is not added again.
 */
export function progressiveRtpAtMeter(terms: ProgressiveTerms, meter: number): number {
  return terms.fixedRtp + (terms.hitProbability * meter) / terms.fullShareStake;
}

/**
 * The meter's average value at a hit for a player who stakes `meanStake`
 * cents per round on the bet: the seed plus a cycle's contributions,
 * seed + contributionRate × meanStake ÷ hitProbability. It is exact when
 * every cycle starts at the seed, as it does at the full-share stake, where
 * each hit takes the whole meter. Smaller stakes leave part of the meter
 * behind after a hit, so their average is a little higher.
 */
export function expectedMeterAtHit(terms: ProgressiveTerms, meanStake: number): number {
  return terms.seed + (terms.contributionRate * meanStake) / terms.hitProbability;
}

/** The economics of a progressive bet, from its terms and the line that pays the meter. */
function progressiveMath(bet: BetDefinition, terms: ProgressiveTerms): ProgressiveMath {
  const line = bet.paytable.find(
    (entry) => 'odds' in entry && entry.jackpot?.jackpotId === terms.jackpotId,
  );
  if (line === undefined || !('odds' in line)) {
    throw new TypeError(`${bet.id}: no fixed-odds line pays the ${terms.jackpotId} meter`);
  }
  const cycleRounds = 1 / terms.hitProbability;
  return {
    ...terms,
    fixedOdds: line.odds,
    rtpExcludingSeed: terms.fixedRtp + terms.contributionRate,
    rtpAtSeed: progressiveRtpAtMeter(terms, terms.seed),
    breakEvenMeter: (1 - terms.fixedRtp) * terms.fullShareStake * cycleRounds,
    cycleRounds,
    seedCostPerRound: terms.seed * terms.hitProbability,
    maxExposureAtSeed: line.odds.to / line.odds.per + terms.seed / terms.fullShareStake,
  };
}
