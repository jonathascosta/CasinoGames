import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutoPlay } from './AutoPlay.ts';
import { AutoPlayController } from './AutoPlayController.ts';

function controller(balance = { value: 1_000 }, stake = 100) {
  const playRound = vi.fn(async () => {
    balance.value -= stake;
    await Promise.resolve();
  });
  const auto = new AutoPlayController({ playRound, canContinue: () => balance.value >= stake });
  return { auto, playRound, balance };
}

describe('AutoPlayController', () => {
  it('plays the requested rounds and reports progress', async () => {
    const { auto, playRound } = controller();
    const seen: number[] = [];
    auto.subscribe((state) => seen.push(state.played));
    await expect(auto.start(3)).resolves.toBe('completed');
    expect(playRound).toHaveBeenCalledTimes(3);
    expect(auto.state).toEqual({ running: false, total: 3, played: 3, lastStop: 'completed' });
    expect(seen).toContain(2);
  });

  it('stops before a round the balance cannot cover', async () => {
    const { auto, playRound } = controller({ value: 250 });
    await expect(auto.start(10)).resolves.toBe('insufficient-funds');
    expect(playRound).toHaveBeenCalledTimes(2);
  });

  it('stops after the current round when asked', async () => {
    const { auto, playRound } = controller();
    const run = auto.start(10);
    auto.stop();
    await expect(run).resolves.toBe('stopped');
    expect(playRound).toHaveBeenCalledTimes(1);
  });

  it('stops on an error and can run again', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const auto = new AutoPlayController({
      playRound: () => Promise.reject(new Error('boom')),
      canContinue: () => true,
    });
    await expect(auto.start(5)).resolves.toBe('error');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
    expect(auto.state.running).toBe(false);
  });

  it('rejects invalid or overlapping runs', async () => {
    const { auto } = controller();
    await expect(auto.start(0)).rejects.toThrow(RangeError);
    const run = auto.start(2);
    await expect(auto.start(2)).rejects.toThrow(/already running/);
    await run;
  });
});

describe('AutoPlay', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  function mount() {
    const setup = controller();
    const view = new AutoPlay({ controller: setup.auto });
    document.body.append(view.element);
    const toggle = view.element.querySelector<HTMLButtonElement>('.cg-autoplay__toggle')!;
    const menu = view.element.querySelector<HTMLElement>('.cg-autoplay__menu')!;
    return { ...setup, view, toggle, menu };
  }

  it('opens a menu of round counts and starts the chosen run', async () => {
    const { toggle, menu, playRound, auto } = mount();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    expect(menu.hidden).toBe(false);
    expect([...menu.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      '10',
      '25',
      '50',
      '100',
    ]);
    expect(document.activeElement).toBe(menu.querySelector('button'));
    menu.querySelector<HTMLButtonElement>('button')!.click();
    expect(menu.hidden).toBe(true);
    expect(toggle.textContent).toBe('Stop0/10');
    // The menu took the keyboard focus with it: back on the toggle, which stops.
    expect(document.activeElement).toBe(toggle);
    toggle.click(); // stop
    await vi.waitFor(() => {
      expect(auto.state.running).toBe(false);
    });
    expect(playRound).toHaveBeenCalledTimes(1);
    expect(toggle.textContent).toBe('Auto');
  });

  it('announces why autoplay stopped', async () => {
    const { toggle, menu, view } = mount();
    toggle.click();
    menu.querySelectorAll<HTMLButtonElement>('button')[3]!.click(); // 100 rounds, 10 affordable
    await vi.waitFor(() => {
      expect(view.element.querySelector('[aria-live]')!.textContent).toBe(
        'Autoplay stopped: balance too low for the bet',
      );
    });
  });

  it('closes on Escape and outside clicks, and can be disabled', () => {
    const { toggle, menu, view } = mount();
    toggle.click();
    view.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
    toggle.click();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(menu.hidden).toBe(true);
    // Unavailable, yet focusable: it keeps the keyboard focus between rounds.
    view.setDisabled(true);
    expect(toggle.getAttribute('aria-disabled')).toBe('true');
    expect(toggle.disabled).toBe(false);
    toggle.click();
    expect(menu.hidden).toBe(true);
  });
});
