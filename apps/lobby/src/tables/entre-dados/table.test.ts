import {
  createEntreDados,
  createEntreDadosShoe,
  createSeededRng,
  type Bets,
} from '@casinogames/engine';
import {
  Bankroll,
  Motion,
  RtpTracker,
  SoundEngine,
  createMemoryBackend,
  createSafeStorage,
  createSettingsStore,
} from '@casinogames/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Services } from '../../services.ts';
import { EntreDadosTable } from './table.ts';

const tables: EntreDadosTable[] = [];

afterEach(() => {
  for (const table of tables.splice(0)) table.destroy();
  document.body.replaceChildren();
});

async function setup(seed = 'table', initial = 1_000_00) {
  const storage = createSafeStorage('test', createMemoryBackend());
  const services: Services = {
    storage,
    settings: createSettingsStore(storage),
    bankroll: new Bankroll({ storage, initial }),
    sound: new SoundEngine(),
  };
  const motion = new Motion({ reducedMotion: false, root: null });
  motion.turbo = true;
  const tracker = new RtpTracker({ gameId: 'entre-dados' });
  const table = new EntreDadosTable({
    services,
    tracker,
    motion,
    renderer: 'dom',
    rng: createSeededRng(seed),
  });
  tables.push(table);
  document.body.append(table.element);
  await table.ready;
  const spot = (bet: string) =>
    table.element.querySelector<HTMLButtonElement>(`[data-bet="${bet}"] .cg-bet-spot`)!;
  const roll = table.element.querySelector<HTMLButtonElement>('.ed-actions__roll')!;
  const caption = () => table.element.querySelector('.ed-strip__caption')!.textContent;
  return { table, services, tracker, spot, roll, caption };
}

/** The same round played directly on the engine, for comparison. */
function expectedRound(seed: string, bets: Bets) {
  return createEntreDados({ source: createEntreDadosShoe() }).start(bets, createSeededRng(seed));
}

describe('EntreDadosTable', () => {
  it('opens with 1.00 on Entre and the dice ready to roll', async () => {
    const { spot, roll, caption, table } = await setup();
    expect(table.phase).toBe('betting');
    expect(spot('entre').getAttribute('aria-label')).toMatch(/^Entre: 1\.00\./);
    expect(roll.disabled).toBe(false);
    expect(caption()).toBe('Tap the dice or press Roll.');
    expect(table.element.querySelector('.ed-bet__amount')!.textContent).toBe('1.00');
  });

  it('plays a round exactly as the engine settles it and pays it out', async () => {
    const { table, services, tracker, spot, caption } = await setup('round');
    spot('exato').click(); // keyboard-style activation adds the selected 1.00 chip
    spot('dobros').click();
    const bets = { entre: 100, exato: 100, dobros: 100 };
    const expected = expectedRound('round', bets);

    await table.play();

    const payout = Object.values(expected.settlement).reduce((sum, line) => sum + line.payout, 0);
    expect(services.bankroll.balance).toBe(1_000_00 - 300 + payout);
    expect(tracker.stats.rounds).toBe(1);
    expect(tracker.stats.returned).toBe(payout);
    for (const [betId, line] of Object.entries(expected.settlement)) {
      expect(spot(betId).dataset.result, betId).toBe(line.outcome);
    }
    const revealed = expected.events.find((event) => event.type === 'card-revealed');
    const rank = revealed?.type === 'card-revealed' ? revealed.card.rank : 0;
    const hit = table.element.querySelector<HTMLElement>('.ed-strip__cell[data-hit]')!;
    expect(hit.dataset.value).toBe(String(rank));
    expect(hit.dataset.hit).toBe(expected.settlement.entre!.outcome);
    expect(caption()).toMatch(/^Card [A2-6] · Entre (wins|pushes|loses) · /);
    expect(table.phase).toBe('betting');
  });

  it('turns the dealt card over: an ace to six', async () => {
    const { table } = await setup('face');
    await table.play();
    const card = table.element.querySelector<HTMLElement>('.cg-dom-card')!;
    expect(card.classList.contains('is-face-up')).toBe(true);
    expect(card.getAttribute('aria-label')).toMatch(/^[A2-6][♠♥♦♣]$/);
  });

  it('keeps side bets waiting for Entre, and bets within the balance', async () => {
    const { spot, roll, caption, table } = await setup('rules', 1_50);
    const selected = () =>
      table.element
        .querySelector('.cg-chip-rail [aria-checked="true"]')!
        .getAttribute('aria-label');
    // Only 0.50 is left after the opening 1.00 on Entre: the rail steps down.
    expect(selected()).toBe('0.50 chip');
    spot('entre').dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(roll.disabled).toBe(true);
    expect(caption()).toBe('Place a bet on Entre, then roll the dice.');
    spot('exato').click();
    expect(caption()).toBe('Side bets ride on Entre: add a chip to Entre.');
    spot('entre').click();
    expect(roll.disabled).toBe(false);
    spot('triplo').click(); // 1.50 staked: the whole balance
    spot('dobros').click();
    expect(caption()).toBe('Your balance does not cover another chip.');
    expect(spot('dobros').getAttribute('aria-label')).toMatch(/^Dobros: no bet\./);
    expect(table.element.querySelector('.ed-bet__amount')!.textContent).toBe('1.50');
  });

  it('pays out a round interrupted by leaving the table', async () => {
    const { table, services, tracker } = await setup('leave');
    const expected = expectedRound('leave', { entre: 100 });
    const payout = expected.settlement.entre!.payout;
    const playing = table.play();
    table.destroy();
    await playing;
    expect(services.bankroll.balance).toBe(1_000_00 - 100 + payout);
    expect(tracker.stats.rounds).toBe(1);
  });

  it('autoplays rounds and stops when the balance cannot cover the bet', async () => {
    const { table, services, tracker } = await setup('auto', 3_00);
    const toggle = table.element.querySelector<HTMLButtonElement>('.cg-autoplay__toggle')!;
    toggle.click();
    table.element.querySelector<HTMLButtonElement>('.cg-autoplay__choice')!.click();
    await vi.waitFor(() => {
      expect(table.element.querySelector('.cg-autoplay')!.getAttribute('data-running')).toBe(
        'false',
      );
    });
    expect(tracker.stats.rounds).toBeGreaterThan(0);
    expect(tracker.stats.rounds).toBeLessThanOrEqual(10);
    expect(services.bankroll.balance).toBe(3_00 - tracker.stats.staked + tracker.stats.returned);
    if (tracker.stats.rounds < 10) expect(services.bankroll.balance).toBeLessThan(100);
  });
});
