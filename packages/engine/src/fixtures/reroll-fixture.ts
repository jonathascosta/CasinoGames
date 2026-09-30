/**
 * Test-only toy game — NOT one of the demo's games. Exercises decisions that
 * cost a fee:
 *  1. The player rolls two dice; a total of 8 or more wins 1 to 1.
 *  2. After the roll the player keeps the dice, re-rolls both for a fee of
 *     60% of the stake, or re-rolls and raises (a second unit of stake, and
 *     the fee).
 *
 * The strategy "re-roll below 8" is optimal. It pays the fee in 7/12 of
 * rounds and wins 95/144 of them: RTP = 95/72 − 0.6 × 7/12 = 349/360 (see
 * fixtures.test.ts).
 */
import { diceTotal, type DicePair } from '../dice/dice.ts';
import { summarizeMath } from '../game/math-summary.ts';
import { odds } from '../game/money.ts';
import { continueRound, startRound } from '../game/round.ts';
import type { Game, RoundState } from '../game/types.ts';
import { defineBets } from '../game/validation.ts';

export type RerollChoice = 'keep' | 'reroll' | 'raise';

export type RerollState = RoundState<RerollChoice, DicePair>;

const EVEN = odds(1);

export const REROLL_FIXTURE_BETS = defineBets([
  {
    id: 'main',
    label: 'Eight or more',
    kind: 'main',
    min: 100,
    max: 10_000,
    rtp: 349 / 360,
    paytable: [{ id: 'high', label: 'Total 8–12', odds: EVEN, probability: 95 / 144 }],
  },
]);

/** The fee for a re-roll: 60% of the stake, rounded up to the cent. */
export function rerollFee(stake: number): number {
  return Math.ceil((stake * 3) / 5);
}

export function createRerollFixture(): Game<RerollChoice, DicePair> {
  const game: Game<RerollChoice, DicePair> = {
    id: 'reroll-fixture',
    name: 'Re-roll Fixture',
    bets: REROLL_FIXTURE_BETS,
    start(bets, rng) {
      const round = startRound<RerollChoice, DicePair>(game, bets, rng);
      const dice = round.rollDice();
      const stake = round.stakeOf('main');
      const fee = { betId: 'main', amount: rerollFee(stake) };
      return round.awaitDecision(
        [
          { choice: 'keep', label: 'Keep' },
          { choice: 'reroll', label: 'Re-roll', fee },
          {
            choice: 'raise',
            label: 'Re-roll and raise',
            fee,
            additionalStake: { betId: 'main', amount: stake },
          },
        ],
        dice,
      );
    },
    decide(state, choice) {
      const round = continueRound(state, choice);
      const dice = choice === 'keep' ? state.data : round.rollDice();
      if (diceTotal(dice) >= 8) round.win('main', EVEN, 'high');
      else round.lose('main');
      return round.finish(dice);
    },
    mathSummary: () => summarizeMath(game),
  };
  return game;
}

/** The fixture's reference strategy, which is optimal: re-roll below 8. */
export function rerollBelowEight(state: RerollState): RerollChoice {
  return diceTotal(state.data) >= 8 ? 'keep' : 'reroll';
}
