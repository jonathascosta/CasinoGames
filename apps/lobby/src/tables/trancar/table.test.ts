import {
  createSeededRng,
  createTrancar,
  createTrancarShoe,
  settlementTotals,
  trancarStrategy,
  type TrancarChoice,
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
import { TrancarTable } from './table.ts';

/**
 * Seeds whose first round (the shoe's shuffle, then the roll) the tests know:
 * 5-2 (the strategy locks the 5), 6-3 (it stands), 3-3, 1-4 (it locks the
 * 4) and 1-1 (a free re-roll).
 */
const SEEDS = {
  fiveTwo: 'trancar-0',
  sixThree: 'trancar-1',
  threeThree: 'trancar-2',
  oneFour: 'trancar-6',
  oneOne: 'trancar-13',
} as const;

const tables: TrancarTable[] = [];

afterEach(() => {
  for (const table of tables.splice(0)) table.destroy();
  document.body.replaceChildren();
});

/** A table in turbo mode on the DOM renderers, with a seeded RNG. */
async function setup(seed: string, initial = 1_000_00) {
  const storage = createSafeStorage('test', createMemoryBackend());
  const services: Services = {
    storage,
    settings: createSettingsStore(storage),
    bankroll: new Bankroll({ storage, initial }),
    sound: new SoundEngine(),
  };
  const motion = new Motion({ reducedMotion: false, root: null });
  motion.turbo = true;
  const tracker = new RtpTracker({ gameId: 'trancar' });
  const table = new TrancarTable({
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
  const dice = () => [...table.element.querySelectorAll<HTMLButtonElement>('.cg-die-pick')];
  const ficar = button('.tr-decision__ficar');
  const trancar = button('.tr-decision__trancar');
  const caption = () => q('.tr-caption').textContent;
  /**
   * Starts a round and waits for the decision; the round's promise comes
   * back wrapped, since a promise returned from an async function would be
   * awaited with it.
   */
  const roll = async () => {
    const playing = table.play();
    await vi.waitFor(() => {
      expect(q('.tr-decision').dataset.state).toBe('open');
    });
    return { playing };
  };
  return { table, services, tracker, q, button, dice, ficar, trancar, caption, roll };
}

/** The same first round played on the engine, with the same seed and choice. */
function expected(seed: string, choice: TrancarChoice) {
  const game = createTrancar({ source: createTrancarShoe() });
  const pending = game.start({ trancar: 100 }, createSeededRng(seed));
  return game.decide(pending, choice);
}

describe('TrancarTable', () => {
  it('opens with 1.00 on Trancar: Ficar on the table but idle, Trancar hidden, no hint', async () => {
    const { table, ficar, trancar, caption, q } = await setup(SEEDS.sixThree);
    expect(table.phase).toBe('betting');
    expect(q('[data-bet="trancar"]').getAttribute('aria-label')).toMatch(/^Trancar: 1\.00\./);
    expect(ficar.hidden).toBe(false);
    expect(ficar.disabled).toBe(true);
    expect(trancar.hidden).toBe(true);
    expect(table.decision.hint).toBe(false);
    expect(q('.tr-decision__help [role="switch"]').getAttribute('aria-checked')).toBe('false');
    expect(q('.tr-decision__demo').textContent).toBe('Demo');
    expect(caption()).toBe('Tap the dice or press Roll.');
    expect(table.scoreboard.totals).toEqual(['—', '—']);
    expect(q('.tr-felt__terms').textContent).toBe(
      'Ties loseTrancar costs 40% of the bet1-1 re-rolls free',
    );
  });

  it('waits for the decision after the roll, and Ficar stands on it', async () => {
    const { table, services, tracker, dice, ficar, caption, roll } = await setup(SEEDS.sixThree);
    const { playing } = await roll();
    // The roll is read, the dice are offered, and nothing more is dealt or taken.
    expect(table.scoreboard.totals).toEqual(['9', '—']);
    expect(dice().map((die) => die.getAttribute('aria-label'))).toEqual([
      'Lock the 6',
      'Lock the 3',
    ]);
    expect(ficar.disabled).toBe(false);
    expect(caption()).toBe('Tap a die to lock it and re-roll the other, or Ficar to stand.');
    expect(services.bankroll.balance).toBe(1_000_00 - 100);
    expect(table.element.querySelectorAll('.cg-dom-card')).toHaveLength(0);

    ficar.click();
    await playing;

    const state = expected(SEEDS.sixThree, 'ficar');
    const totals = settlementTotals(state.settlement);
    expect(services.bankroll.balance).toBe(1_000_00 - 100 + totals.payout);
    expect(tracker.stats).toMatchObject({ rounds: 1, staked: 100, fees: 0 });
    const cards = state.events.flatMap((event) =>
      event.type === 'card-dealt' ? [event.card] : [],
    );
    const dealt = cards[0]!.rank + cards[1]!.rank;
    expect(table.scoreboard.totals).toEqual(['9', String(dealt)]);
    expect(table.scoreboard.leader).toBe(9 > dealt ? 'dice' : 9 === dealt ? 'tie' : 'cards');
    expect(table.element.querySelectorAll('.cg-dom-card.is-face-up')).toHaveLength(2);
    expect(caption()).toContain(`Your 9 against the dealer's ${String(dealt)}`);
    expect(table.phase).toBe('betting');
  });

  it('locks a die with a tap, reveals Trancar with its fee, takes the fee and re-rolls the other', async () => {
    const { table, services, tracker, dice, trancar, caption, roll } = await setup(SEEDS.fiveTwo);
    const { playing } = await roll();
    const [five] = dice();
    five!.click();
    expect(five!.getAttribute('aria-pressed')).toBe('true');
    expect(trancar.hidden).toBe(false);
    expect(trancar.textContent).toBe('Trancar · +0.40');
    expect(caption()).toBe('Locked the 5. Trancar re-rolls the 2.');
    // A second tap unlocks it, and Trancar hides again.
    five!.click();
    expect(five!.getAttribute('aria-pressed')).toBe('false');
    expect(trancar.hidden).toBe(true);
    five!.click();

    trancar.click();
    await playing;

    const state = expected(SEEDS.fiveTwo, 'trancar-0');
    const line = state.settlement.trancar!;
    expect(line.fee).toBe(40);
    expect(services.bankroll.balance).toBe(1_000_00 - 100 - 40 + line.payout);
    expect(tracker.stats).toMatchObject({ rounds: 1, staked: 100, fees: 40 });
    const [rerolled] = state.events.flatMap((event) =>
      event.type === 'die-rerolled' ? [event] : [],
    );
    expect(rerolled!.index).toBe(1);
    expect(table.scoreboard.totals[0]).toBe(String(rerolled!.dice[0] + rerolled!.dice[1]));
    // The padlock stays on the 5 through the result.
    expect(five!.classList.contains('is-held')).toBe(true);
    expect(five!.disabled).toBe(true);
  });

  it('re-rolls 1-1 for free', async () => {
    const { services, tracker, dice, trancar, roll } = await setup(SEEDS.oneOne);
    const { playing } = await roll();
    expect(dice().map((die) => die.getAttribute('aria-label'))).toEqual([
      'Lock the left 1',
      'Lock the right 1',
    ]);
    dice()[1]!.click();
    expect(trancar.textContent).toBe('Trancar · free');
    trancar.click();
    await playing;
    const line = expected(SEEDS.oneOne, 'trancar-1').settlement.trancar!;
    expect(line.fee).toBeUndefined();
    expect(services.bankroll.balance).toBe(1_000_00 - 100 + line.payout);
    expect(tracker.stats.fees).toBe(0);
  });

  it('shows the recommended choice only when the strategy hint is switched on', async () => {
    const { table, q, ficar, roll } = await setup(SEEDS.oneFour);
    const { playing } = await roll();
    const advice = q('.tr-decision__advice');
    expect(advice.hidden).toBe(true);
    q('.tr-decision__help [role="switch"]').click();
    expect(table.decision.hint).toBe(true);
    expect(advice.hidden).toBe(false);
    expect(advice.textContent).toBe('Recommended: Trancar, lock the 4 and re-roll the 1 (+0.40)');
    ficar.click();
    await playing;
    expect(advice.hidden).toBe(true);
  });

  it('autoplays with the reference strategy: every round as the engine plays it with the bot', async () => {
    const { services, tracker, q, button } = await setup('trancar-auto');
    button('.cg-autoplay__toggle').click();
    button('.cg-autoplay__choice').click();
    await vi.waitFor(() => {
      expect(q('.cg-autoplay').getAttribute('data-running')).toBe('false');
    });
    // The same rounds on the engine, with the same seed and the same bot.
    const game = createTrancar({ source: createTrancarShoe() });
    const rng = createSeededRng('trancar-auto');
    const bot = trancarStrategy();
    let [returned, fees] = [0, 0];
    for (let round = 0; round < tracker.stats.rounds; round++) {
      const pending = game.start({ trancar: 100 }, rng);
      const line = game.decide(pending, bot(pending)).settlement.trancar!;
      returned += line.payout;
      fees += line.fee ?? 0;
    }
    expect(tracker.stats.rounds).toBe(10);
    expect(tracker.stats).toMatchObject({ staked: 1_000, returned, fees });
    expect(services.bankroll.balance).toBe(1_000_00 - 1_000 - fees + returned);
  });

  it('stands on a round left mid-decision: no fee, and the round is paid out', async () => {
    const { table, services, tracker, roll } = await setup(SEEDS.fiveTwo);
    const { playing } = await roll();
    table.destroy();
    await playing;
    const line = expected(SEEDS.fiveTwo, 'ficar').settlement.trancar!;
    expect(line.fee).toBeUndefined();
    expect(services.bankroll.balance).toBe(1_000_00 - 100 + line.payout);
    expect(tracker.stats).toMatchObject({ rounds: 1, fees: 0 });
  });

  it('pays a round out when the page is hidden mid-decision, and plays on if it comes back', async () => {
    const { table, services, tracker, dice, trancar, roll } = await setup(SEEDS.fiveTwo);
    const { playing } = await roll();
    window.dispatchEvent(new Event('pagehide'));
    // Paid out at once, standing: no fee without the player's choice.
    const line = expected(SEEDS.fiveTwo, 'ficar').settlement.trancar!;
    expect(services.bankroll.balance).toBe(1_000_00 - 100 + line.payout);
    expect(tracker.stats).toMatchObject({ rounds: 1, fees: 0 });
    // Shown again (back from the page cache), the decision still on screen: the round plays
    // on as it ended, and nothing is paid twice.
    dice()[0]!.click();
    trancar.click();
    await playing;
    expect(services.bankroll.balance).toBe(1_000_00 - 100 + line.payout);
    expect(tracker.stats.rounds).toBe(1);
    expect(table.phase).toBe('betting');
  });

  it('offers Trancar only when the balance covers its fee', async () => {
    const { dice, trancar, ficar, q, roll } = await setup(SEEDS.fiveTwo, 1_00);
    const { playing } = await roll();
    dice()[0]!.click();
    expect(trancar.hidden).toBe(false);
    expect(trancar.disabled).toBe(true);
    expect(q('.tr-decision__note').textContent).toBe('Your balance does not cover the 0.40 fee.');
    ficar.click();
    await playing;
  });

  it('autoplays only when the balance also covers a fee', async () => {
    const { tracker, q, button } = await setup(SEEDS.fiveTwo, 1_20);
    button('.cg-autoplay__toggle').click();
    button('.cg-autoplay__choice').click();
    await vi.waitFor(() => {
      expect(q('.cg-autoplay').getAttribute('data-running')).toBe('false');
    });
    expect(tracker.stats.rounds).toBe(0);
  });
});
