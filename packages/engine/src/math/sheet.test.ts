import { describe, expect, it } from 'vitest';
import { createDiceFixture } from '../fixtures/dice-fixture.ts';
import { summarizeMath } from '../game/math-summary.ts';
import { odds } from '../game/money.ts';
import { defineBets } from '../game/validation.ts';
import { MATH_END, MATH_START, renderMathSection, replaceMathSection } from './sheet.ts';

const LEGEND =
  'RTP and house edge are per unit staked, pushes included. Hit frequency is the chance that a ' +
  'bet wins in a round. Max exposure is the largest net win per unit staked. The volatility ' +
  'index is the standard deviation of the net result per unit staked.';

describe('renderMathSection', () => {
  it('renders an overview row and a paytable per bet', () => {
    expect(renderMathSection(createDiceFixture().mathSummary())).toBe(
      [
        '<!-- Generated from mathSummary() of dice-fixture by pnpm docs:sheets. Do not edit by hand. -->',
        [
          '| Bet | RTP | House edge | Hit frequency | Max exposure | Volatility index | Limits |',
          '| :-- | --: | --: | --: | --: | --: | --: |',
          '| Over 7 (main) | 83.33% | 16.67% | 41.67% | 1× | — | 0.50 – 100.00 |',
          '| Doubles (side) | 91.67% | 8.33% | 16.67% | 4.5× | — | 0.50 – 25.00 |',
        ].join('\n'),
        LEGEND,
        '### Over 7 (main bet)',
        '| Outcome | Pays | Probability |\n| :-- | --: | --: |\n| Total 8–12 | 1 to 1 | 41.667% |',
        '### Doubles (side bet)',
        '| Outcome | Pays | Probability |\n| :-- | --: | --: |\n| Any double | 9 to 2 | 16.667% |',
      ].join('\n\n'),
    );
  });

  it('adds a push column, descriptions, jackpots, volatility and large limits', () => {
    const summary = summarizeMath({
      id: 'mixed',
      name: 'Mixed',
      bets: defineBets([
        {
          id: 'main',
          label: 'Main',
          kind: 'main',
          min: 100,
          max: 1_000_000,
          rtp: 0.95,
          standardDeviation: 1.23456,
          description: 'Wins on a high card.',
          paytable: [
            { id: 'high', label: 'High card', odds: odds(3, 2), probability: 0.25 },
            { id: 'tie', label: 'Tie', push: true, probability: 0.5 },
          ],
        },
        {
          id: 'grand',
          label: 'Grand',
          kind: 'side',
          min: 100,
          max: 2_500,
          rtp: 0.9,
          paytable: [
            { id: 'top', label: 'Top hand', jackpot: { jackpotId: 'Grand', share: 1 } },
            { id: 'next', label: 'Next hand', jackpot: { jackpotId: 'Grand', share: 0.1 } },
          ],
        },
      ]),
    });
    const section = renderMathSection(summary);
    expect(section).toContain(
      '| Bet | RTP | House edge | Hit frequency | Push | Max exposure | Volatility index | Limits |',
    );
    expect(section).toContain(
      '| Main (main) | 95.00% | 5.00% | 25.00% | 50.00% | 1.5× | 1.235 | 1.00 – 10,000.00 |',
    );
    expect(section).toContain('| Grand (side) | 90.00% | 10.00% | — | — | — | — | 1.00 – 25.00 |');
    expect(section).toContain('Push is the chance that the stake is simply returned.');
    expect(section).toContain('### Main (main bet)\n\nWins on a high card.\n\n| Outcome |');
    expect(section).toContain('| Tie | Push | 50.000% |');
    expect(section).toContain('| Top hand | Grand jackpot |');
    expect(section).toContain('| Next hand | 10% of Grand jackpot |');
    expect(section).toContain('| Outcome | Pays |\n| :-- | --: |');
  });
});

describe('renderMathSection with a breakdown', () => {
  it('tabulates a bet paid under a condition by its values', () => {
    const target = (value: string, probability: number) => ({ name: 'Target', value, probability });
    const summary = summarizeMath({
      id: 'targets',
      name: 'Targets',
      bets: defineBets([
        {
          id: 'hit',
          label: 'Hit',
          kind: 'main',
          min: 50,
          max: 5_000,
          rtp: 0.925,
          paytable: [
            {
              id: 't2',
              label: 'Hit 2',
              odds: odds(15, 2),
              probability: 0.05,
              given: target('2', 0.25),
            },
            { id: 't3', label: 'Hit 3', odds: odds(1), probability: 0.3, given: target('3', 0.75) },
          ],
        },
      ]),
    });
    expect(renderMathSection(summary)).toContain(
      [
        '### Hit (main bet)',
        [
          '| Target | Chance | Pays | Hit frequency | House edge |',
          '| :-- | --: | --: | --: | --: |',
          '| 2 | 25.00% | 15 to 2 | 20.00% | −70.00% |',
          '| 3 | 75.00% | 1 to 1 | 40.00% | 20.00% |',
        ].join('\n'),
        'Chance is the share of rounds with each target; the hit frequency and house edge are ' +
          'for the rounds with that target.',
      ].join('\n\n'),
    );
  });
});

describe('renderMathSection with a progressive bet and a finite shoe', () => {
  const summary = summarizeMath({
    id: 'p',
    name: 'P',
    finiteShoe: 'test shoe',
    bets: defineBets([
      {
        id: 'main',
        label: 'Main',
        kind: 'main',
        min: 50,
        max: 5_000,
        rtp: 0.9,
        finiteShoe: { rtp: 0.91, hitFrequency: 0.455 },
        paytable: [{ id: 'win', label: 'Win', odds: odds(1), probability: 0.45 }],
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
        finiteShoe: { rtp: 0.58, hitFrequency: 0.0008 },
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
  const sheet = renderMathSection(summary);

  it("tabulates every bet on the table's shoe beside the declared edge", () => {
    expect(sheet).toContain(
      [
        "On the table's test shoe, every round returns exactly:",
        '',
        '| Bet | Hit frequency | RTP | House edge | Edge vs declared |',
        '| :-- | --: | --: | --: | --: |',
        '| Main | 45.50% | 91.00% | 9.00% | −1.00 pp |',
        '| Meter | 0.08% | 58.00% | 42.00% | +2.00 pp |',
      ].join('\n'),
    );
  });

  it("writes the meter line and the meter's economics, on both shoes", () => {
    expect(sheet).toContain('| Hit | 499 to 1 + stake ÷ 25.00 of the meter | 0.100% |');
    expect(sheet).toContain(
      [
        '| Meter | Value |',
        '| :-- | :-- |',
        '| Hit chance per round | 0.1000% (1 in 1,000); test shoe: 0.0800% (1 in 1,250) |',
        '| Fixed pays alone | 499 to 1: RTP 50.00%, house edge 50.00%; test shoe: RTP 48.00% |',
        '| Contribution to the meter | 10% of every stake |',
        '| RTP excluding the seed | 60.00% (house edge 40.00%): the fixed pays plus the ' +
          'contributions, which the meter pays out in the long run; test shoe: 58.00% |',
        '| Meter share of a hit | stake ÷ 25.00 of the meter (the whole meter at 25.00) |',
        '| RTP with the meter at M | 50.00% + M ÷ 25,000.00, for any stake |',
        '| RTP with the meter at its seed (5,000.00) | 70.00%; test shoe: 64.00% |',
        '| Break-even meter | 12,500.00; test shoe: 16,250.00 |',
        '| Average cycle | 1,000 rounds from hit to hit; test shoe: 1,250 rounds |',
        '| Meter at a hit, on average | 5,000.00 + 100 × the mean stake: 5,050.00 at 0.50, ' +
          '5,100.00 at 1.00, 5,500.00 at 5.00, 7,500.00 at 25.00 |',
        '| Seed cost to the house | 5.00 per round at 25.00 (20.00% of the stake): a cost, not ' +
          'part of the RTP |',
        '| Max exposure per round | 499 × 25.00 + the meter: 17,475.00 with the meter at its ' +
          'seed, unbounded as it grows |',
        '| Volatility index at the seed | 20.000 |',
      ].join('\n'),
    );
    expect(sheet).toContain("A progressive bet's RTP excludes the seed of its meter");
    expect(sheet).toContain(
      '| Meter (side) | 60.00% | 40.00% | 0.10% | — | 20.000 | 0.50 – 25.00 |',
    );
  });
});

describe('replaceMathSection', () => {
  const sheet = `# Game\n\n## Bets\n\n${MATH_START}\n\nold text\n\n${MATH_END}\n\n## Math\n`;

  it('replaces only the generated section, fenced off from Prettier, and is idempotent', () => {
    const once = replaceMathSection(sheet, 'new table');
    expect(once).toBe(
      `# Game\n\n## Bets\n\n${MATH_START}\n\n<!-- prettier-ignore-start -->\n\nnew table\n\n` +
        `<!-- prettier-ignore-end -->\n\n${MATH_END}\n\n## Math\n`,
    );
    expect(replaceMathSection(once, 'new table')).toBe(once);
  });

  it('refuses sheets without markers', () => {
    expect(() => replaceMathSection('# Game', 'x')).toThrow(/markers/);
    expect(() => replaceMathSection(`${MATH_END}${MATH_START}`, 'x')).toThrow(/markers/);
  });
});
