import { describe, expect, it } from 'vitest';
import { Mirror } from './mirror.ts';

function view(mirror: Mirror) {
  const hands = [...mirror.element.querySelectorAll<HTMLElement>('.es-hand')];
  return {
    // The dealer's hand is above the glass, the player's below it.
    dealer: () => hands[0]!.querySelector('.es-hand__value')!.textContent,
    player: () => hands[1]!.querySelector('.es-hand__value')!.textContent,
    kinds: () => hands.map((hand) => hand.dataset.kind),
    verdict: () => mirror.element.querySelector('.es-glass__verdict')!.textContent,
  };
}

describe('Mirror', () => {
  it('puts the cards above the glass and the dice below it, both hands unread', () => {
    const mirror = new Mirror();
    const { dealer, player, verdict } = view(mirror);
    const halves = [...mirror.element.children].map((child) => child.className);
    expect(halves).toEqual(['es-half es-half--cards', 'es-glass', 'es-half es-half--dice']);
    expect(mirror.cardHost.closest('.es-half--cards')).not.toBeNull();
    expect(mirror.diceHost.closest('.es-half--dice')).not.toBeNull();
    expect([dealer(), player(), verdict(), mirror.tilt]).toEqual(['—', '—', 'vs', 'none']);
  });

  it('reads both hands the same way: a pair, or a sum with its high value', () => {
    const mirror = new Mirror();
    const { dealer, player, kinds } = view(mirror);
    mirror.showDice([4, 4]);
    expect(player()).toBe('PAIR 4s');
    mirror.showCards([6]);
    expect(dealer()).toBe('6 and ?');
    mirror.showCards([6, 3]);
    expect(dealer()).toBe('SUM 9 HIGH 6');
    expect(kinds()).toEqual(['sum', 'pair']);
    expect(mirror.labels).toEqual(['PAIR 4s', 'SUM 9 HIGH 6']);
  });

  it('tilts toward the winner once both hands are known; a tie stays level and loses', () => {
    const mirror = new Mirror();
    const { verdict } = view(mirror);
    expect(mirror.settle([4, 4], [6, 3])).toBe('dice');
    expect([mirror.element.dataset.tilt, verdict()]).toEqual(['dice', 'Your dice win']);
    expect(mirror.settle([6, 3], [4, 5])).toBe('dice'); // sum 9 each: high 6 beats high 5
    expect(mirror.settle([2, 1], [1, 1])).toBe('cards');
    expect(verdict()).toBe("The dealer's cards win");
    expect(mirror.settle([3, 5], [5, 3])).toBe('level');
    expect(verdict()).toBe('Tie · house wins');
  });

  it('clears for the next round and narrates in a live region', () => {
    const mirror = new Mirror();
    mirror.showDice([1, 2]);
    mirror.settle([1, 2], [3, 3]);
    mirror.reset();
    expect([mirror.tilt, view(mirror).player()]).toEqual(['none', '—']);
    mirror.say('Tap the dice or press Roll.');
    expect(mirror.caption.textContent).toBe('Tap the dice or press Roll.');
    expect(mirror.caption.getAttribute('aria-live')).toBe('polite');
  });
});
