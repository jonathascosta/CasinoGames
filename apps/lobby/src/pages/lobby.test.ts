import { MIRROR_CONFIG, createMirrorJackpot } from '@casinogames/engine';
import {
  Bankroll,
  RtpTracker,
  SoundEngine,
  createMemoryBackend,
  createSafeStorage,
  createSettingsStore,
  readRtpStats,
  writeJackpotState,
} from '@casinogames/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  const card = (slug: string) =>
    outlet.querySelector<HTMLElement>(`.game-card[data-slug="${slug}"]`)!;
  const button = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (element) => (element.getAttribute('aria-label') ?? element.textContent) === label,
    )!;
  /** A button of the dialog that is open. */
  const dialogButton = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('dialog[open] button')].find(
      (element) => element.textContent === label,
    )!;
  const status = () => outlet.querySelector<HTMLElement>('.house-status')!;
  return { outlet, card, button, dialogButton, status, unmount };
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

describe('lobby cards', () => {
  it('shows each table with its declared RTP, a Play link and a Rules of Play button', () => {
    const { outlet, card } = mount(services());
    expect(
      [...outlet.querySelectorAll('.game-card__name')].map((name) => name.textContent),
    ).toEqual(['Dice Spread', 'Moving Target', 'Mirror', 'Lock & Roll']);
    const rtp = (slug: string) => card(slug).querySelector('.game-card__rtp')!.textContent;
    expect(rtp('dice-spread')).toBe('RTP 96.30%, declared for the main bet, Between');
    expect(rtp('moving-target')).toContain('RTP 96.15%');
    expect(rtp('mirror')).toContain('RTP 94.91%');
    expect(rtp('lock-and-roll')).toBe('RTP 95.93%, declared for the main bet, Lock & Roll');
    const play = card('mirror').querySelector<HTMLAnchorElement>('.game-card__play')!;
    expect(play.getAttribute('href')).toBe('/mirror');
    expect(play.getAttribute('aria-label')).toBe('Play Mirror');
    expect(play.textContent).toBe('Play');
    expect(card('mirror').querySelector('.game-card__sheet')!.getAttribute('aria-label')).toBe(
      'Rules of Play: Mirror',
    );
    expect(card('mirror').getAttribute('aria-labelledby')).toBe('game-mirror');
  });

  it("shows Mirror's progressive meter on its card: the seed before any play", () => {
    const { card } = mount(services());
    expect(card('mirror').querySelector('.game-card__meter')!.textContent).toBe(
      'Progressive5,000.00',
    );
    expect(card('dice-spread').querySelector('.game-card__meter')).toBeNull();
  });

  it('shows the meter as the table left it, and follows it live when another tab plays', () => {
    const page = services();
    const jackpot = createMirrorJackpot();
    for (let round = 0; round < 12; round++) jackpot.contribute(2_500); // +2.50 a round
    writeJackpotState(page.storage, MIRROR_CONFIG.jackpot.id, jackpot.state());
    const { card, unmount } = mount(page);
    const value = () => card('mirror').querySelector('.game-card__meter-value')!.textContent;
    expect(value()).toBe('5,030.00');
    // Another tab plays on: the storage event carries the meter here.
    jackpot.contribute(2_500);
    writeJackpotState(page.storage, MIRROR_CONFIG.jackpot.id, jackpot.state());
    window.dispatchEvent(
      new StorageEvent('storage', { key: `test:jackpot:${MIRROR_CONFIG.jackpot.id}` }),
    );
    expect(value()).toBe('5,032.50');
    unmount();
    jackpot.contribute(2_500);
    writeJackpotState(page.storage, MIRROR_CONFIG.jackpot.id, jackpot.state());
    window.dispatchEvent(
      new StorageEvent('storage', { key: `test:jackpot:${MIRROR_CONFIG.jackpot.id}` }),
    );
    expect(value()).toBe('5,032.50'); // no longer listening
  });

  it('opens the whole Rules of Play in a dialog, from the docs', async () => {
    const { card } = mount(services());
    card('lock-and-roll').querySelector<HTMLButtonElement>('.game-card__sheet')!.click();
    await vi.waitFor(() => {
      expect(document.querySelector('dialog.cg-modal[open]')).not.toBeNull();
    });
    const dialog = document.querySelector('dialog.cg-modal[open]')!;
    expect(dialog.querySelector('h2')!.textContent).toBe('Lock & Roll · Rules of Play');
    expect(dialog.textContent).toContain('Limits. 0.50 to 250.00.');
    // All of it, the live-dealer notes and the rulings included.
    expect(dialog.textContent).toContain('Irregularities');
    // Then where to find the Math Report and every game's documents in one PDF.
    const pdf = [...dialog.querySelectorAll('a')].at(-1)!;
    expect(pdf.textContent).toBe('download the submission pack (PDF)');
    expect(pdf.getAttribute('href')).toBe('/SUBMISSION-PACK.pdf');
  });
});

describe('lobby top bar', () => {
  it('links to the RTP stats and keeps the balance, without the table switches', () => {
    const { outlet } = mount(services());
    const link = outlet.querySelector<HTMLAnchorElement>('.house-link')!;
    expect(link.getAttribute('href')).toBe('/stats');
    expect(link.textContent).toBe('RTP stats');
    expect(outlet.querySelector('.cg-bankroll')).not.toBeNull();
    expect(outlet.querySelector('.topbar [role="switch"]')).toBeNull();
  });

  it('resets the bankroll to 1,000.00 once confirmed, and says so', () => {
    const page = services();
    page.bankroll.debit(250_00);
    const { button, dialogButton, status } = mount(page);
    button('Reset bankroll').click();
    expect(document.querySelector('dialog[open] h2')!.textContent).toBe('Reset the bankroll');
    dialogButton('Cancel').click();
    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(page.bankroll.balance).toBe(750_00);
    button('Reset bankroll').click();
    dialogButton('Reset to 1,000.00').click();
    expect(page.bankroll.balance).toBe(1_000_00);
    expect(status().textContent).toBe('Bankroll reset to 1,000.00.');
  });

  it('resets the RTP stats of every table once confirmed, and leaves the balance', () => {
    const page = services();
    for (const gameId of ['dice-spread', 'lock-and-roll']) {
      const tracker = new RtpTracker({ gameId, storage: page.storage });
      tracker.record({ main: { stake: 100, payout: 0, net: -100, outcome: 'lose' } });
      tracker.flush();
    }
    page.bankroll.debit(100);
    const { button, dialogButton, status } = mount(page);
    button('Reset RTP stats').click();
    expect(readRtpStats(page.storage, 'dice-spread').rounds).toBe(1);
    dialogButton('Reset RTP stats').click();
    expect(readRtpStats(page.storage, 'dice-spread').rounds).toBe(0);
    expect(readRtpStats(page.storage, 'lock-and-roll').rounds).toBe(0);
    expect(page.bankroll.balance).toBe(1_000_00 - 100);
    expect(status().textContent).toBe('RTP stats reset at all four tables.');
  });
});
