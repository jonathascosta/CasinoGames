import { describe, expect, it } from 'vitest';
import type { Rank } from '../../cards/card.ts';
import { DIE_FACES, type DicePair } from '../../dice/dice.ts';
import { oddsLabel } from '../../game/money.ts';
import {
  ENTRE_DADOS_BET_IDS,
  readEntreDadosRoll,
  resolveEntreDadosBet,
  type EntreDadosBetId,
} from './rules.ts';

/** "win 2 to 1 (spread-3)", "push (push)" or "lose". */
function outcomeOf(bet: EntreDadosBetId, dice: DicePair, card: Rank): string {
  const result = resolveEntreDadosBet(bet, dice, card);
  if (result.outcome === 'win') return `win ${oddsLabel(result.odds)} (${result.entryId})`;
  if (result.outcome === 'push') return `push (${result.entryId})`;
  return 'lose';
}

describe('readEntreDadosRoll', () => {
  it('reads the spread, the winning range and the odds', () => {
    expect(readEntreDadosRoll([5, 2])).toEqual({
      low: 2,
      high: 5,
      spread: 3,
      pair: false,
      between: [3, 4],
      entreOdds: { to: 2, per: 1 },
      bullseye: null,
    });
    expect(readEntreDadosRoll([1, 6])).toMatchObject({ spread: 5, between: [2, 3, 4, 5] });
    expect(readEntreDadosRoll([3, 5])).toMatchObject({ spread: 2, between: [4], bullseye: 4 });
  });

  it('has no range and no odds when Entre pushes', () => {
    expect(readEntreDadosRoll([4, 4])).toMatchObject({ spread: 0, pair: true, between: [] });
    expect(readEntreDadosRoll([4, 3])).toMatchObject({ spread: 1, between: [], entreOdds: null });
  });
});

describe('resolveEntreDadosBet', () => {
  it.each<[DicePair, Rank, Record<EntreDadosBetId, string>]>([
    [
      [2, 5],
      3,
      {
        entre: 'win 2 to 1 (spread-3)',
        exato: 'lose',
        'olho-de-boi': 'lose',
        dobros: 'lose',
        triplo: 'lose',
      },
    ],
    [
      [5, 3],
      4,
      {
        entre: 'win 4 to 1 (spread-2)',
        exato: 'lose',
        'olho-de-boi': 'win 22 to 1 (bullseye)',
        dobros: 'lose',
        triplo: 'lose',
      },
    ],
    [
      [1, 6],
      2,
      {
        entre: 'win 1 to 2 (spread-5)',
        exato: 'lose',
        'olho-de-boi': 'lose',
        dobros: 'lose',
        triplo: 'lose',
      },
    ],
    [
      [2, 6],
      5,
      {
        entre: 'win 1 to 1 (spread-4)',
        exato: 'lose',
        'olho-de-boi': 'lose',
        dobros: 'lose',
        triplo: 'lose',
      },
    ],
    [
      [1, 6],
      6,
      {
        entre: 'lose',
        exato: 'win 2 to 1 (match)',
        'olho-de-boi': 'lose',
        dobros: 'lose',
        triplo: 'lose',
      },
    ],
    [
      [2, 5],
      1,
      { entre: 'lose', exato: 'lose', 'olho-de-boi': 'lose', dobros: 'lose', triplo: 'lose' },
    ],
    [
      [3, 4],
      4,
      {
        entre: 'push (push)',
        exato: 'win 2 to 1 (match)',
        'olho-de-boi': 'lose',
        dobros: 'lose',
        triplo: 'lose',
      },
    ],
    [
      [4, 4],
      4,
      {
        entre: 'push (push)',
        exato: 'win 2 to 1 (match)',
        'olho-de-boi': 'lose',
        dobros: 'win 4 to 1 (pair)',
        triplo: 'win 30 to 1 (triple)',
      },
    ],
    [
      [4, 4],
      2,
      {
        entre: 'push (push)',
        exato: 'lose',
        'olho-de-boi': 'lose',
        dobros: 'win 4 to 1 (pair)',
        triplo: 'lose',
      },
    ],
  ])('dice %j, card %i', (dice, card, expected) => {
    const actual = Object.fromEntries(
      ENTRE_DADOS_BET_IDS.map((bet) => [bet, outcomeOf(bet, dice, card)]),
    );
    expect(actual).toEqual(expected);
  });

  it('does not depend on which die is which', () => {
    for (const a of DIE_FACES) {
      for (const b of DIE_FACES) {
        for (const card of DIE_FACES) {
          for (const bet of ENTRE_DADOS_BET_IDS) {
            expect(resolveEntreDadosBet(bet, [a, b], card)).toBe(
              resolveEntreDadosBet(bet, [b, a], card),
            );
          }
        }
      }
    }
  });

  it('agrees with the roll reading on every roll and card', () => {
    for (const a of DIE_FACES) {
      for (const b of DIE_FACES) {
        const roll = readEntreDadosRoll([a, b]);
        for (const card of DIE_FACES) {
          const entre = resolveEntreDadosBet('entre', [a, b], card).outcome;
          const expected =
            roll.entreOdds === null ? 'push' : roll.between.includes(card) ? 'win' : 'lose';
          expect(entre).toBe(expected);
          expect(resolveEntreDadosBet('olho-de-boi', [a, b], card).outcome).toBe(
            card === roll.bullseye ? 'win' : 'lose',
          );
        }
      }
    }
  });
});
