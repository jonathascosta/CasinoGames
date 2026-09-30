import {
  createSeededRng,
  defineBets,
  odds,
  randomInt,
  settleLoss,
  settleWin,
  summarizeMath,
  type Settlement,
} from '@casinogames/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryBackend, createSafeStorage } from '../storage/storage.ts';
import { RtpPanel } from './RtpPanel.ts';
import { RtpTracker, nextCheckpoint, parseStats } from './RtpTracker.ts';
import { renderSparkline } from './sparkline.ts';

const MATH = summarizeMath({
  id: 'sample',
  name: 'Sample',
  bets: defineBets([
    {
      id: 'main',
      label: 'Main',
      kind: 'main',
      min: 100,
      max: 10_000,
      rtp: 0.5,
      standardDeviation: 1,
      paytable: [{ id: 'win', label: 'Win', odds: odds(1) }],
    },
    {
      id: 'side',
      label: 'Side',
      kind: 'side',
      min: 100,
      max: 1_000,
      rtp: 0.9,
      paytable: [{ id: 'win', label: 'Win', odds: odds(8) }],
    },
  ]),
});

const win = (stake = 100): Settlement => ({ main: settleWin(stake, odds(1), 'win') });
const lose = (stake = 100): Settlement => ({ main: settleLoss(stake) });

describe('RtpTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tallies rounds, stakes and returns per bet', () => {
    const tracker = new RtpTracker({ gameId: 'g' });
    tracker.record(win());
    tracker.record({ main: settleLoss(200), side: settleWin(100, odds(8)) });
    expect(tracker.stats).toMatchObject({ rounds: 2, staked: 400, returned: 1_100 });
    expect(tracker.stats.bets.main).toMatchObject({
      rounds: 2,
      staked: 300,
      returned: 200,
      wins: 1,
    });
    expect(tracker.stats.bets.side).toMatchObject({
      rounds: 1,
      staked: 100,
      returned: 900,
      wins: 1,
    });
  });

  it('samples history at geometrically spaced checkpoints and stays bounded', () => {
    const tracker = new RtpTracker({ gameId: 'g' });
    const rng = createSeededRng('rtp-history');
    for (let i = 0; i < 20_000; i++) tracker.record(randomInt(rng, 2) === 0 ? win() : lose());
    const history = tracker.stats.bets.main!.history;
    expect(history.slice(0, 6).map((s) => s.rounds)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(history.length).toBeLessThan(60);
    expect(history.at(-1)!.rounds).toBeGreaterThan(15_000);
    expect(history.at(-1)!.rtp).toBeCloseTo(1, 1);
    expect(nextCheckpoint(100)).toBe(120);
  });

  it('persists after a short delay, reloads and resets', () => {
    const storage = createSafeStorage('t', createMemoryBackend());
    const tracker = new RtpTracker({ gameId: 'g', storage });
    tracker.record(win());
    expect(new RtpTracker({ gameId: 'g', storage }).stats.rounds).toBe(0);
    vi.advanceTimersByTime(500);
    expect(new RtpTracker({ gameId: 'g', storage }).stats.rounds).toBe(1);
    expect(new RtpTracker({ gameId: 'other', storage }).stats.rounds).toBe(0);
    tracker.reset();
    expect(new RtpTracker({ gameId: 'g', storage }).stats.rounds).toBe(0);
  });

  it('ignores empty settlements and rejects malformed stored stats', () => {
    const tracker = new RtpTracker({ gameId: 'g' });
    tracker.record({});
    expect(tracker.stats.rounds).toBe(0);
    expect(
      parseStats({ rounds: 1, staked: 1, returned: 1, bets: { x: { rounds: -1 } } }),
    ).toBeUndefined();
    expect(parseStats({ rounds: 1.5, staked: 1, returned: 1, bets: {} })).toBeUndefined();
    expect(parseStats('nope')).toBeUndefined();
  });
});

describe('renderSparkline', () => {
  it('draws the declared line, the band and the series', () => {
    const chart = renderSparkline({
      samples: [
        { rounds: 1, rtp: 2 },
        { rounds: 10, rtp: 0.7 },
        { rounds: 1_000, rtp: 0.52 },
      ],
      declared: 0.5,
      standardDeviation: 1,
    });
    expect(chart.querySelector('.cg-sparkline__band')).not.toBeNull();
    expect(
      chart.querySelector('.cg-sparkline__series')!.getAttribute('points')!.split(' '),
    ).toHaveLength(3);
    expect(chart.getAttribute('aria-label')).toBe(
      'Live RTP 52.00% after 1,000 rounds; declared 50.00%',
    );
  });

  it('omits the band without σ and draws nothing without samples', () => {
    expect(
      renderSparkline({ samples: [{ rounds: 5, rtp: 1 }], declared: 0.9 }).querySelector(
        '.cg-sparkline__band',
      ),
    ).toBeNull();
    const empty = renderSparkline({ samples: [], declared: 0.9 });
    expect(empty.childElementCount).toBe(0);
    expect(empty.getAttribute('aria-label')).toBe('No rounds yet; declared RTP 90.00%');
  });
});

describe('RtpPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows totals and live versus declared RTP per bet, updating as rounds settle', () => {
    const tracker = new RtpTracker({ gameId: 'g' });
    const panel = new RtpPanel({ tracker, math: MATH });
    const text = (selector: string) => panel.element.querySelector(selector)!.textContent;
    expect(text('.cg-rtp__headline')).toBe('No rounds yet');

    tracker.record(win());
    tracker.record(lose());
    tracker.record(lose());
    expect(text('.cg-rtp__headline')).toBe('No rounds yet'); // coalesced into the next frame
    vi.advanceTimersToNextFrame();
    expect(text('.cg-rtp__headline')).toBe('66.67% · 3 rounds');
    expect(text('.cg-rtp__totals')).toBe('Rounds3Wagered3.00Won2.00Net−1.00');
    const [main, side] = panel.element.querySelectorAll('.cg-rtp__bet');
    expect(main!.textContent).toContain('Main3 roundsLive66.67%+16.67 ppDeclared50.00%');
    expect(side!.textContent).toContain('Side0 roundsLive—Declared90.00%');
    expect(main!.querySelector('.cg-sparkline__band')).not.toBeNull();
  });

  it('counts a single round in the singular', () => {
    const tracker = new RtpTracker({ gameId: 'g' });
    const panel = new RtpPanel({ tracker, math: MATH });
    tracker.record(win());
    vi.advanceTimersToNextFrame();
    expect(panel.element.querySelector('.cg-rtp__headline')!.textContent).toBe('200.00% · 1 round');
    const main = panel.element.querySelector('.cg-rtp__bet')!;
    expect(main.textContent).toContain('Main1 roundLive');
    expect(main.querySelector('.cg-sparkline')!.getAttribute('aria-label')).toBe(
      'Live RTP 200.00% after 1 round; declared 50.00%',
    );
  });

  it('resets the stats from its button and can start collapsed', () => {
    const tracker = new RtpTracker({ gameId: 'g' });
    tracker.record(win());
    const panel = new RtpPanel({ tracker, math: MATH, collapsed: true });
    expect(panel.element.open).toBe(false);
    panel.element.querySelector<HTMLButtonElement>('.cg-rtp__reset')!.click();
    expect(tracker.stats.rounds).toBe(0);
    panel.destroy();
  });
});
