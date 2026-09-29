/**
 * Exact math for the test fixtures, computed by running the real fixture code
 * over every possible draw. This is the template each demo game follows: the
 * declared RTP in the bet definitions must equal the enumerated value.
 */
import { describe, expect, it } from 'vitest';
import { Shoe } from '../cards/shoe.ts';
import { exactReturns } from '../math/exact.ts';
import { DICE_FIXTURE_BETS, createDiceFixture } from './dice-fixture.ts';
import { WAR_FIXTURE_BETS, createWarFixture, raiseOnEightOrBetter } from './war-fixture.ts';

function declared(bets: typeof DICE_FIXTURE_BETS | typeof WAR_FIXTURE_BETS, id: string): number {
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
    expect(report.bets.over!.standardDeviation).toBeCloseTo(Math.sqrt(35 / 36), 12);
    expect(report.bets.doubles!.standardDeviation).toBeCloseTo(5.5 * Math.sqrt(5 / 36), 12);
    expect(report.bets.over!.frequency.toString()).toBe('1');
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
});
