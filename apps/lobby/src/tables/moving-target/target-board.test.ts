import { odds, readMovingTargetDeal, type Target } from '@casinogames/engine';
import { describe, expect, it } from 'vitest';
import { TargetBoard, chanceToEnd, toOne, toOneInWords } from './target-board.ts';

function deal(board: TargetBoard, target: Target, values: number[]): void {
  board.showDeal(readMovingTargetDeal(target, values), values);
}

function view(board: TargetBoard) {
  const q = (selector: string) =>
    board.hero.querySelector(selector) ?? board.readout.querySelector(selector);
  return {
    value: () => q('.mt-target__value')!.textContent,
    pays: () => q('.mt-target__pays')!.textContent,
    total: () => q('.mt-total__value')!.textContent,
    lit: () =>
      [...board.track.querySelectorAll<HTMLElement>('td[data-lit]')].map(
        (cell) => cell.textContent,
      ),
    pips: () =>
      [...board.readout.querySelectorAll<HTMLElement>('.mt-pip')].map(
        (pip) => `${pip.textContent}${pip.hasAttribute('data-on') ? '*' : ''}`,
      ),
    count: () => board.readout.querySelector<HTMLElement>('.mt-count')!.dataset.outlook,
    state: () => board.hero.dataset.state,
  };
}

describe('TargetBoard', () => {
  it('waits for the dice, with the paytable dark', () => {
    const board = new TargetBoard();
    const { value, lit, state } = view(board);
    expect(value()).toBe('?');
    expect(state()).toBe('idle');
    expect(lit()).toEqual([]);
    expect(board.caption).toBe('Place your bets, then roll the dice.');
    expect(
      [...board.track.querySelectorAll('tr:last-child td')].map((td) => td.textContent),
    ).toEqual([
      '7.5:1',
      '7:1',
      '6:1',
      '5.5:1',
      '5:1',
      '4.5:1',
      '4:1',
      '3.5:1',
      '3:1',
      '5:1',
      '5:1',
    ]);
  });

  it('locks the target in and lights its payout', () => {
    const board = new TargetBoard();
    const { value, pays, lit, state, total } = view(board);
    board.lockTarget(9);
    expect(value()).toBe('9');
    expect(state()).toBe('locked');
    expect(pays()).toBe('Exact Hit pays 3.5:1');
    expect(lit()).toEqual(['9', '3.5:1']);
    expect(total()).toBe('0');
    expect(board.caption).toBe('Target 9 · Exact Hit pays 3.5 to 1');
  });

  it('follows the deal: total, card count and the verdict on the target', () => {
    const board = new TargetBoard();
    const { total, pips, count, state } = view(board);
    board.lockTarget(9);
    board.anticipate(0.2);
    expect(state()).toBe('waiting');
    expect(board.hero.style.getPropertyValue('--tension')).toBe('0.20');
    deal(board, 9, [4]);
    expect([total(), board.caption, state()]).toEqual(['4', 'Total 4 · 5 to go', 'dealing']);
    expect(pips()).toEqual(['1*', '2', '3+']);
    expect(count()).toBe('live');
    deal(board, 9, [4, 3]);
    // Two cards leave the total short: a third is certain, and 3+ Cards is won.
    expect(count()).toBe('won');
    deal(board, 9, [4, 3, 2]);
    expect([total(), board.caption, state()]).toEqual(['9', 'Total 9 · on target', 'hit']);
    expect(pips()).toEqual(['1*', '2*', '3+*']);
    deal(board, 9, [4, 3, 5]);
    expect([board.caption, state()]).toEqual(['Total 12 · over by 3', 'over']);
  });

  it('shows the card count past three, and marks 3+ Cards lost when it cannot come', () => {
    const board = new TargetBoard();
    const { pips, count } = view(board);
    board.lockTarget(12);
    deal(board, 12, [1, 1, 1, 9]);
    expect(pips()).toEqual(['1*', '2*', '4*']);
    board.lockTarget(2);
    expect(count()).toBe('lost');
  });

  it('clears for the next round', () => {
    const board = new TargetBoard();
    const { value, lit, state } = view(board);
    board.lockTarget(7);
    board.reset();
    expect([value(), state(), board.caption]).toEqual(['?', 'rolling', 'Rolling…']);
    expect(lit()).toEqual([]);
  });
});

describe('payout helpers', () => {
  it('writes payouts to one and weighs the chance that a card ends the deal', () => {
    expect(toOne(odds(15, 2))).toBe('7.5:1');
    expect(toOneInWords(odds(9, 2))).toBe('4.5 to 1');
    expect(toOne(odds(3))).toBe('3:1');
    expect([1, 5, 10, 11, 12].map(chanceToEnd)).toEqual([1, 0.6, 0.1, 0, 0]);
  });
});
