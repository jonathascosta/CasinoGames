import type { BetDefinition, BetMath, MathSummary, PaytableEntry } from './types.ts';

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
