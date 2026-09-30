import { describe, expect, it } from 'vitest';
import { Scoreboard } from './scoreboard.ts';

describe('Scoreboard', () => {
  it('shows the two totals side by side as they come', () => {
    const board = new Scoreboard();
    const sides = [...board.element.querySelectorAll('.lr-score__side')].map(
      (side) => side.querySelector('.lr-score__who')!.textContent,
    );
    expect(sides).toEqual(['Your dice', 'Dealer']);
    expect(board.totals).toEqual(['—', '—']);
    board.setDice(7);
    board.setCards([5]);
    expect(board.totals).toEqual(['7', '5 + ?']);
    board.setCards([5, 3]);
    expect(board.totals).toEqual(['7', '8']);
  });

  it('highlights the winner; a tie goes to the house', () => {
    const board = new Scoreboard();
    const verdict = () => board.element.querySelector('.lr-score__verdict')!.textContent;
    expect([board.leader, verdict()]).toEqual(['none', 'vs']);
    expect(board.settle(9, 8)).toBe('dice');
    expect([board.element.dataset.leader, verdict()]).toEqual(['dice', 'Your dice win']);
    expect(board.settle(6, 7)).toBe('cards');
    expect(verdict()).toBe('The dealer wins');
    expect(board.settle(8, 8)).toBe('tie');
    expect(verdict()).toBe('Tie · house wins');
    board.reset();
    expect([board.leader, ...board.totals]).toEqual(['none', '—', '—']);
  });
});
