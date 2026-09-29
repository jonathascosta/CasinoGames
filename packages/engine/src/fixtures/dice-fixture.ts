/**
 * Test-only toy game — NOT one of the demo's games. Two dice, no decisions:
 *  - "over" (main, 1 to 1) wins when the total is 8 or more: RTP 30/36.
 *  - "doubles" (side, 9 to 2) wins on any double: RTP 6/36 × 11/2 = 11/12.
 */
import { diceTotal } from '../dice/dice.ts';
import { summarizeMath } from '../game/math-summary.ts';
import { odds } from '../game/money.ts';
import { startRound } from '../game/round.ts';
import type { Game } from '../game/types.ts';
import { defineBets } from '../game/validation.ts';

const OVER = odds(1);
const DOUBLES = odds(9, 2);

export const DICE_FIXTURE_BETS = defineBets([
  {
    id: 'over',
    label: 'Over 7',
    kind: 'main',
    min: 50,
    max: 10_000,
    rtp: 30 / 36,
    paytable: [{ id: 'eight-plus', label: 'Total 8–12', odds: OVER, probability: 15 / 36 }],
  },
  {
    id: 'doubles',
    label: 'Doubles',
    kind: 'side',
    min: 50,
    max: 2_500,
    rtp: 11 / 12,
    paytable: [{ id: 'double', label: 'Any double', odds: DOUBLES, probability: 6 / 36 }],
  },
]);

export function createDiceFixture(): Game {
  const game: Game = {
    id: 'dice-fixture',
    name: 'Dice Fixture',
    bets: DICE_FIXTURE_BETS,
    start(bets, rng) {
      const round = startRound(game, bets, rng);
      const dice = round.rollDice();
      if (diceTotal(dice) >= 8) round.win('over', OVER, 'eight-plus');
      else round.lose('over');
      if (round.isPlaced('doubles')) {
        if (dice[0] === dice[1]) round.win('doubles', DOUBLES, 'double');
        else round.lose('doubles');
      }
      return round.finish(undefined);
    },
    decide() {
      throw new Error('The dice fixture has no decisions');
    },
    mathSummary: () => summarizeMath(game),
  };
  return game;
}
