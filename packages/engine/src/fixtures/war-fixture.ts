/**
 * Test-only toy game — NOT one of the demo's games. Exercises cards,
 * decisions and additional stakes:
 *  1. The player gets one card face up and a face-down dealer card is dealt.
 *  2. The player folds (ante lost) or raises (a "play" stake equal to the ante).
 *  3. On a raise the dealer card is revealed: higher card wins both bets 1 to 1,
 *     a tie pushes both, lower loses both (ace low).
 *
 * With an infinite A–K shoe and the strategy "raise on 8 or better":
 * ante RTP = 120/169, play RTP = 20/13 (see war-fixture.test.ts).
 */
import type { Card } from '../cards/card.ts';
import type { CardSource } from '../cards/shoe.ts';
import { summarizeMath } from '../game/math-summary.ts';
import { odds } from '../game/money.ts';
import { continueRound, startRound } from '../game/round.ts';
import type { Game, RoundState } from '../game/types.ts';
import { defineBets } from '../game/validation.ts';

export type WarChoice = 'raise' | 'fold';

export interface WarData {
  readonly player: Card;
  readonly dealer: Card;
}

export type WarState = RoundState<WarChoice, WarData>;

const EVEN = odds(1);

export const WAR_FIXTURE_BETS = defineBets([
  {
    id: 'ante',
    label: 'Ante',
    kind: 'main',
    min: 100,
    max: 10_000,
    rtp: 120 / 169,
    paytable: [{ id: 'higher', label: 'Higher card', odds: EVEN }],
  },
  {
    id: 'play',
    label: 'Play',
    kind: 'side',
    min: 100,
    max: 10_000,
    rtp: 20 / 13,
    paytable: [{ id: 'higher', label: 'Higher card', odds: EVEN }],
  },
]);

export function createWarFixture(source: CardSource): Game<WarChoice, WarData> {
  const game: Game<WarChoice, WarData> = {
    id: 'war-fixture',
    name: 'War Fixture',
    bets: WAR_FIXTURE_BETS,
    start(bets, rng) {
      if (bets.play !== undefined && bets.play !== 0) {
        throw new Error('The play bet is only made by raising');
      }
      const round = startRound<WarChoice, WarData>(game, bets, rng);
      round.prepareCards(source);
      const player = round.dealCard(source, 'player');
      const dealer = round.dealCard(source, 'dealer', false);
      return round.awaitDecision(
        [
          {
            choice: 'raise',
            label: 'Raise',
            additionalStake: { betId: 'play', amount: round.stakeOf('ante') },
          },
          { choice: 'fold', label: 'Fold' },
        ],
        { player, dealer },
      );
    },
    decide(state, choice) {
      const round = continueRound(state, choice);
      const { player, dealer } = state.data;
      if (choice === 'fold') {
        round.lose('ante');
        return round.finish(state.data);
      }
      round.revealCard('dealer', 0, dealer);
      for (const betId of ['ante', 'play']) {
        if (player.rank > dealer.rank) round.win(betId, EVEN, 'higher');
        else if (player.rank === dealer.rank) round.push(betId);
        else round.lose(betId);
      }
      return round.finish(state.data);
    },
    mathSummary: () => summarizeMath(game),
  };
  return game;
}

/** The fixture's reference strategy: raise on 8 or better. */
export function raiseOnEightOrBetter(state: WarState): WarChoice {
  return state.data.player.rank >= 8 ? 'raise' : 'fold';
}
