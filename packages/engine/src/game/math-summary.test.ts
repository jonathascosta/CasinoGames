import { describe, expect, it } from 'vitest';
import { createDiceFixture } from '../fixtures/dice-fixture.ts';
import { summarizeMath } from './math-summary.ts';
import { odds } from './money.ts';
import { defineBets } from './validation.ts';

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
    expect(over).not.toHaveProperty('pushFrequency');
    expect(over!.paytable[0]).toMatchObject({ id: 'eight-plus', odds: { to: 1, per: 1 } });
  });

  it('derives hit and push frequency and the max exposure from the paytable', () => {
    const [bet, jackpot, unknown] = summarizeMath({
      id: 'g',
      name: 'G',
      bets: defineBets([
        {
          id: 'a',
          label: 'A',
          kind: 'main',
          min: 50,
          max: 5_000,
          rtp: 0.9,
          paytable: [
            { id: 'big', label: 'Big', odds: odds(4), probability: 0.05 },
            { id: 'half', label: 'Half', odds: odds(1, 2), probability: 0.4 },
            { id: 'even', label: 'Even', push: true, probability: 0.25 },
          ],
        },
        {
          id: 'j',
          label: 'J',
          kind: 'side',
          min: 50,
          max: 500,
          rtp: 0.9,
          paytable: [
            { id: 'pool', label: 'Pool', jackpot: { jackpotId: 'P', share: 1 }, probability: 1e-6 },
            { id: 'small', label: 'Small', odds: odds(9), probability: 0.01 },
          ],
        },
        {
          id: 'u',
          label: 'U',
          kind: 'side',
          min: 50,
          max: 500,
          rtp: 0.9,
          paytable: [{ id: 'w', label: 'W', odds: odds(2) }],
        },
      ]),
    }).bets;
    expect(bet!.hitFrequency).toBeCloseTo(0.45, 15);
    expect(bet!.pushFrequency).toBe(0.25);
    expect(bet!.maxExposure).toBe(4);
    expect(jackpot!.hitFrequency).toBeCloseTo(0.010001, 15);
    expect(jackpot).not.toHaveProperty('maxExposure');
    expect(unknown).not.toHaveProperty('hitFrequency');
    expect(unknown!.maxExposure).toBe(2);
    for (const summary of [bet, jackpot, unknown]) expect(summary).not.toHaveProperty('breakdown');
  });

  it('splits a paytable by the condition its lines are paid under', () => {
    const zone = (value: string, probability: number) => ({ name: 'Zone', value, probability });
    const [bet] = summarizeMath({
      id: 'g',
      name: 'G',
      bets: defineBets([
        {
          id: 'a',
          label: 'A',
          kind: 'main',
          min: 50,
          max: 5_000,
          rtp: 0.85,
          paytable: [
            {
              id: 'low',
              label: 'Low wins',
              odds: odds(2),
              probability: 0.1,
              given: zone('Low', 0.4),
            },
            { id: 'tie', label: 'Low ties', push: true, probability: 0.1, given: zone('Low', 0.4) },
            {
              id: 'high',
              label: 'High wins',
              odds: odds(1, 2),
              probability: 0.3,
              given: zone('High', 0.6),
            },
          ],
        },
      ]),
    }).bets;
    const breakdown = bet!.breakdown!;
    expect(breakdown.by).toBe('Zone');
    expect(breakdown.rows.map((row) => [row.value, row.paytable.map((line) => line.id)])).toEqual([
      ['Low', ['low', 'tie']],
      ['High', ['high']],
    ]);
    const [low, high] = breakdown.rows;
    expect(low!.probability).toBe(0.4);
    expect(low!.hitFrequency).toBeCloseTo(0.25, 15);
    expect(low!.rtp).toBeCloseTo(1, 15);
    expect(low!.houseEdge).toBeCloseTo(0, 15);
    expect(high!.hitFrequency).toBeCloseTo(0.5, 15);
    expect(high!.rtp).toBeCloseTo(0.75, 15);
    expect(high!.houseEdge).toBeCloseTo(0.25, 15);
    // The rows weighted by their chance give the bet's RTP.
    expect(0.4 * low!.rtp + 0.6 * high!.rtp).toBeCloseTo(bet!.rtp, 15);
  });
});
