import { oddsLabel } from '../game/money.ts';
import type { BetBreakdown, BetMath, MathSummary, PaytableEntry } from '../game/types.ts';

export const MATH_START = '<!-- math:start -->';
export const MATH_END = '<!-- math:end -->';

/**
 * The "Bets and paytable" section of a game sheet, rendered from the game's
 * math summary. `pnpm docs:sheets` writes it between the math markers of
 * docs/games/<id>.md and `pnpm docs:check` fails CI when it is stale, so the
 * published figures cannot drift from the code the tests verify.
 */
export function renderMathSection(summary: MathSummary): string {
  const blocks = [
    `<!-- Generated from mathSummary() of ${summary.gameId} by pnpm docs:sheets. Do not edit by hand. -->`,
    renderOverview(summary.bets),
    renderLegend(summary.bets),
    ...summary.bets.map(renderBet),
  ];
  return blocks.join('\n\n');
}

const PRETTIER_IGNORE_START = '<!-- prettier-ignore-start -->';
const PRETTIER_IGNORE_END = '<!-- prettier-ignore-end -->';

/**
 * Replaces what lies between the math markers; the markers themselves stay.
 * The section is fenced off from Prettier, which would otherwise re-align
 * the generated tables and make the sheet look stale to `pnpm docs:check`.
 */
export function replaceMathSection(markdown: string, section: string): string {
  const start = markdown.indexOf(MATH_START);
  const end = markdown.indexOf(MATH_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Expected ${MATH_START} … ${MATH_END} markers in the game sheet`);
  }
  return [
    markdown.slice(0, start + MATH_START.length),
    PRETTIER_IGNORE_START,
    section,
    PRETTIER_IGNORE_END,
    markdown.slice(end),
  ].join('\n\n');
}

type Column = readonly [title: string, align: string, cell: (bet: BetMath) => string];

/** One row per bet with the figures operators compare across games. */
function renderOverview(bets: readonly BetMath[]): string {
  const columns: Column[] = [
    ['Bet', ':--', (bet) => `${bet.label} (${bet.kind})`],
    ['RTP', '--:', (bet) => percent(bet.rtp, 2)],
    ['House edge', '--:', (bet) => percent(bet.houseEdge, 2)],
    ['Hit frequency', '--:', (bet) => optional(bet.hitFrequency, (value) => percent(value, 2))],
    ['Max exposure', '--:', (bet) => optional(bet.maxExposure, (value) => `${trim(value)}×`)],
    ['Volatility index', '--:', (bet) => optional(bet.standardDeviation, (v) => v.toFixed(3))],
    ['Limits', '--:', (bet) => `${amount(bet.min)} – ${amount(bet.max)}`],
  ];
  if (bets.some((bet) => bet.pushFrequency !== undefined)) {
    columns.splice(4, 0, [
      'Push',
      '--:',
      (bet) => optional(bet.pushFrequency, (value) => percent(value, 2)),
    ]);
  }
  return [
    row(columns.map(([title]) => title)),
    row(columns.map(([, align]) => align)),
    ...bets.map((bet) => row(columns.map(([, , cell]) => cell(bet)))),
  ].join('\n');
}

function renderLegend(bets: readonly BetMath[]): string {
  const push = bets.some((bet) => bet.pushFrequency !== undefined)
    ? ' Push is the chance that the stake is simply returned.'
    : '';
  return (
    `RTP and house edge are per unit staked, pushes included. Hit frequency is the chance that a ` +
    `bet wins in a round.${push} Max exposure is the largest net win per unit staked. The ` +
    `volatility index is the standard deviation of the net result per unit staked.`
  );
}

function renderBet(bet: BetMath): string {
  return [
    `### ${bet.label} (${bet.kind === 'main' ? 'main bet' : 'side bet'})`,
    ...(bet.description === undefined ? [] : [bet.description]),
    ...(bet.breakdown === undefined ? [renderPaytable(bet)] : renderBreakdown(bet.breakdown)),
  ].join('\n\n');
}

function renderPaytable(bet: BetMath): string {
  const withProbability = bet.paytable.some((entry) => entry.probability !== undefined);
  const header = withProbability
    ? '| Outcome | Pays | Probability |\n| :-- | --: | --: |'
    : '| Outcome | Pays |\n| :-- | --: |';
  const rows = bet.paytable.map((entry) => {
    const cells = [entry.label, pays(entry)];
    if (withProbability) {
      cells.push(entry.probability === undefined ? '—' : percent(entry.probability, 3));
    }
    return row(cells);
  });
  return [header, ...rows].join('\n');
}

/** A paytable split by its condition: one row per value, with the figures given it. */
function renderBreakdown({ by, rows }: BetBreakdown): string[] {
  const noun = by.toLowerCase();
  return [
    [
      row([by, 'Chance', 'Pays', 'Hit frequency', 'House edge']),
      row([':--', '--:', '--:', '--:', '--:']),
      ...rows.map((value) =>
        row([
          value.value,
          percent(value.probability, 2),
          value.paytable.map(pays).join(', '),
          percent(value.hitFrequency, 2),
          percent(value.houseEdge, 2),
        ]),
      ),
    ].join('\n'),
    `Chance is the share of rounds with each ${noun}; the hit frequency and house edge are ` +
      `for the rounds with that ${noun}.`,
  ];
}

function pays(entry: PaytableEntry): string {
  if ('odds' in entry) return oddsLabel(entry.odds);
  if ('push' in entry) return 'Push';
  const share = entry.jackpot.share === 1 ? '' : `${percent(entry.jackpot.share, 0)} of `;
  return `${share}${entry.jackpot.jackpotId} jackpot`;
}

function row(cells: readonly string[]): string {
  return `| ${cells.join(' | ')} |`;
}

function optional(value: number | undefined, format: (value: number) => string): string {
  return value === undefined ? '—' : format(value);
}

/** 0.0385 → "3.85%"; negatives take a true minus, and a value that rounds to zero none. */
function percent(ratio: number, digits: number): string {
  const text = (Math.abs(ratio) * 100).toFixed(digits);
  return `${ratio < 0 && Number(text) !== 0 ? '−' : ''}${text}%`;
}

/** 4 → "4", 0.5 → "0.5", 1/3 → "0.33". */
function trim(value: number): string {
  return String(Number(value.toFixed(2)));
}

function amount(cents: number): string {
  const [whole = '0', fraction = '00'] = (cents / 100).toFixed(2).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
}
