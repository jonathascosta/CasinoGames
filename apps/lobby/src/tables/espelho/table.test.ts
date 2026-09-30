import {
  ESPELHO_CONFIG,
  compareHands,
  createEspelho,
  createEspelhoJackpot,
  createEspelhoShoe,
  createSeededRng,
  readHand,
  type Bets,
  type Card,
  type HandValues,
} from '@casinogames/engine';
import {
  Bankroll,
  Motion,
  RtpTracker,
  SoundEngine,
  createMemoryBackend,
  createSafeStorage,
  createSettingsStore,
  readJackpotState,
  storedMeterAmount,
  type SafeStorage,
} from '@casinogames/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Services } from '../../services.ts';
import { jackpotTitle } from './felt.ts';
import { EspelhoTable } from './table.ts';

const { seed: SEED, id: JACKPOT } = ESPELHO_CONFIG.jackpot;
const tables: EspelhoTable[] = [];

afterEach(() => {
  for (const table of tables.splice(0)) table.destroy();
  document.body.replaceChildren();
});

/** A table in turbo mode (cards deal instantly) on the DOM renderer, with a seeded RNG. */
async function setup(seed = 'table', initial = 1_000_00, storage?: SafeStorage) {
  const store = storage ?? createSafeStorage('test', createMemoryBackend());
  const services: Services = {
    storage: store,
    settings: createSettingsStore(store),
    bankroll: new Bankroll({ storage: store, initial }),
    sound: new SoundEngine(),
  };
  const motion = new Motion({ reducedMotion: false, root: null });
  motion.turbo = true;
  const tracker = new RtpTracker({ gameId: 'espelho' });
  const table = new EspelhoTable({
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
  const caption = () => q('.es-caption').textContent;
  return { table, services, tracker, spot, roll, caption, q, button, storage: store };
}

/** The same round played directly on the engine, from a meter at the seed, for comparison. */
function expectedRound(seed: string, bets: Bets) {
  const game = createEspelho({ source: createEspelhoShoe(), jackpot: createEspelhoJackpot() });
  return { game, state: game.start(bets, createSeededRng(seed)) };
}

describe('EspelhoTable', () => {
  it('opens with 1.00 on Espelho, both hands unread and the meter at its seed', async () => {
    const { spot, roll, caption, q, table } = await setup();
    expect(table.phase).toBe('betting');
    expect(spot('espelho').getAttribute('aria-label')).toMatch(/^Espelho: 1\.00\./);
    expect(roll.disabled).toBe(false);
    expect(caption()).toBe('Tap the dice or press Roll.');
    expect(q('.es-mirror').dataset.tilt).toBe('none');
    expect(q('.cg-meter__value').textContent).toBe('5,000.00');
    // The meter sits at the top of the felt, and the jackpot spot's tooltip explains it.
    expect(q('.es-felt').firstElementChild!.contains(q('.cg-meter'))).toBe(true);
    expect(spot('seis-seis').title).toBe(jackpotTitle(SEED));
    expect(spot('seis-seis').title).toBe(
      'Meter 5,000.00 · seed 5,000.00 · 10% of every stake on this bet feeds it · a hit pays ' +
        'stake ÷ 25.00 of it',
    );
    expect(table.meters[JACKPOT]!.get()).toBe(SEED);
  });

  it('plays a round exactly as the engine settles it: hands, tilt, payouts and meter', async () => {
    const { table, services, tracker, spot, caption, q, storage } = await setup('round');
    for (const bet of ['empate', 'somas-iguais', 'par-vs-par', 'espelho-perfeito', 'seis-seis']) {
      spot(bet).click(); // keyboard-style activation adds the selected 1.00 chip
    }
    const bets = Object.fromEntries(
      ['espelho', 'empate', 'somas-iguais', 'par-vs-par', 'espelho-perfeito', 'seis-seis'].map(
        (bet) => [bet, 100],
      ),
    );
    const { game, state } = expectedRound('round', bets);

    await table.play();

    const payout = Object.values(state.settlement).reduce((sum, line) => sum + line.payout, 0);
    expect(services.bankroll.balance).toBe(1_000_00 - 600 + payout);
    expect(tracker.stats.rounds).toBe(1);
    expect(tracker.stats.returned).toBe(payout);
    for (const [betId, line] of Object.entries(state.settlement)) {
      expect(spot(betId).dataset.result, betId).toBe(line.outcome);
    }
    // The hands the engine dealt, read and compared the same way.
    const rolled = state.events.find((event) => event.type === 'dice-rolled');
    const dice = (rolled?.type === 'dice-rolled' ? rolled.dice : [1, 1]) as HandValues;
    const cards: Card[] = state.events.flatMap((event) =>
      event.type === 'card-revealed' ? [event.card] : [],
    );
    const dealt: HandValues = [cards[0]!.rank, cards[1]!.rank];
    const [dealer, player] = [...table.element.querySelectorAll('.es-hand__value')].map(
      (element) => element.textContent,
    );
    expect(player).toBe(readHand(dice).label);
    expect(dealer).toBe(readHand(dealt).label);
    const result = compareHands(dice, dealt);
    expect(q('.es-mirror').dataset.tilt).toBe(result > 0 ? 'dice' : result < 0 ? 'cards' : 'level');
    expect(table.element.querySelectorAll('.cg-dom-card.is-face-up')).toHaveLength(2);
    expect(caption()).toContain(`${readHand(dice).label} against ${readHand(dealt).label}`);
    // The meter took the 0.10 contribution, is shown, and is stored.
    expect(game.jackpot.amount).toBe(SEED + 10);
    expect(q('.cg-meter__value').textContent).toBe('5,000.10');
    expect(table.meters[JACKPOT]!.get()).toBe(SEED + 10);
    expect(readJackpotState(storage, JACKPOT)).toEqual(game.jackpot.state());
    expect(table.phase).toBe('betting');
  });

  it('pays a 6-6 vs 6-6 hit its whole meter at 25.00, and the house re-seeds it', async () => {
    // This seed's first round deals 6-6 against 6-6 from a fresh shoe.
    const { table, services, spot, button, caption, q } = await setup('espelho-hit-321');
    button('.cg-chip-rail [role="radio"]:nth-child(4)').click(); // the 25.00 chip
    spot('seis-seis').click();
    const { state } = expectedRound('espelho-hit-321', { espelho: 100, 'seis-seis': 2_500 });
    const hit = state.settlement['seis-seis']!;
    // 1000 to 1 on 25.00, and the whole meter: 5,000.00 plus this stake's 2.50.
    expect(hit.payout).toBe(2_500 + 2_500_000 + 500_250);

    await table.play();

    expect(spot('seis-seis').dataset.result).toBe('win');
    expect(caption()).toContain('6-6 vs 6-6 takes 5,002.50 from the meter');
    expect(table.meters[JACKPOT]!.get()).toBe(SEED);
    expect(q('.cg-meter').classList.contains('is-paid')).toBe(true);
    const payout = Object.values(state.settlement).reduce((sum, line) => sum + line.payout, 0);
    expect(services.bankroll.balance).toBe(1_000_00 - 2_600 + payout);
  });

  it('carries the meter on at the next table, and shows it in the lobby', async () => {
    const first = await setup('carry');
    first.spot('seis-seis').click();
    await first.table.play();
    await first.table.play();
    expect(first.table.meters[JACKPOT]!.get()).toBe(SEED + 20);
    first.table.destroy();
    const again = await setup('carry', 1_000_00, first.storage);
    expect(again.table.meters[JACKPOT]!.get()).toBe(SEED + 20);
    expect(again.q('.cg-meter__value').textContent).toBe('5,000.20');
    expect(storedMeterAmount(first.storage, JACKPOT, SEED)).toBe(SEED + 20);
  });

  it('starts the meter at its seed when the stored state is unusable', async () => {
    const storage = createSafeStorage('test', createMemoryBackend());
    storage.write(`jackpot:${JACKPOT}`, { pool: 1, hits: -3 });
    const { table } = await setup('broken', 1_000_00, storage);
    expect(table.meters[JACKPOT]!.get()).toBe(SEED);
  });

  it('keeps side bets waiting for Espelho, and bets within the balance', async () => {
    const { spot, roll, caption, q } = await setup('rules', 1_50);
    spot('espelho').dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(roll.disabled).toBe(true);
    expect(caption()).toBe('Place a bet on Espelho, then roll the dice.');
    spot('seis-seis').click();
    expect(caption()).toBe('Side bets ride on Espelho: add a chip to Espelho.');
    spot('espelho').click();
    expect(roll.disabled).toBe(false);
    spot('empate').click(); // 1.50 staked: the whole balance
    expect(q('.tb-bet__amount').textContent).toBe('1.50');
  });

  it('pays out a round interrupted by leaving the table, and keeps the meter', async () => {
    const { table, services, tracker, spot, storage } = await setup('leave');
    spot('seis-seis').click();
    const { game, state } = expectedRound('leave', { espelho: 100, 'seis-seis': 100 });
    const playing = table.play();
    table.destroy();
    await playing;
    const payout = Object.values(state.settlement).reduce((sum, line) => sum + line.payout, 0);
    expect(services.bankroll.balance).toBe(1_000_00 - 200 + payout);
    expect(tracker.stats.rounds).toBe(1);
    expect(readJackpotState(storage, JACKPOT)).toEqual(game.jackpot.state());
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
