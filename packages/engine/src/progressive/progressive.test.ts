import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../rng/seeded.ts';
import { randomInt } from '../rng/rng.ts';
import { ProgressiveJackpot, type ProgressiveOptions } from './progressive.ts';

const base: ProgressiveOptions = { id: 'grand', seed: 100_000, contributionRate: 0.015 };

describe('ProgressiveJackpot', () => {
  it('starts at the seed', () => {
    const jackpot = new ProgressiveJackpot(base);
    expect(jackpot.amount).toBe(100_000);
    expect(jackpot.contributionPpm).toBe(15_000);
    expect(jackpot.snapshot()).toEqual({
      id: 'grand',
      amount: 100_000,
      seed: 100_000,
      hits: 0,
      contributed: 0,
      awarded: 0,
      seedFunding: 0,
    });
  });

  it('accrues fractions of a cent exactly', () => {
    const jackpot = new ProgressiveJackpot(base);
    jackpot.contribute(50); // 0.75¢
    expect(jackpot.amount).toBe(100_000);
    jackpot.contribute(50); // 1.5¢
    expect(jackpot.amount).toBe(100_001);
    jackpot.contribute(50);
    jackpot.contribute(50); // 3¢ exactly
    expect(jackpot.amount).toBe(100_003);
    expect(jackpot.snapshot().contributed).toBe(3);
  });

  it('pays the whole pool and resets to the seed on a full award', () => {
    const jackpot = new ProgressiveJackpot(base);
    for (let i = 0; i < 1_000; i++) jackpot.contribute(100); // +1.5¢ each
    expect(jackpot.amount).toBe(101_500);
    expect(jackpot.award()).toBe(101_500);
    expect(jackpot.amount).toBe(100_000);
    expect(jackpot.snapshot()).toMatchObject({ hits: 1, awarded: 101_500, seedFunding: 100_000 });
  });

  it('keeps the leftover fraction of a cent in the pool', () => {
    const jackpot = new ProgressiveJackpot({ ...base, seed: 0 });
    jackpot.contribute(50); // 0.75¢
    jackpot.contribute(100); // 2.25¢
    expect(jackpot.award()).toBe(2);
    expect(jackpot.snapshot().contributed - jackpot.snapshot().awarded).toBeCloseTo(0.25, 12);
    jackpot.contribute(50); // 0.25 + 0.75 = 1¢
    expect(jackpot.amount).toBe(1);
  });

  it('pays a share of the pool without dropping below the seed', () => {
    const jackpot = new ProgressiveJackpot({ ...base, seed: 1_000 });
    for (let i = 0; i < 100; i++) jackpot.contribute(10_000); // +150¢ each → 16,000¢
    expect(jackpot.award(0.1)).toBe(1_600);
    expect(jackpot.amount).toBe(14_400);
    expect(jackpot.award(0.95)).toBe(13_680);
    expect(jackpot.amount).toBe(1_000); // 720¢ left, topped up to the seed
    expect(jackpot.snapshot().seedFunding).toBe(280);
  });

  it('pays a stake its exact share of the meter, down to the cent', () => {
    const jackpot = new ProgressiveJackpot({ id: 'meter', seed: 500_000, contributionRate: 0 });
    // 0.50 of a 25.00 full share: 2% of 5,000.00, exactly 100.00.
    expect(jackpot.awardFraction(50, 2_500)).toBe(10_000);
    expect(jackpot.amount).toBe(500_000); // topped back up to the seed
    expect(jackpot.snapshot().seedFunding).toBe(10_000);
    const growing = new ProgressiveJackpot({ id: 'meter', seed: 100_000, contributionRate: 0.1 });
    growing.contribute(4_007_345); // +400,734.5¢: 500,734.5¢
    // A third of it is 166,911.5¢: the half cent stays in the pool, above the seed.
    expect(growing.awardFraction(1, 3)).toBe(166_911);
    expect(growing.state().pool).toBe(333_823_500_000); // 333,823.5¢ in millionths
    expect(growing.awardFraction(2_500, 2_500)).toBe(333_823);
    expect(growing.amount).toBe(100_000); // 0.5¢ left, topped up to the seed
  });

  it('rejects shares that are not fractions in (0, 1]', () => {
    const jackpot = new ProgressiveJackpot(base);
    expect(() => jackpot.awardFraction(0, 10)).toThrow(RangeError);
    expect(() => jackpot.awardFraction(11, 10)).toThrow(RangeError);
    expect(() => jackpot.awardFraction(1.5, 10)).toThrow(RangeError);
  });

  it('stores its exact state and carries on from it', () => {
    const jackpot = new ProgressiveJackpot(base);
    jackpot.contribute(50); // 0.75¢
    jackpot.contribute(12_345);
    jackpot.award(0.5);
    const restored = new ProgressiveJackpot(base, jackpot.state());
    expect(restored.snapshot()).toEqual(jackpot.snapshot());
    restored.contribute(50);
    jackpot.contribute(50);
    expect(restored.state()).toEqual(jackpot.state());
    // A JSON round trip (what a page stores) keeps every millionth.
    const parsed = JSON.parse(JSON.stringify(jackpot.state())) as ReturnType<typeof jackpot.state>;
    expect(new ProgressiveJackpot(base, parsed).state()).toEqual(jackpot.state());
  });

  it('tops a stored pool below the seed up to it, as seed funding', () => {
    const lower = new ProgressiveJackpot({ ...base, seed: 60_000 });
    lower.contribute(100_000); // 61,500¢
    const raised = new ProgressiveJackpot(base, lower.state()); // seed now 100,000¢
    expect(raised.amount).toBe(100_000);
    expect(raised.snapshot().seedFunding).toBe(38_500);
  });

  it('keeps every total exact past 2^53 millionths of a cent', () => {
    const jackpot = new ProgressiveJackpot(
      { id: 'meter', seed: 500_000, contributionRate: 0.1 },
      {
        pool: 500_000_000_000,
        hits: 0,
        contributed: { cents: 9_007_199_254, micros: 999_999 }, // ~2^53 millionths
        awarded: 0,
        seedFunding: { cents: 0, micros: 0 },
      },
    );
    jackpot.contribute(2_500); // +250¢
    expect(jackpot.state().contributed).toEqual({ cents: 9_007_199_504, micros: 999_999 });
    jackpot.contribute(5); // +0.5¢
    expect(jackpot.state().contributed).toEqual({ cents: 9_007_199_505, micros: 499_999 });
  });

  it.each<[string, object]>([
    ['a negative pool', { pool: -1 }],
    ['a fractional hit count', { hits: 1.5 }],
    ['micros of a whole cent or more', { contributed: { cents: 0, micros: 1_000_000 } }],
    ['a missing total', { seedFunding: undefined }],
    ['a pool above the cap', { pool: 200_000_000_000 }],
  ])('rejects a stored state with %s', (_, override) => {
    const state = { ...new ProgressiveJackpot(base).state(), ...override };
    expect(() => new ProgressiveJackpot({ ...base, cap: 150_000 }, state)).toThrow(RangeError);
  });

  it('stops growing at the cap', () => {
    const jackpot = new ProgressiveJackpot({ ...base, cap: 100_010 });
    for (let i = 0; i < 10; i++) jackpot.contribute(10_000); // would add 1,500¢
    expect(jackpot.amount).toBe(100_010);
    expect(jackpot.snapshot().contributed).toBe(10);
  });

  it('conserves money: seed + contributions + top-ups = awards + pool', () => {
    const rng = createSeededRng('jackpot-ledger');
    const jackpot = new ProgressiveJackpot({ id: 'mini', seed: 5_000, contributionRate: 0.0275 });
    for (let i = 0; i < 20_000; i++) {
      jackpot.contribute(50 * (1 + randomInt(rng, 20)));
      if (randomInt(rng, 500) === 0) jackpot.award(randomInt(rng, 2) === 0 ? 1 : 0.5);
    }
    const s = jackpot.snapshot();
    expect(s.hits).toBeGreaterThan(20);
    // Fractions of a cent still in the pool are not shown by `amount`.
    const pool = s.seed + s.contributed + s.seedFunding - s.awarded;
    expect(pool - s.amount).toBeGreaterThanOrEqual(0);
    expect(pool - s.amount).toBeLessThan(1);
  });

  it.each<[string, Partial<ProgressiveOptions>]>([
    ['a negative seed', { seed: -1 }],
    ['a fractional seed', { seed: 10.5 }],
    ['a cap below the seed', { cap: 99_999 }],
    ['a negative rate', { contributionRate: -0.01 }],
    ['a rate of 100%', { contributionRate: 1 }],
    ['a rate finer than 0.0001%', { contributionRate: 0.0000001 }],
  ])('rejects %s', (_, override) => {
    expect(() => new ProgressiveJackpot({ ...base, ...override })).toThrow(RangeError);
  });

  it('rejects invalid stakes and shares', () => {
    const jackpot = new ProgressiveJackpot(base);
    expect(() => jackpot.contribute(-1)).toThrow(RangeError);
    expect(() => jackpot.contribute(0.5)).toThrow(RangeError);
    expect(() => jackpot.award(0)).toThrow(RangeError);
    expect(() => jackpot.award(1.5)).toThrow(RangeError);
  });
});
