import { parseCardCode } from '@casinogames/engine';
import { describe, expect, it, vi } from 'vitest';
import { SoundEngine } from '../audio/SoundEngine.ts';
import { Motion } from '../motion/motion.ts';
import { CardDealer } from './CardDealer.ts';

async function create() {
  const motion = new Motion({ reducedMotion: false, root: null });
  motion.turbo = true;
  const sound = new SoundEngine();
  const play = vi.spyOn(sound, 'play');
  const host = document.createElement('div');
  const dealer = await CardDealer.create({
    host,
    motion,
    sound,
    renderer: 'dom',
    hands: [
      { id: 'dealer', label: 'Dealer', x: 0.5, y: 0.25 },
      { id: 'player', label: 'Player', x: 0.5, y: 0.7 },
    ],
  });
  const cards = () => [...host.querySelectorAll<HTMLElement>('.cg-dom-card')];
  const announced = () => host.querySelector('[aria-live]')!.textContent;
  return { dealer, host, cards, announced, play };
}

describe('CardDealer', () => {
  it('deals face up by default and announces each card', async () => {
    const { dealer, cards, announced, play } = await create();
    await dealer.deal(parseCardCode('AS'), 'player');
    expect(cards()).toHaveLength(1);
    expect(cards()[0]!.classList.contains('is-face-up')).toBe(true);
    expect(cards()[0]!.getAttribute('aria-label')).toBe('A♠');
    expect(announced()).toBe('Player: A♠');
    expect(play.mock.calls.map(([name]) => name)).toEqual(['card-slide', 'card-flip']);
    expect(dealer.count('player')).toBe(1);
  });

  it('keeps hole cards hidden until revealed', async () => {
    const { dealer, cards, announced } = await create();
    await dealer.deal(parseCardCode('KH'), 'dealer', { faceUp: false });
    expect(cards()[0]!.classList.contains('is-face-up')).toBe(false);
    expect(cards()[0]!.getAttribute('aria-label')).toBe('Face-down card');
    expect(announced()).toBe('Dealer: face-down card');
    await dealer.reveal('dealer', 0, parseCardCode('KH'));
    expect(cards()[0]!.getAttribute('aria-label')).toBe('K♥');
  });

  it('lays out each hand around its anchor', async () => {
    const { dealer, cards } = await create();
    await dealer.deal(parseCardCode('2C'), 'player');
    await dealer.deal(parseCardCode('3C'), 'player');
    expect(cards().map((card) => card.style.getPropertyValue('--slot'))).toEqual(['-0.5', '0.5']);
  });

  it('clears the table and resets the counts', async () => {
    const { dealer, cards } = await create();
    await dealer.deal(parseCardCode('2C'), 'player');
    await dealer.deal(parseCardCode('9D'), 'dealer');
    await dealer.clear();
    expect(cards()).toHaveLength(0);
    expect(dealer.count('player')).toBe(0);
  });

  it('shows the shoe and plays the shuffle', async () => {
    const { dealer, host, play, announced } = await create();
    dealer.setShoe(210, 312, true);
    const counter = host.querySelector<HTMLElement>('.cg-dom-cards__counter')!;
    expect(counter.textContent).toBe('210 / 312');
    expect(counter.dataset.cut).toBe('true');
    await dealer.shuffle();
    expect(play).toHaveBeenCalledWith('shuffle');
    expect(announced()).toBe('Shuffling the shoe');
    dealer.setShoe(Infinity, Infinity);
    expect(counter.hidden).toBe(true);
  });

  it('rejects unknown hands', async () => {
    const { dealer } = await create();
    await expect(dealer.deal(parseCardCode('2C'), 'nobody')).rejects.toThrow(RangeError);
    expect(dealer.count('nobody')).toBe(0);
  });
});
