import type { BetDefinition, MathSummary } from './types.ts';

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
  return {
    gameId: game.id,
    gameName: game.name,
    bets: game.bets.map((bet) => ({
      betId: bet.id,
      label: bet.label,
      kind: bet.kind,
      min: bet.min,
      max: bet.max,
      rtp: bet.rtp,
      houseEdge: 1 - bet.rtp,
      ...(bet.standardDeviation === undefined ? {} : { standardDeviation: bet.standardDeviation }),
      paytable: bet.paytable,
    })),
  };
}
