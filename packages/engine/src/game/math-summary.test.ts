import { describe, expect, it } from 'vitest';
import { createDiceFixture } from '../fixtures/dice-fixture.ts';

describe('summarizeMath', () => {
  it('derives the declared figures per bet from the definitions', () => {
    const summary = createDiceFixture().mathSummary();
    expect(summary.gameId).toBe('dice-fixture');
    expect(summary.gameName).toBe('Dice Fixture');
    expect(summary.bets.map(({ betId, kind }) => [betId, kind])).toEqual([
      ['over', 'main'],
      ['doubles', 'side'],
    ]);
    const [over, doubles] = summary.bets;
    expect(over!.rtp).toBeCloseTo(30 / 36, 15);
    expect(over!.houseEdge).toBeCloseTo(6 / 36, 15);
    expect(doubles!.houseEdge).toBeCloseTo(1 / 12, 15);
    expect(over).not.toHaveProperty('standardDeviation');
    expect(over!.paytable[0]).toMatchObject({ id: 'eight-plus', odds: { to: 1, per: 1 } });
  });
});
