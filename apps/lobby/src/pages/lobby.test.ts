import { ESPELHO_CONFIG, createEspelhoJackpot } from '@casinogames/engine';
import {
  Bankroll,
  SoundEngine,
  createMemoryBackend,
  createSafeStorage,
  createSettingsStore,
  writeJackpotState,
} from '@casinogames/ui';
import { afterEach, describe, expect, it } from 'vitest';
import type { Router } from '../router/router.ts';
import type { Services } from '../services.ts';
import { lobbyPage } from './lobby.ts';

const router: Router = {
  path: '/',
  href: (path) => path,
  navigate: () => Promise.resolve(),
  start: () => Promise.resolve(),
  destroy: () => undefined,
};

function mount(services: Services) {
  const outlet = document.createElement('div');
  document.body.append(outlet);
  const unmount = lobbyPage(services, router).mount(outlet);
  const card = (slug: string) => outlet.querySelector<HTMLElement>(`.game-card[href="/${slug}"]`)!;
  return { card, unmount };
}

function services(): Services {
  const storage = createSafeStorage('test', createMemoryBackend());
  return {
    storage,
    settings: createSettingsStore(storage),
    bankroll: new Bankroll({ storage, initial: 1_000_00 }),
    sound: new SoundEngine(),
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('lobby', () => {
  it("shows Espelho's progressive meter on its card: the seed before any play", () => {
    const { card } = mount(services());
    expect(card('espelho').querySelector('.game-card__meter')!.textContent).toBe(
      'Progressive5,000.00',
    );
    expect(card('espelho').dataset.playable).toBe('true');
    expect(card('entre-dados').querySelector('.game-card__meter')).toBeNull();
  });

  it('shows the meter as the table left it', () => {
    const page = services();
    const jackpot = createEspelhoJackpot();
    for (let round = 0; round < 12; round++) jackpot.contribute(2_500); // +2.50 a round
    writeJackpotState(page.storage, ESPELHO_CONFIG.jackpot.id, jackpot.state());
    const { card } = mount(page);
    expect(card('espelho').querySelector('.game-card__meter-value')!.textContent).toBe('5,030.00');
  });
});
