import {
  Bankroll,
  RtpTracker,
  SoundEngine,
  createMemoryBackend,
  createSafeStorage,
  createSettingsStore,
} from '@casinogames/ui';
import { afterEach, describe, expect, it } from 'vitest';
import type { Router } from '../router/router.ts';
import type { Services } from '../services.ts';
import { statsPage } from './stats.ts';

const router: Router = {
  path: '/stats',
  href: (path) => path,
  navigate: () => Promise.resolve(),
  start: () => Promise.resolve(),
  destroy: () => undefined,
};

function services(): Services {
  const storage = createSafeStorage('test', createMemoryBackend());
  return {
    storage,
    settings: createSettingsStore(storage),
    bankroll: new Bankroll({ storage, initial: 1_000_00 }),
    sound: new SoundEngine(),
  };
}

/** Rounds recorded at a table, as the table's own tracker stores them. */
function play(page: Services, gameId: string, ...rounds: Parameters<RtpTracker['record']>[0][]) {
  const tracker = new RtpTracker({ gameId, storage: page.storage });
  for (const round of rounds) tracker.record(round);
  tracker.flush();
}

function mount(page: Services) {
  const outlet = document.createElement('div');
  document.body.append(outlet);
  const unmount = statsPage(page, router).mount(outlet);
  const figures = () =>
    Object.fromEntries(
      [...outlet.querySelectorAll('.stats__figure')].map((figure) => [
        figure.querySelector('dt')!.textContent,
        [...figure.querySelectorAll('dd')].map((value) => value.textContent).join(' · '),
      ]),
    );
  const rows = () =>
    [...outlet.querySelectorAll('.stats__table tbody tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent),
    );
  return { outlet, figures, rows, unmount };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('RTP stats page', () => {
  it('says so when nothing has been played, and lists every table', () => {
    const { outlet, rows } = mount(services());
    expect(outlet.querySelector('h1')!.textContent).toBe('RTP stats');
    expect(outlet.querySelector('.stats__empty')!.textContent).toContain('No rounds yet');
    expect(rows()).toEqual([
      ['Dice Spread', '0', '0.00', '—', '—'],
      ['Moving Target', '0', '0.00', '—', '—'],
      ['Mirror', '0', '0.00', '—', '—'],
      ['Lock & Roll', '0', '0.00', '—', '—'],
    ]);
    // Each table's RTP monitor, with a way to play it.
    expect(outlet.querySelectorAll('.stats__game .cg-rtp')).toHaveLength(4);
    expect(outlet.querySelector('a[aria-label="Play Mirror"]')!.getAttribute('href')).toBe(
      '/mirror',
    );
  });

  it('adds up every table, fees included, against what the declared RTPs make of the same stakes', () => {
    const page = services();
    play(page, 'dice-spread', { between: { stake: 100, payout: 300, net: 200, outcome: 'win' } });
    play(page, 'lock-and-roll', {
      'lock-and-roll': { stake: 100, payout: 0, fee: 40, net: -140, outcome: 'lose' },
    });
    const { figures, rows } = mount(page);
    // Expected: 1.00 at 26/27 and 1.00 at 18649/19440, over 2.00 staked.
    expect(figures()).toEqual({
      Rounds: '2',
      Wagered: '2.00',
      Won: '3.00',
      Fees: '0.40',
      Net: '+0.60',
      'Observed RTP': '130.00%',
      'Expected RTP': '96.11% · +33.89 pp observed',
    });
    expect(rows()[0]).toEqual(['Dice Spread', '1', '1.00', '300.00%', '96.30%']);
    expect(rows()[3]).toEqual(['Lock & Roll', '1', '1.00', '−40.00%', '95.93%']);
  });

  it('follows rounds settled in another tab, and a reset from its bar', () => {
    const page = services();
    const { outlet, figures, rows } = mount(page);
    play(page, 'mirror', { mirror: { stake: 200, payout: 400, net: 200, outcome: 'win' } });
    window.dispatchEvent(new StorageEvent('storage', { key: 'test:rtp:mirror' }));
    expect(figures().Rounds).toBe('1');
    expect(rows()[2]).toEqual(['Mirror', '1', '2.00', '200.00%', '94.91%']);

    outlet.querySelector<HTMLButtonElement>('button[aria-label="Reset RTP stats"]')!.click();
    [...document.querySelectorAll<HTMLButtonElement>('dialog[open] button')]
      .find((button) => button.textContent === 'Reset RTP stats')!
      .click();
    expect(outlet.querySelector('.stats__empty')).not.toBeNull();
    expect(rows()[2]).toEqual(['Mirror', '0', '0.00', '—', '—']);
  });
});
