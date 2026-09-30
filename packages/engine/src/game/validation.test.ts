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
