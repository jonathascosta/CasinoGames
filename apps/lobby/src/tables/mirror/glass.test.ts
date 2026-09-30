import { describe, expect, it } from 'vitest';
import { MirrorGlass } from './glass.ts';

function view(mirror: MirrorGlass) {
  const hands = [...mirror.element.querySelectorAll<HTMLElement>('.mr-hand')];
  return {
    // The dealer's hand is above the glass, the player's below it.
    dealer: () => hands[0]!.querySelector('.mr-hand__value')!.textContent,
    player: () => hands[1]!.querySelector('.mr-hand__value')!.textContent,
    kinds: () => hands.map((hand) => hand.dataset.kind),
    verdict: () => mirror.element.querySelector('.mr-glass__verdict')!.textContent,
  };
}

describe('MirrorGlass', () => {
  it('puts the cards above the glass and the dice below it, both hands unread', () => {
    const mirror = new MirrorGlass();
    const { dealer, player, verdict } = view(mirror);
    const halves = [...mirror.element.children].map((child) => child.className);
    expect(halves).toEqual(['mr-half mr-half--cards', 'mr-glass', 'mr-half mr-half--dice']);
    expect(mirror.cardHost.closest('.mr-half--cards')).not.toBeNull();
    expect(mirror.diceHost.closest('.mr-half--dice')).not.toBeNull();
    expect([dealer(), player(), verdict(), mirror.tilt]).toEqual(['—', '—', 'vs', 'none']);
  });

  it('reads both hands the same way: a pair, or a sum with its high value', () => {
    const mirror = new MirrorGlass();
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
    const mirror = new MirrorGlass();
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
    const mirror = new MirrorGlass();
    mirror.showDice([1, 2]);
    mirror.settle([1, 2], [3, 3]);
    mirror.reset();
    expect([mirror.tilt, view(mirror).player()]).toEqual(['none', '—']);
    mirror.say('Tap the dice or press Roll.');
    expect(mirror.caption.textContent).toBe('Tap the dice or press Roll.');
    expect(mirror.caption.getAttribute('aria-live')).toBe('polite');
  });
});
