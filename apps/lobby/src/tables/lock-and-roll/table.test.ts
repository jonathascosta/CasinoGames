import {
  createSeededRng,
  createLockAndRoll,
  createLockAndRollShoe,
  settlementTotals,
  lockAndRollStrategy,
  type LockAndRollChoice,
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
import { LockAndRollTable } from './table.ts';

/**
 * Seeds whose first round (the shoe's shuffle, then the roll) the tests know:
 * 5-2 (the strategy locks the 5), 6-3 (it stands), 3-3, 1-4 (it locks the
 * 4) and 1-1 (a free re-roll).
 */
const SEEDS = {
  fiveTwo: 'lock-and-roll-13',
  sixThree: 'lock-and-roll-54',
  threeThree: 'lock-and-roll-14',
  oneFour: 'lock-and-roll-16',
  oneOne: 'lock-and-roll-7',
} as const;

const tables: LockAndRollTable[] = [];

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
  const tracker = new RtpTracker({ gameId: 'lock-and-roll' });
  const table = new LockAndRollTable({
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
  const stand = button('.lr-decision__stand');
  const lock = button('.lr-decision__lock');
  const caption = () => q('.lr-caption').textContent;
  /**
   * Starts a round and waits for the decision; the round's promise comes
   * back wrapped, since a promise returned from an async function would be
   * awaited with it.
   */
  const roll = async () => {
    const playing = table.play();
    await vi.waitFor(() => {
      expect(q('.lr-decision').dataset.state).toBe('open');
    });
    return { playing };
  };
  return { table, services, tracker, q, button, dice, stand, lock, caption, roll };
}

/** The same first round played on the engine, with the same seed and choice. */
function expected(seed: string, choice: LockAndRollChoice) {
  const game = createLockAndRoll({ source: createLockAndRollShoe() });
  const pending = game.start({ 'lock-and-roll': 100 }, createSeededRng(seed));
  return game.decide(pending, choice);
}

describe('LockAndRollTable', () => {
  it('opens with 1.00 on Lock & Roll: Stand on the table but idle, Lock hidden, no hint', async () => {
    const { table, stand, lock, caption, q } = await setup(SEEDS.sixThree);
    expect(table.phase).toBe('betting');
    expect(q('[data-bet="lock-and-roll"]').getAttribute('aria-label')).toMatch(
      /^Lock & Roll: 1\.00\./,
    );
    expect(stand.hidden).toBe(false);
    expect(stand.disabled).toBe(true);
    expect(lock.hidden).toBe(true);
    expect(table.decision.hint).toBe(false);
    expect(q('.lr-decision__help [role="switch"]').getAttribute('aria-checked')).toBe('false');
    expect(q('.lr-decision__demo').textContent).toBe('Demo');
    expect(caption()).toBe('Tap the dice or press Roll.');
    expect(table.scoreboard.totals).toEqual(['—', '—']);
    expect(q('.lr-felt__terms').textContent).toBe(
      'Ties loseLock fee: 40% of the bet1-1 re-rolls free',
    );
  });

  it('waits for the decision after the roll, and Stand keeps it', async () => {
    const { table, services, tracker, dice, stand, caption, roll } = await setup(SEEDS.sixThree);
    const { playing } = await roll();
    // The roll is read, the dice are offered, and nothing more is dealt or taken.
    expect(table.scoreboard.totals).toEqual(['9', '—']);
    expect(dice().map((die) => die.getAttribute('aria-label'))).toEqual([
      'Lock the 6',
      'Lock the 3',
    ]);
    expect(stand.disabled).toBe(false);
    expect(caption()).toBe('Tap a die to lock it and re-roll the other, or press Stand.');
    expect(services.bankroll.balance).toBe(1_000_00 - 100);
    expect(table.element.querySelectorAll('.cg-dom-card')).toHaveLength(0);

    stand.click();
    await playing;

    const state = expected(SEEDS.sixThree, 'stand');
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

  it('locks a die with a tap, reveals Lock with its fee, takes the fee and re-rolls the other', async () => {
    const { table, services, tracker, dice, lock, caption, roll } = await setup(SEEDS.fiveTwo);
    const { playing } = await roll();
    const [five] = dice();
    five!.click();
    expect(five!.getAttribute('aria-pressed')).toBe('true');
    expect(lock.hidden).toBe(false);
    expect(lock.textContent).toBe('Lock · +0.40');
    expect(caption()).toBe('Locked the 5. Press Lock to re-roll the 2.');
    // A second tap unlocks it, and Lock hides again.
    five!.click();
    expect(five!.getAttribute('aria-pressed')).toBe('false');
    expect(lock.hidden).toBe(true);
    five!.click();

    lock.click();
    await playing;

    const state = expected(SEEDS.fiveTwo, 'lock-0');
    const line = state.settlement['lock-and-roll']!;
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
    const { services, tracker, dice, lock, roll } = await setup(SEEDS.oneOne);
    const { playing } = await roll();
    expect(dice().map((die) => die.getAttribute('aria-label'))).toEqual([
      'Lock the left 1',
      'Lock the right 1',
    ]);
    dice()[1]!.click();
    expect(lock.textContent).toBe('Lock · free');
    lock.click();
    await playing;
    const line = expected(SEEDS.oneOne, 'lock-1').settlement['lock-and-roll']!;
    expect(line.fee).toBeUndefined();
    expect(services.bankroll.balance).toBe(1_000_00 - 100 + line.payout);
    expect(tracker.stats.fees).toBe(0);
  });

  it('shows the recommended choice only when the strategy hint is switched on', async () => {
    const { table, q, stand, roll } = await setup(SEEDS.oneFour);
    const { playing } = await roll();
    const advice = q('.lr-decision__advice');
    expect(advice.hidden).toBe(true);
    q('.lr-decision__help [role="switch"]').click();
    expect(table.decision.hint).toBe(true);
    expect(advice.hidden).toBe(false);
    expect(advice.textContent).toBe('Recommended: Lock the 4 and re-roll the 1 (+0.40)');
    stand.click();
    await playing;
    expect(advice.hidden).toBe(true);
  });

  it('autoplays with the reference strategy: every round as the engine plays it with the bot', async () => {
    const { services, tracker, q, button } = await setup('lock-and-roll-auto');
    button('.cg-autoplay__toggle').click();
    button('.cg-autoplay__choice').click();
    await vi.waitFor(() => {
      expect(q('.cg-autoplay').getAttribute('data-running')).toBe('false');
    });
    // The same rounds on the engine, with the same seed and the same bot.
    const game = createLockAndRoll({ source: createLockAndRollShoe() });
    const rng = createSeededRng('lock-and-roll-auto');
    const bot = lockAndRollStrategy();
    let [returned, fees] = [0, 0];
    for (let round = 0; round < tracker.stats.rounds; round++) {
      const pending = game.start({ 'lock-and-roll': 100 }, rng);
      const line = game.decide(pending, bot(pending)).settlement['lock-and-roll']!;
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
    const line = expected(SEEDS.fiveTwo, 'stand').settlement['lock-and-roll']!;
    expect(line.fee).toBeUndefined();
    expect(services.bankroll.balance).toBe(1_000_00 - 100 + line.payout);
    expect(tracker.stats).toMatchObject({ rounds: 1, fees: 0 });
  });

  it('pays a round out when the page is hidden mid-decision, and plays on if it comes back', async () => {
    const { table, services, tracker, dice, lock, roll } = await setup(SEEDS.fiveTwo);
    const { playing } = await roll();
    window.dispatchEvent(new Event('pagehide'));
    // Paid out at once, standing: no fee without the player's choice.
    const line = expected(SEEDS.fiveTwo, 'stand').settlement['lock-and-roll']!;
    expect(services.bankroll.balance).toBe(1_000_00 - 100 + line.payout);
    expect(tracker.stats).toMatchObject({ rounds: 1, fees: 0 });
    // Shown again (back from the page cache), the decision still on screen: the round plays
    // on as it ended, and nothing is paid twice.
    dice()[0]!.click();
    lock.click();
    await playing;
    expect(services.bankroll.balance).toBe(1_000_00 - 100 + line.payout);
    expect(tracker.stats.rounds).toBe(1);
    expect(table.phase).toBe('betting');
  });

  it('offers Lock only when the balance covers its fee', async () => {
    const { dice, lock, stand, q, roll } = await setup(SEEDS.fiveTwo, 1_00);
    const { playing } = await roll();
    dice()[0]!.click();
    expect(lock.hidden).toBe(false);
    expect(lock.disabled).toBe(true);
    expect(q('.lr-decision__note').textContent).toBe(
      'Your balance does not cover the 0.40 Lock fee.',
    );
    stand.click();
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
