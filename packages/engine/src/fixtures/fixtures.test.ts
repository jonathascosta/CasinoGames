/**
 * Exact math for the test fixtures, computed by running the real fixture code
 * over every possible draw. This is the template each demo game follows: the
 * declared RTP in the bet definitions must equal the enumerated value.
 */
import { describe, expect, it } from 'vitest';
import { Shoe } from '../cards/shoe.ts';
import { exactReturns } from '../math/exact.ts';
import { DICE_FIXTURE_BETS, createDiceFixture } from './dice-fixture.ts';
import { REROLL_FIXTURE_BETS, createRerollFixture, rerollBelowEight } from './reroll-fixture.ts';
import { WAR_FIXTURE_BETS, createWarFixture, raiseOnEightOrBetter } from './war-fixture.ts';

type FixtureBets = typeof DICE_FIXTURE_BETS | typeof WAR_FIXTURE_BETS | typeof REROLL_FIXTURE_BETS;

function declared(bets: FixtureBets, id: string): number {
  return bets.find((bet) => bet.id === id)!.rtp;
}

describe('dice fixture — exact math', () => {
  const report = exactReturns(createDiceFixture, { over: 100, doubles: 100 });

  it('enumerates the 36 rolls', () => {
    expect(report.outcomes).toBe(36);
  });

  it('has exactly the declared RTP per bet', () => {
    expect(report.bets.over!.rtp.toString()).toBe('5/6');
    expect(report.bets.doubles!.rtp.toString()).toBe('11/12');
    expect(report.bets.over!.rtp.toNumber()).toBe(declared(DICE_FIXTURE_BETS, 'over'));
    expect(report.bets.doubles!.rtp.toNumber()).toBe(declared(DICE_FIXTURE_BETS, 'doubles'));
  });

  it('reports hit frequency and volatility', () => {
    expect(report.bets.over!.hitFrequency.toString()).toBe('5/12');
    expect(report.bets.over!.variance.toString()).toBe('35/36');
    expect(report.bets.over!.standardDeviation).toBeCloseTo(Math.sqrt(35 / 36), 12);
    expect(report.bets.doubles!.standardDeviation).toBeCloseTo(5.5 * Math.sqrt(5 / 36), 12);
    expect(report.bets.over!.frequency.toString()).toBe('1');
  });

  it('reports the probability of every paytable entry and of pushes', () => {
    expect(Object.keys(report.bets.over!.entries)).toEqual(['eight-plus']);
    expect(report.bets.over!.entries['eight-plus']!.toString()).toBe('5/12');
    expect(report.bets.doubles!.entries.double!.toString()).toBe('1/6');
    expect(report.bets.over!.pushFrequency.toString()).toBe('0');
  });
});

describe('war fixture — exact math (infinite shoe, raise on 8+)', () => {
  const report = exactReturns(
    () => createWarFixture(new Shoe({ decks: Infinity })),
    { ante: 100 },
    raiseOnEightOrBetter,
  );

  it('enumerates every player and dealer card', () => {
    expect(report.outcomes).toBe(52 * 52);
  });

  it('has exactly the declared RTP per bet, raises included', () => {
    expect(report.bets.ante!.rtp.toString()).toBe('120/169');
    expect(report.bets.play!.rtp.toString()).toBe('20/13');
    expect(report.bets.play!.frequency.toString()).toBe('6/13');
    expect(report.total.rtp.toString()).toBe('240/247');
    expect(report.bets.ante!.rtp.toNumber()).toBe(declared(WAR_FIXTURE_BETS, 'ante'));
    expect(report.bets.play!.rtp.toNumber()).toBe(declared(WAR_FIXTURE_BETS, 'play'));
  });

  it('counts pushes given that the bet is made, and entries per round', () => {
    // Raise (6/13) and tie (1/13): a push per round of 6/169.
    expect(report.bets.ante!.pushFrequency.toString()).toBe('6/169');
    expect(report.bets.play!.pushFrequency.toString()).toBe('1/13');
    expect(report.bets.ante!.entries.higher!.toString()).toBe('57/169');
    expect(report.bets.play!.entries.higher!.toString()).toBe('57/169');
  });
});

describe('re-roll fixture — exact math (re-roll below 8, a fee of 60% of the stake)', () => {
  const report = exactReturns(createRerollFixture, { main: 100 }, rerollBelowEight);
  const main = report.bets.main!;

  it('enumerates every roll, and every re-roll of the 21 rolls below 8', () => {
    expect(report.outcomes).toBe(15 + 21 * 36);
  });

  it('counts the fees against the return, not as stakes', () => {
    expect(main.expectedStake.toString()).toBe('100');
    expect(main.expectedFee.toString()).toBe('35'); // 60¢ in 7/12 of rounds
    expect(main.expectedPayout.toString()).toBe('2375/18'); // 200 × 95/144
    expect(main.rtp.toString()).toBe('349/360');
    expect(main.rtp.toNumber()).toBe(declared(REROLL_FIXTURE_BETS, 'main'));
    expect(report.total.rtp.equals(main.rtp)).toBe(true);
  });

  it('counts a win as the bet paying, whatever the fee', () => {
    expect(main.hitFrequency.toString()).toBe('95/144');
    expect(main.entries.high!.toString()).toBe('95/144');
  });

  it('measures the volatility of the return net of fees', () => {
    // Net per unit: +1 (a winning roll kept), +0.4 or −1.6 (after a re-roll), with no push.
    const outcomes = [
      [15 / 36, 1],
      [(21 / 36) * (15 / 36), 0.4],
      [(21 / 36) * (21 / 36), -1.6],
    ] as const;
    const mean = outcomes.reduce((sum, [p, x]) => sum + p * x, 0);
    const variance = outcomes.reduce((sum, [p, x]) => sum + p * (x - mean) ** 2, 0);
    expect(mean).toBeCloseTo(349 / 360 - 1, 14);
    expect(main.standardDeviation).toBeCloseTo(Math.sqrt(variance), 12);
  });
});
