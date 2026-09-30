import {
  cardValue,
  createMovingTarget,
  createMovingTargetShoe,
  createSeededRng,
  targetOf,
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
import { MovingTargetTable } from './table.ts';

const tables: MovingTargetTable[] = [];

afterEach(() => {
  for (const table of tables.splice(0)) table.destroy();
  document.body.replaceChildren();
});

/** A table in turbo mode (cards deal instantly) on the DOM renderer, with a seeded RNG. */
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
  const tracker = new RtpTracker({ gameId: 'moving-target' });
  const table = new MovingTargetTable({
    services,
    tracker,
    motion,
    renderer: 'dom',
    rng: createSeededRng(seed),
  });
  tables.push(table);
  document.body.append(table.element);
  await table.ready;
  const q = (selector: string) => table.element.querySelector<HTMLElement>(selector)!;
  const button = (selector: string) => table.element.querySelector<HTMLButtonElement>(selector)!;
  const spot = (bet: string) => button(`[data-bet="${bet}"] .cg-bet-spot`);
  const roll = button('.tb-actions__roll');
  const caption = () => q('.mt-caption').textContent;
  return { table, services, tracker, spot, roll, caption, q, button };
}

/** The same round played directly on the engine, for comparison. */
function expectedRound(seed: string, bets: Bets) {
  return createMovingTarget({ source: createMovingTargetShoe() }).start(
    bets,
    createSeededRng(seed),
  );
}

describe('MovingTargetTable', () => {
  it('opens with 1.00 on Exact Hit, no target yet and the dice ready to roll', async () => {
    const { spot, roll, caption, q, table } = await setup();
    expect(table.phase).toBe('betting');
    expect(spot('exact-hit').getAttribute('aria-label')).toMatch(
      /^Exact Hit, total lands on the target: 1\.00\./,
    );
    expect(roll.getAttribute('aria-disabled')).toBe('false');
    expect(caption()).toBe('Tap the dice or press Roll.');
    expect(q('.mt-target__value').textContent).toBe('?');
    expect(q('.tb-bet__amount').textContent).toBe('1.00');
  });

  it('plays a round exactly as the engine settles it and pays it out', async () => {
    const { table, services, tracker, spot, caption, q } = await setup('round');
    spot('first-card').click(); // keyboard-style activation adds the selected 1.00 chip
    spot('three-plus-cards').click();
    const bets = { 'exact-hit': 100, 'first-card': 100, 'three-plus-cards': 100 };
    const expected = expectedRound('round', bets);

    await table.play();

    const payout = Object.values(expected.settlement).reduce((sum, line) => sum + line.payout, 0);
    expect(services.bankroll.balance).toBe(1_000_00 - 300 + payout);
    expect(tracker.stats.rounds).toBe(1);
    expect(tracker.stats.returned).toBe(payout);
    for (const [betId, line] of Object.entries(expected.settlement)) {
      expect(spot(betId).dataset.result, betId).toBe(line.outcome);
    }
    // The target the engine rolled, locked in and lit; every card it dealt, turned over.
    const rolled = expected.events.find((event) => event.type === 'dice-rolled');
    const target = rolled?.type === 'dice-rolled' ? targetOf(rolled.dice) : 0;
    const cards = expected.events.flatMap((event) =>
      event.type === 'card-dealt' ? [event.card] : [],
    );
    const total = cards.reduce((sum, card) => sum + cardValue(card.rank), 0);
    expect(q('.mt-target__value').textContent).toBe(String(target));
    expect(q('.mt-track td[data-lit]').dataset.target).toBe(String(target));
    expect(q('.mt-total__value').textContent).toBe(String(total));
    const dealt = [...table.element.querySelectorAll('.cg-dom-card')];
    expect(dealt).toHaveLength(cards.length);
    expect(dealt.every((card) => card.classList.contains('is-face-up'))).toBe(true);
    expect(caption()).toMatch(/^Total \d+ · (on target|over by \d+) · /);
    expect(table.phase).toBe('betting');
  });

  it('keeps side bets waiting for Exact Hit, and bets within the balance', async () => {
    const { spot, roll, caption, q } = await setup('rules', 1_50);
    spot('exact-hit').dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(roll.getAttribute('aria-disabled')).toBe('true');
    expect(caption()).toBe('Place a bet on Exact Hit, then roll the dice.');
    spot('three-plus-cards').click();
    expect(caption()).toBe('Side bets ride on Exact Hit: add a chip to Exact Hit.');
    spot('exact-hit').click();
    expect(roll.getAttribute('aria-disabled')).toBe('false');
    spot('first-card').click(); // 1.50 staked: the whole balance
    expect(q('.tb-bet__amount').textContent).toBe('1.50');
  });

  it('pays out a round interrupted by leaving the table', async () => {
    const { table, services, tracker } = await setup('leave');
    const expected = expectedRound('leave', { 'exact-hit': 100 });
    const playing = table.play();
    table.destroy();
    await playing;
    expect(services.bankroll.balance).toBe(
      1_000_00 - 100 + expected.settlement['exact-hit']!.payout,
    );
    expect(tracker.stats.rounds).toBe(1);
  });

  it('autoplays rounds and stops when the balance cannot cover the bet', async () => {
    const { services, tracker, q, button } = await setup('auto', 3_00);
    button('.cg-autoplay__toggle').click();
    button('.cg-autoplay__choice').click();
    await vi.waitFor(() => {
      expect(q('.cg-autoplay').getAttribute('data-running')).toBe('false');
    });
    expect(tracker.stats.rounds).toBeGreaterThan(0);
    expect(tracker.stats.rounds).toBeLessThanOrEqual(10);
    expect(services.bankroll.balance).toBe(3_00 - tracker.stats.staked + tracker.stats.returned);
  });
});
