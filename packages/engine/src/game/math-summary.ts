import { oddsMultiplier } from './money.ts';
import type {
  BetBreakdown,
  BetDefinition,
  BetMath,
  BreakdownRow,
  MathSummary,
  PaytableEntry,
} from './types.ts';

/**
 * Builds a game's math summary from its bet definitions, so the declared
 * figures shown in the paytable and written to the game sheets come from one
 * place: the code the tests verify.
 */
export function summarizeMath(game: {
  readonly id: string;
  readonly name: string;
  readonly bets: readonly BetDefinition[];
}): MathSummary {
  return { gameId: game.id, gameName: game.name, bets: game.bets.map(summarizeBet) };
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
