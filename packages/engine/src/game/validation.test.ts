import { describe, expect, it } from 'vitest';
import { DICE_FIXTURE_BETS } from '../fixtures/dice-fixture.ts';
import { EngineError, type EngineErrorCode } from './errors.ts';
import { odds } from './money.ts';
import type { BetDefinition, Bets, PaytableCondition, PaytableEntry } from './types.ts';
import { defineBets, validateBets } from './validation.ts';

function errorCode(fn: () => unknown): EngineErrorCode | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof EngineError) return error.code;
    throw error;
  }
  return undefined;
}

describe('validateBets', () => {
  it('returns the placed bets and drops zero stakes', () => {
    expect(validateBets(DICE_FIXTURE_BETS, { over: 500, doubles: 0 })).toEqual({ over: 500 });
  });

  it('validates a frozen bet map once and returns the same frozen result', () => {
    const bets = Object.freeze({ over: 500, doubles: 0 });
    const first = validateBets(DICE_FIXTURE_BETS, bets);
    expect(first).toEqual({ over: 500 });
    expect(Object.isFrozen(first)).toBe(true);
    expect(validateBets(DICE_FIXTURE_BETS, bets)).toBe(first);
    const open = { over: 500 };
    expect(validateBets(DICE_FIXTURE_BETS, open)).not.toBe(validateBets(DICE_FIXTURE_BETS, open));
    const invalid = Object.freeze({ over: 25 });
    expect(errorCode(() => validateBets(DICE_FIXTURE_BETS, invalid))).toBe('STAKE_BELOW_MIN');
    expect(errorCode(() => validateBets(DICE_FIXTURE_BETS, invalid))).toBe('STAKE_BELOW_MIN');
  });

  it.each<[Bets, EngineErrorCode]>([
    [{}, 'NO_BETS'],
    [{ over: 0 }, 'NO_BETS'],
    [{ nope: 100 }, 'UNKNOWN_BET'],
    [{ over: -100 }, 'INVALID_STAKE'],
    [{ over: 100.5 }, 'INVALID_STAKE'],
    [{ over: Number.NaN }, 'INVALID_STAKE'],
    [{ over: 25 }, 'STAKE_BELOW_MIN'],
    [{ over: 10_050 }, 'STAKE_ABOVE_MAX'],
    [{ doubles: 100 }, 'MAIN_BET_REQUIRED'],
  ])('rejects %j with %s', (bets, code) => {
    expect(errorCode(() => validateBets(DICE_FIXTURE_BETS, bets))).toBe(code);
  });
});

describe('defineBets', () => {
  const valid: BetDefinition = {
    id: 'main',
    label: 'Main',
    kind: 'main',
    min: 50,
    max: 1_000,
    rtp: 0.97,
    paytable: [{ id: 'win', label: 'Win', odds: odds(1) }],
  };

  it('returns valid definitions unchanged', () => {
    const bets = [valid];
    expect(defineBets(bets)).toBe(bets);
  });

  it.each<[string, Partial<BetDefinition>]>([
    ['an empty id', { id: '' }],
    ['a zero minimum', { min: 0 }],
    ['max below min', { max: 10 }],
    ['fractional limits', { min: 50.5 }],
    ['an implausible RTP', { rtp: 0 }],
    ['a non-positive standard deviation', { standardDeviation: 0 }],
    ['an empty paytable', { paytable: [] }],
    [
      'duplicate paytable ids',
      {
        paytable: [
          { id: 'x', label: 'X', odds: odds(1) },
          { id: 'x', label: 'Y', odds: odds(2) },
        ],
      },
    ],
    ['a zero probability', { paytable: [{ id: 'x', label: 'X', odds: odds(1), probability: 0 }] }],
    [
      'probabilities adding up to more than 1',
      {
        paytable: [
          { id: 'x', label: 'X', odds: odds(1), probability: 0.6 },
          { id: 'y', label: 'Y', push: true, probability: 0.5 },
        ],
      },
    ],
  ])('rejects %s', (_, override) => {
    expect(() => defineBets([{ ...valid, ...override }])).toThrow(TypeError);
  });

  describe('progressive bets', () => {
    const meterLine = (fullShareStake = 2_500): PaytableEntry => ({
      id: 'hit',
      label: 'Hit',
      odds: odds(499),
      jackpot: { jackpotId: 'house', share: 1, fullShareStake },
      probability: 0.001,
    });
    const meter: BetDefinition = {
      id: 'meter',
      label: 'Meter',
      kind: 'side',
      min: 50,
      max: 2_500,
      rtp: 0.6,
      progressive: {
        jackpotId: 'house',
        seed: 500_000,
        contributionRate: 0.1,
        fullShareStake: 2_500,
        hitProbability: 0.001,
        fixedRtp: 0.5,
      },
      paytable: [meterLine()],
    };
    const terms = meter.progressive!;

    it('accepts one fixed-odds line paying the meter, with the RTP excluding the seed', () => {
      expect(() => defineBets([meter])).not.toThrow();
    });

    it.each<[string, Partial<BetDefinition>]>([
      ['no line paying the meter', { paytable: [{ id: 'x', label: 'X', odds: odds(499) }] }],
      ['two lines paying it', { paytable: [meterLine(), { ...meterLine(), id: 'again' }] }],
      [
        'a line paying the meter alone',
        {
          paytable: [
            {
              id: 'hit',
              label: 'Hit',
              jackpot: { jackpotId: 'house', share: 1, fullShareStake: 2_500 },
            },
          ],
        },
      ],
      ['a line with another full-share stake', { paytable: [meterLine(5_000)] }],
      ['a full-share stake below the maximum', { max: 5_000 }],
      ['an RTP other than the fixed pays plus the contributions', { rtp: 0.5 }],
      ['a negative seed', { progressive: { ...terms, seed: -1 } }],
      [
        'a contribution rate of 100%',
        { progressive: { ...terms, contributionRate: 1, fixedRtp: -0.4 } },
      ],
      ["a hit chance other than the line's", { progressive: { ...terms, hitProbability: 0.002 } }],
      ['implausible finite-shoe figures', { finiteShoe: { rtp: 0.58, hitFrequency: 0 } }],
    ])('rejects %s', (_, override) => {
      expect(() => defineBets([{ ...meter, ...override }])).toThrow(TypeError);
    });
  });

  describe('lines paid under a condition', () => {
    const target = (value: string, probability: number) => ({ name: 'Target', value, probability });
    const line = (id: string, probability: number, given?: PaytableCondition): PaytableEntry => ({
      id,
      label: id,
      odds: odds(4),
      probability,
      ...(given === undefined ? {} : { given }),
    });

    it('accepts one condition, with lines sharing a value and fitting inside its chance', () => {
      const paytable = [
        line('a', 0.05, target('7', 0.5)),
        { id: 'b', label: 'b', push: true, probability: 0.1, given: target('7', 0.5) } as const,
        line('c', 0.1, target('8', 0.25)),
      ];
      expect(() => defineBets([{ ...valid, paytable }])).not.toThrow();
    });

    it.each<[string, PaytableEntry[]]>([
      ['a line without its condition', [line('a', 0.1, target('7', 0.5)), line('b', 0.1)]],
      [
        'two condition names',
        [line('a', 0.1, target('7', 0.5)), line('b', 0.1, { ...target('8', 0.2), name: 'Spread' })],
      ],
      ['an empty condition name', [line('a', 0.1, { ...target('7', 0.5), name: '' })]],
      ['a zero chance', [line('a', 0.1, target('7', 0))]],
      [
        'lines disagreeing on a value’s chance',
        [line('a', 0.1, target('7', 0.5)), line('b', 0.1, target('7', 0.4))],
      ],
      [
        'lines more likely than their value',
        [line('a', 0.2, target('7', 0.3)), line('b', 0.2, target('7', 0.3))],
      ],
      [
        'values adding up to more than 1',
        [line('a', 0.1, target('7', 0.6)), line('b', 0.1, target('8', 0.6))],
      ],
    ])('rejects %s', (_, paytable) => {
      expect(() => defineBets([{ ...valid, paytable }])).toThrow(TypeError);
    });
  });

  it('rejects duplicate bet ids', () => {
    expect(() => defineBets([valid, valid])).toThrow(TypeError);
  });
});
