import {
  createSeededRng,
  defineBets,
  odds,
  randomInt,
  settleLoss,
  settleWin,
  summarizeMath,
  withFee,
  type DecisionSummary,
  type Settlement,
} from '@casinogames/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from '../state/store.ts';
import { createMemoryBackend, createSafeStorage } from '../storage/storage.ts';
import { RtpPanel } from './RtpPanel.ts';
import { RtpTracker, liveRtp, nextCheckpoint, parseStats } from './RtpTracker.ts';
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

  it('tallies fees apart and counts them against the return', () => {
    const tracker = new RtpTracker({ gameId: 'g' });
    tracker.record({ main: withFee(settleWin(100, odds(1)), 40) });
    tracker.record({ main: withFee(settleLoss(100), 40) });
    tracker.record(win());
    expect(tracker.stats).toMatchObject({ rounds: 3, staked: 300, returned: 400, fees: 80 });
    expect(tracker.stats.bets.main).toMatchObject({
      staked: 300,
      returned: 400,
      fees: 80,
      wins: 2,
    });
    // (4.00 − 0.80) ÷ 3.00, sampled the same way.
    expect(liveRtp(tracker.stats)).toBeCloseTo(320 / 300, 12);
    expect(tracker.stats.bets.main!.history.at(-1)!.rtp).toBeCloseTo(320 / 300, 12);
    expect(liveRtp({ staked: 0, returned: 0, fees: 0 })).toBeNaN();
  });

  it('needs a fees total on the stats and on every bet', () => {
    const tally = { rounds: 1, staked: 100, returned: 200, fees: 0, wins: 1, history: [] };
    const stored = { rounds: 1, staked: 100, returned: 200, fees: 0, bets: { main: tally } };
    expect(parseStats(stored)).toMatchObject({ fees: 0, bets: { main: { fees: 0 } } });
    const { fees: _total, ...withoutTotal } = stored;
    const { fees: _bet, ...tallyWithoutFees } = tally;
    expect(parseStats(withoutTotal)).toBeUndefined();
    expect(parseStats({ ...stored, bets: { main: tallyWithoutFees } })).toBeUndefined();
    expect(parseStats({ ...stored, fees: -1 })).toBeUndefined();
    expect(parseStats({ ...stored, bets: { main: { ...tally, fees: 0.5 } } })).toBeUndefined();
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

  it("shows a progressive bet's RTP at the meter as it stands, and every bet on the table's shoe", () => {
    const math = summarizeMath({
      id: 'p',
      name: 'P',
      finiteShoe: 'test shoe',
      bets: defineBets([
        {
          id: 'main',
          label: 'Main',
          kind: 'main',
          min: 100,
          max: 10_000,
          rtp: 0.5,
          finiteShoe: { rtp: 0.49, hitFrequency: 0.245 },
          paytable: [{ id: 'win', label: 'Win', odds: odds(1) }],
        },
        {
          id: 'meter',
          label: 'Meter',
          kind: 'side',
          min: 50,
          max: 2_500,
          rtp: 0.6,
          standardDeviation: 20,
          progressive: {
            jackpotId: 'house',
            seed: 500_000,
            contributionRate: 0.1,
            fullShareStake: 2_500,
            hitProbability: 0.001,
            fixedRtp: 0.5,
          },
          paytable: [
            {
              id: 'hit',
              label: 'Hit',
              odds: odds(499),
              jackpot: { jackpotId: 'house', share: 1, fullShareStake: 2_500 },
              probability: 0.001,
            },
          ],
        },
      ]),
    });
    const meter = createStore(500_000);
    const panel = new RtpPanel({
      tracker: new RtpTracker({ gameId: 'p' }),
      math,
      meters: { house: meter },
    });
    const [main, progressive] = panel.element.querySelectorAll('.cg-rtp__bet');
    expect(main!.querySelector('.cg-rtp__notes')!.textContent).toBe('On the test shoe: 49.00%');
    expect(progressive!.textContent).toContain('Declared60.00%excl. seed');
    // 50% + 0.001 × meter ÷ 25.00: 70% at the seed, break-even at 12,500.00.
    expect(progressive!.querySelector('.cg-rtp__notes')!.textContent).toBe(
      'At the current meter (5,000.00): 70.00%Break-even meter 12,500.00',
    );
    meter.set(750_000);
    vi.advanceTimersToNextFrame();
    expect(panel.element.querySelectorAll('.cg-rtp__notes')[1]!.textContent).toContain(
      'At the current meter (7,500.00): 80.00%',
    );
    panel.destroy();
  });

  it('shows the fees of a game whose choices cost one, and counts them against the return', () => {
    const decisions: DecisionSummary = {
      description: 'Re-roll for 40% of the bet.',
      card: {
        situation: 'Roll',
        choices: ['Stand', 'Re-roll'],
        measure: 'net result',
        rows: [{ situation: 'Any', probability: 1, values: [0, 0.1], best: 1, play: 'Re-roll' }],
      },
      figures: [
        {
          label: 'These rules',
          rtp: 0.5,
          houseEdge: 0.5,
          elementOfRisk: 0.4,
          hitFrequency: 0.5,
          standardDeviation: 1,
          choiceFrequencies: [{ choice: 'Re-roll', frequency: 1 }],
          feeFrequency: 1,
          averageFee: 0.4,
        },
      ],
    };
    const tracker = new RtpTracker({ gameId: 'g' });
    const panel = new RtpPanel({
      tracker,
      math: summarizeMath({ id: 'g', name: 'G', bets: MATH.bets.map(toDefinition), decisions }),
    });
    const text = (selector: string) => panel.element.querySelector(selector)!.textContent;
    expect(text('.cg-rtp__totals')).toBe('Rounds0Wagered0.00Won0.00Fees0.00Net0.00');
    expect(text('.cg-rtp__note')).toContain('Live RTP = (total won − fees) ÷ total wagered');
    tracker.record({ main: withFee(settleWin(100, odds(1)), 40) });
    tracker.record({ main: withFee(settleLoss(100), 40) });
    vi.advanceTimersToNextFrame();
    expect(text('.cg-rtp__headline')).toBe('60.00% · 2 rounds');
    expect(text('.cg-rtp__totals')).toBe('Rounds2Wagered2.00Won2.00Fees0.80Net−0.80');
    expect(panel.element.querySelector('.cg-rtp__bet')!.textContent).toContain(
      'Main2 roundsLive60.00%+10.00 ppDeclared50.00%',
    );
    // A game without fees keeps the plain note and no Fees total.
    const plain = new RtpPanel({ tracker: new RtpTracker({ gameId: 'h' }), math: MATH });
    expect(plain.element.querySelector('.cg-rtp__totals')!.textContent).not.toContain('Fees');
    expect(plain.element.querySelector('.cg-rtp__note')!.textContent).toMatch(
      /^Live RTP = total won ÷ total wagered/,
    );
    panel.destroy();
    plain.destroy();
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

/** A bet definition back from its summary, to build variants of MATH. */
function toDefinition(bet: (typeof MATH.bets)[number]) {
  return {
    id: bet.betId,
    label: bet.label,
    kind: bet.kind,
    min: bet.min,
    max: bet.max,
    rtp: bet.rtp,
    paytable: bet.paytable,
    ...(bet.standardDeviation === undefined ? {} : { standardDeviation: bet.standardDeviation }),
  };
}
