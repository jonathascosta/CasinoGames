import { oddsLabel } from '../game/money.ts';
import type { BetMath, MathSummary, PaytableEntry } from '../game/types.ts';

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
    `_Generated from \`mathSummary()\` of \`${summary.gameId}\` by \`pnpm docs:sheets\`. Do not edit by hand._`,
    ...summary.bets.map(renderBet),
  ];
  return blocks.join('\n\n');
}

/** Replaces what lies between the math markers; the markers themselves stay. */
export function replaceMathSection(markdown: string, section: string): string {
  const start = markdown.indexOf(MATH_START);
  const end = markdown.indexOf(MATH_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Expected ${MATH_START} … ${MATH_END} markers in the game sheet`);
  }
  return `${markdown.slice(0, start + MATH_START.length)}\n\n${section}\n\n${markdown.slice(end)}`;
}

function renderBet(bet: BetMath): string {
  const withProbability = bet.paytable.some((entry) => entry.probability !== undefined);
  const header = withProbability
    ? '| Outcome | Pays | Probability |\n| :-- | --: | --: |'
    : '| Outcome | Pays |\n| :-- | --: |';
  const rows = bet.paytable.map((entry) => {
    const cells = [entry.label, pays(entry)];
    if (withProbability) {
      cells.push(entry.probability === undefined ? '—' : percent(entry.probability, 3));
    }
    return `| ${cells.join(' | ')} |`;
  });
  const stats = [
    `RTP **${percent(bet.rtp, 2)}**`,
    `house edge **${percent(bet.houseEdge, 2)}**`,
    ...(bet.standardDeviation === undefined
      ? []
      : [`standard deviation **${bet.standardDeviation.toFixed(3)}**`]),
    `limits ${amount(bet.min)} – ${amount(bet.max)}`,
  ];
  return [
    `### ${bet.label} (${bet.kind === 'main' ? 'main bet' : 'side bet'})`,
    [header, ...rows].join('\n'),
    stats.join(' · '),
  ].join('\n\n');
}

function pays(entry: PaytableEntry): string {
  if ('odds' in entry) return oddsLabel(entry.odds);
  const share = entry.jackpot.share === 1 ? '' : `${percent(entry.jackpot.share, 0)} of `;
  return `${share}${entry.jackpot.jackpotId} jackpot`;
}

function percent(ratio: number, digits: number): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

function amount(cents: number): string {
  const [whole = '0', fraction = '00'] = (cents / 100).toFixed(2).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
}
