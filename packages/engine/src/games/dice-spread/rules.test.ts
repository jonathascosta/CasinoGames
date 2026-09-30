import { describe, expect, it } from 'vitest';
import type { Rank } from '../../cards/card.ts';
import { DIE_FACES, type DicePair } from '../../dice/dice.ts';
import { oddsLabel } from '../../game/money.ts';
import {
  DICE_SPREAD_BET_IDS,
  readDiceSpreadRoll,
  resolveDiceSpreadBet,
  type DiceSpreadBetId,
} from './rules.ts';

/** "win 2 to 1 (spread-3)", "push (push)" or "lose". */
function outcomeOf(bet: DiceSpreadBetId, dice: DicePair, card: Rank): string {
  const result = resolveDiceSpreadBet(bet, dice, card);
  if (result.outcome === 'win') return `win ${oddsLabel(result.odds)} (${result.entryId})`;
  if (result.outcome === 'push') return `push (${result.entryId})`;
  return 'lose';
}

describe('readDiceSpreadRoll', () => {
  it('reads the spread, the winning range and the odds', () => {
    expect(readDiceSpreadRoll([5, 2])).toEqual({
      low: 2,
      high: 5,
      spread: 3,
      pair: false,
      between: [3, 4],
      betweenOdds: { to: 2, per: 1 },
      bullseye: null,
    });
    expect(readDiceSpreadRoll([1, 6])).toMatchObject({ spread: 5, between: [2, 3, 4, 5] });
    expect(readDiceSpreadRoll([3, 5])).toMatchObject({ spread: 2, between: [4], bullseye: 4 });
  });

  it('has no range and no odds when Between pushes', () => {
    expect(readDiceSpreadRoll([4, 4])).toMatchObject({ spread: 0, pair: true, between: [] });
    expect(readDiceSpreadRoll([4, 3])).toMatchObject({ spread: 1, between: [], betweenOdds: null });
  });
});

describe('resolveDiceSpreadBet', () => {
  it.each<[DicePair, Rank, Record<DiceSpreadBetId, string>]>([
    [
      [2, 5],
      3,
      {
        between: 'win 2 to 1 (spread-3)',
        match: 'lose',
        bullseye: 'lose',
        doubles: 'lose',
        triple: 'lose',
      },
    ],
    [
      [5, 3],
      4,
      {
        between: 'win 4 to 1 (spread-2)',
        match: 'lose',
        bullseye: 'win 22 to 1 (bullseye)',
        doubles: 'lose',
        triple: 'lose',
      },
    ],
    [
      [1, 6],
      2,
      {
        between: 'win 1 to 2 (spread-5)',
        match: 'lose',
        bullseye: 'lose',
        doubles: 'lose',
        triple: 'lose',
      },
    ],
    [
      [2, 6],
      5,
      {
        between: 'win 1 to 1 (spread-4)',
        match: 'lose',
        bullseye: 'lose',
        doubles: 'lose',
        triple: 'lose',
      },
    ],
    [
      [1, 6],
      6,
      {
        between: 'lose',
        match: 'win 2 to 1 (match)',
        bullseye: 'lose',
        doubles: 'lose',
        triple: 'lose',
      },
    ],
    [
      [2, 5],
      1,
      { between: 'lose', match: 'lose', bullseye: 'lose', doubles: 'lose', triple: 'lose' },
    ],
    [
      [3, 4],
      4,
      {
        between: 'push (push)',
        match: 'win 2 to 1 (match)',
        bullseye: 'lose',
        doubles: 'lose',
        triple: 'lose',
      },
    ],
    [
      [4, 4],
      4,
      {
        between: 'push (push)',
        match: 'win 2 to 1 (match)',
        bullseye: 'lose',
        doubles: 'win 4 to 1 (pair)',
        triple: 'win 30 to 1 (triple)',
      },
    ],
    [
      [4, 4],
      2,
      {
        between: 'push (push)',
        match: 'lose',
        bullseye: 'lose',
        doubles: 'win 4 to 1 (pair)',
        triple: 'lose',
      },
    ],
  ])('dice %j, card %i', (dice, card, expected) => {
    const actual = Object.fromEntries(
      DICE_SPREAD_BET_IDS.map((bet) => [bet, outcomeOf(bet, dice, card)]),
    );
    expect(actual).toEqual(expected);
  });

  it('does not depend on which die is which', () => {
    for (const a of DIE_FACES) {
      for (const b of DIE_FACES) {
        for (const card of DIE_FACES) {
          for (const bet of DICE_SPREAD_BET_IDS) {
            expect(resolveDiceSpreadBet(bet, [a, b], card)).toBe(
              resolveDiceSpreadBet(bet, [b, a], card),
            );
          }
        }
      }
    }
  });

  it('agrees with the roll reading on every roll and card', () => {
    for (const a of DIE_FACES) {
      for (const b of DIE_FACES) {
        const roll = readDiceSpreadRoll([a, b]);
        for (const card of DIE_FACES) {
          const between = resolveDiceSpreadBet('between', [a, b], card).outcome;
          const expected =
            roll.betweenOdds === null ? 'push' : roll.between.includes(card) ? 'win' : 'lose';
          expect(between).toBe(expected);
          expect(resolveDiceSpreadBet('bullseye', [a, b], card).outcome).toBe(
            card === roll.bullseye ? 'win' : 'lose',
          );
        }
      }
    }
  });
});
