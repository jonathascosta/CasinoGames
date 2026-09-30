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
