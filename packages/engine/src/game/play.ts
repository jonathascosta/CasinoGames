import type { Rng } from '../rng/rng.ts';
import type { Bets, CustomEvent, Game, RoundState } from './types.ts';

/** Picks the choice for a round that awaits a decision (autoplay, simulations). */
export type Strategy<TChoice extends string, TData, TEvent extends CustomEvent> = (
  state: RoundState<TChoice, TData, TEvent>,
) => TChoice;

const MAX_DECISIONS = 1_000;

/**
 * Plays one round to settlement: start(), then decide() with `strategy` for
 * as long as the round awaits a decision.
 */
export function playRound<TChoice extends string, TData, TEvent extends CustomEvent>(
  game: Game<TChoice, TData, TEvent>,
  bets: Bets,
  rng: Rng,
  strategy?: Strategy<TChoice, TData, TEvent>,
): RoundState<TChoice, TData, TEvent> {
  let state = game.start(bets, rng);
  for (let decisions = 0; state.phase === 'awaiting-decision'; decisions++) {
    if (strategy === undefined) {
      throw new Error(`${game.id} needs a strategy: the round awaits a decision`);
    }
    if (decisions === MAX_DECISIONS) {
      throw new Error(`${game.id} asked for more than ${MAX_DECISIONS} decisions in one round`);
    }
    state = game.decide(state, strategy(state));
  }
  return state;
}
