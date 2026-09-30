import { describe, expect, it } from 'vitest';
import { createDiceFixture } from '../fixtures/dice-fixture.ts';
import { expectedMeterAtHit, progressiveRtpAtMeter, summarizeMath } from './math-summary.ts';
import { odds } from './money.ts';
import type { BetDefinition } from './types.ts';
import { defineBets } from './validation.ts';

/** Pays 499 to 1 plus a stake's share of a 5,000.00 meter fed by 10% of every stake. */
const METER_BET: BetDefinition = {
  id: 'meter',
  label: 'Meter',
  kind: 'side',
  min: 50,
  max: 2_500,
  rtp: 0.6,
  standardDeviation: 20,
  progressive: {
    jackpotId: 'house',
    seed: 500_000,
    contributionRate: 0.1,
    fullShareStake: 2_500,
    hitProbability: 0.001,
    fixedRtp: 0.5,
  },
  finiteShoe: { rtp: 0.58, hitFrequency: 0.0008 },
  paytable: [
    {
      id: 'hit',
      label: 'Hit',
      odds: odds(499),
      jackpot: { jackpotId: 'house', share: 1, fullShareStake: 2_500 },
      probability: 0.001,
    },
  ],
};

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

  it("derives a progressive bet's economics from its terms", () => {
    const summary = summarizeMath({
      id: 'p',
      name: 'P',
      bets: defineBets([METER_BET]),
      finiteShoe: 'test shoe',
    });
    expect(summary.finiteShoe).toBe('test shoe');
    const [bet] = summary.bets;
    expect(bet!.maxExposure).toBeUndefined(); // the meter sets it
    expect(bet!.finiteShoe).toEqual({ rtp: 0.58, hitFrequency: 0.0008 });
    const meter = bet!.progressive!;
    expect(meter.fixedOdds).toEqual({ to: 499, per: 1 });
    expect(meter.rtpExcludingSeed).toBeCloseTo(0.6, 15);
    expect(meter.rtpAtSeed).toBeCloseTo(0.5 + 0.001 * 200, 15); // 200 per unit at the seed
    expect(meter.breakEvenMeter).toBeCloseTo(1_250_000, 6); // 12,500.00: 0.5 = 0.001 × M ÷ 2,500
    expect(meter.cycleRounds).toBeCloseTo(1_000, 9);
    expect(meter.seedCostPerRound).toBeCloseTo(500, 9); // 5.00 per round
    expect(meter.maxExposureAtSeed).toBeCloseTo(699, 12);
    expect(progressiveRtpAtMeter(meter, meter.breakEvenMeter)).toBeCloseTo(1, 12);
    // Seed plus a cycle of contributions: 10% × 1,000 rounds × the mean stake.
    expect(expectedMeterAtHit(meter, 100)).toBeCloseTo(510_000, 6);
    expect(expectedMeterAtHit(meter, 2_500)).toBeCloseTo(750_000, 6);
  });

  it('needs the shoe named when bets declare finite-shoe figures', () => {
    expect(() => summarizeMath({ id: 'p', name: 'P', bets: [METER_BET] })).toThrow(TypeError);
  });
});
