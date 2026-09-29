import { describe, expect, it } from 'vitest';
import { createDiceFixture } from '../fixtures/dice-fixture.ts';
import { summarizeMath } from '../game/math-summary.ts';
import { odds } from '../game/money.ts';
import { defineBets } from '../game/validation.ts';
import { MATH_END, MATH_START, renderMathSection, replaceMathSection } from './sheet.ts';

describe('renderMathSection', () => {
  it('renders every bet from the math summary', () => {
    expect(renderMathSection(createDiceFixture().mathSummary())).toBe(
      [
        '_Generated from `mathSummary()` of `dice-fixture` by `pnpm docs:sheets`. Do not edit by hand._',
        '### Over 7 (main bet)',
        '| Outcome | Pays | Probability |\n| :-- | --: | --: |\n| Total 8–12 | 1 to 1 | 41.667% |',
        'RTP **83.33%** · house edge **16.67%** · limits 0.50 – 100.00',
        '### Doubles (side bet)',
        '| Outcome | Pays | Probability |\n| :-- | --: | --: |\n| Any double | 9 to 2 | 16.667% |',
        'RTP **91.67%** · house edge **8.33%** · limits 0.50 – 25.00',
      ].join('\n\n'),
    );
  });

  it('describes jackpots, volatility and large limits', () => {
    const summary = summarizeMath({
      id: 'jackpot',
      name: 'Jackpot',
      bets: defineBets([
        {
          id: 'grand',
          label: 'Grand',
          kind: 'side',
          min: 100,
          max: 1_000_000,
          rtp: 0.9,
          standardDeviation: 12.3456,
          paytable: [
            { id: 'top', label: 'Top hand', jackpot: { jackpotId: 'Grand', share: 1 } },
            { id: 'next', label: 'Next hand', jackpot: { jackpotId: 'Grand', share: 0.1 } },
            { id: 'small', label: 'Small hand', odds: odds(5) },
          ],
        },
      ]),
    });
    const section = renderMathSection(summary);
    expect(section).toContain('| Top hand | Grand jackpot |');
    expect(section).toContain('| Next hand | 10% of Grand jackpot |');
    expect(section).toContain('| Outcome | Pays |\n| :-- | --: |');
    expect(section).toContain('standard deviation **12.346**');
    expect(section).toContain('limits 1.00 – 10,000.00');
  });
});

describe('replaceMathSection', () => {
  const sheet = `# Game\n\n## Bets\n\n${MATH_START}\n\nold text\n\n${MATH_END}\n\n## Math\n`;

  it('replaces only the generated section and is idempotent', () => {
    const once = replaceMathSection(sheet, 'new table');
    expect(once).toBe(
      `# Game\n\n## Bets\n\n${MATH_START}\n\nnew table\n\n${MATH_END}\n\n## Math\n`,
    );
    expect(replaceMathSection(once, 'new table')).toBe(once);
  });

  it('refuses sheets without markers', () => {
    expect(() => replaceMathSection('# Game', 'x')).toThrow(/markers/);
    expect(() => replaceMathSection(`${MATH_END}${MATH_START}`, 'x')).toThrow(/markers/);
  });
});
