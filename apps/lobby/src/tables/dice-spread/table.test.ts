import {
  createDiceSpread,
  createDiceSpreadShoe,
  createSeededRng,
  type Bets,
} from '@casinogames/engine';
import {
  Bankroll,
  CardDealer,
  DiceRoller,
  Motion,
  RtpTracker,
  SoundEngine,
  createMemoryBackend,
  createSafeStorage,
  createSettingsStore,
} from '@casinogames/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Services } from '../../services.ts';
import { DiceSpreadTable } from './table.ts';

const tables: DiceSpreadTable[] = [];

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
  const tracker = new RtpTracker({ gameId: 'dice-spread' });
  const table = new DiceSpreadTable({
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
  const roll = table.element.querySelector<HTMLButtonElement>('.tb-actions__roll')!;
  const caption = () => table.element.querySelector('.ds-strip__caption')!.textContent;
  return { table, services, tracker, spot, roll, caption };
}

/** The same round played directly on the engine, for comparison. */
function expectedRound(seed: string, bets: Bets) {
  return createDiceSpread({ source: createDiceSpreadShoe() }).start(bets, createSeededRng(seed));
}

describe('DiceSpreadTable', () => {
  it("asks for PixiJS on the player's first key or pointer press, once", async () => {
    const roller = vi.spyOn(DiceRoller.prototype, 'enhance');
    const dealer = vi.spyOn(CardDealer.prototype, 'enhance');
    await setup();
    expect(roller).not.toHaveBeenCalled();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(roller).toHaveBeenCalledOnce();
    expect(dealer).toHaveBeenCalledOnce();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(roller).toHaveBeenCalledOnce();
    roller.mockRestore();
    dealer.mockRestore();
  });

  it('opens with 1.00 on Between and the dice ready to roll', async () => {
    const { spot, roll, caption, table } = await setup();
    expect(table.phase).toBe('betting');
    expect(spot('between').getAttribute('aria-label')).toMatch(
      /^Between, card between the dice: 1\.00\./,
    );
    expect(roll.getAttribute('aria-disabled')).toBe('false');
    expect(caption()).toBe('Tap the dice or press Roll.');
    expect(table.element.querySelector('.tb-bet__amount')!.textContent).toBe('1.00');
  });

  it('plays a round exactly as the engine settles it and pays it out', async () => {
    const { table, services, tracker, spot, caption } = await setup('round');
    spot('match').click(); // keyboard-style activation adds the selected 1.00 chip
    spot('doubles').click();
    const bets = { between: 100, match: 100, doubles: 100 };
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
    const hit = table.element.querySelector<HTMLElement>('.ds-strip__cell[data-hit]')!;
    expect(hit.dataset.value).toBe(String(rank));
    expect(hit.dataset.hit).toBe(expected.settlement.between!.outcome);
    expect(caption()).toMatch(/^Card [A2-6] · Between (wins|pushes|loses) · /);
    expect(table.phase).toBe('betting');
  });

  it('turns the dealt card over: an ace to six', async () => {
    const { table } = await setup('face');
    await table.play();
    const card = table.element.querySelector<HTMLElement>('.cg-dom-card')!;
    expect(card.classList.contains('is-face-up')).toBe(true);
    expect(card.getAttribute('aria-label')).toMatch(/^[A2-6][♠♥♦♣]$/);
  });

  it('keeps side bets waiting for Between, and bets within the balance', async () => {
    const { spot, roll, caption, table } = await setup('rules', 1_50);
    const selected = () =>
      table.element
        .querySelector('.cg-chip-rail [aria-checked="true"]')!
        .getAttribute('aria-label');
    // Only 0.50 is left after the opening 1.00 on Between: the rail steps down.
    expect(selected()).toBe('0.50 chip');
    spot('between').dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(roll.getAttribute('aria-disabled')).toBe('true');
    expect(caption()).toBe('Place a bet on Between, then roll the dice.');
    spot('match').click();
    expect(caption()).toBe('Side bets ride on Between: add a chip to Between.');
    spot('between').click();
    expect(roll.getAttribute('aria-disabled')).toBe('false');
    spot('triple').click(); // 1.50 staked: the whole balance
    spot('doubles').click();
    expect(caption()).toBe('Your balance does not cover another chip.');
    expect(spot('doubles').getAttribute('aria-label')).toMatch(/^Doubles, 4:1 · a pair: no bet\./);
    expect(table.element.querySelector('.tb-bet__amount')!.textContent).toBe('1.50');
  });

  it('pays out a round interrupted by leaving the table', async () => {
    const { table, services, tracker } = await setup('leave');
    const expected = expectedRound('leave', { between: 100 });
    const payout = expected.settlement.between!.payout;
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
