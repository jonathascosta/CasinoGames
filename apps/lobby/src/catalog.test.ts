import { GAMES as ENGINE_GAMES } from '@casinogames/engine';
import { describe, expect, it } from 'vitest';
import { GAMES } from './catalog.ts';

describe('catalog', () => {
  it('lists every game the engine registers, in the same order', () => {
    expect(GAMES.map((game) => [game.slug, game.name])).toEqual(
      ENGINE_GAMES.map((game) => [game.id, game.name]),
    );
  });

  it("shows each main bet's declared RTP exactly as the game declares it", () => {
    for (const game of GAMES) {
      const summary = ENGINE_GAMES.find((entry) => entry.id === game.slug)!.mathSummary();
      const main = summary.bets.filter((bet) => bet.kind === 'main');
      expect(main).toHaveLength(1);
      expect(game.mainBet).toBe(main[0]!.label);
      expect(game.rtp).toBe(main[0]!.rtp);
    }
  });
});
