import { expectedMeterAtHit } from '../game/math-summary.ts';
import { oddsLabel } from '../game/money.ts';
import type {
  BetBreakdown,
  BetMath,
  DecisionSummary,
  JackpotPayout,
  MathSummary,
  PaytableEntry,
  ProgressiveMath,
  StrategyRow,
} from '../game/types.ts';

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
    renderLegend(summary.bets, summary.decisions !== undefined),
    ...(summary.finiteShoe === undefined ? [] : renderFiniteShoe(summary.bets, summary.finiteShoe)),
    ...summary.bets.map((bet) => renderBet(bet, summary.finiteShoe)),
    ...(summary.decisions === undefined ? [] : renderDecisions(summary.decisions)),
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

function renderLegend(bets: readonly BetMath[], decisions: boolean): string {
  const push = bets.some((bet) => bet.pushFrequency !== undefined)
    ? ' Push is the chance that the stake is simply returned.'
    : '';
  const strategy = decisions
    ? ' The figures assume the strategy below, and count any fee paid for a choice against the ' +
      'return: a fee is never returned, and it is not a stake.'
    : '';
  const progressive = bets.some((bet) => bet.progressive !== undefined)
    ? " A progressive bet's RTP excludes the seed of its meter, which the house funds, and its " +
      'volatility index is taken with the meter at the seed; its terms follow its paytable.'
    : '';
  return (
    `RTP and house edge are per unit staked, pushes included. Hit frequency is the chance that a ` +
    `bet wins in a round.${push} Max exposure is the largest net win per unit staked. The ` +
    `volatility index is the standard deviation of the net result per unit staked.${progressive}` +
    strategy
  );
}

/**
 * A game's decisions: the strategy card, one row per situation with the
 * value of every choice (the best in bold), then what the strategy returns
 * under the table's rules and under each variant.
 */
function renderDecisions({ description, card, figures }: DecisionSummary): string[] {
  const values = (situation: StrategyRow) =>
    situation.values.map((value, index) =>
      index === situation.best ? `**${signed(value)}**` : signed(value),
    );
  const across = (label: string, cell: (figures: DecisionSummary['figures'][number]) => string) =>
    row([label, ...figures.map(cell)]);
  const choices = figures[0]?.choiceFrequencies.map(({ choice }) => choice) ?? [];
  return [
    '### Strategy',
    description,
    [
      row([card.situation, 'Chance', ...card.choices, 'Play']),
      row([':--', '--:', ...card.choices.map(() => '--:'), ':--']),
      ...card.rows.map((situation) =>
        row([
          situation.situation,
          percent(situation.probability, 2),
          ...values(situation),
          situation.play,
        ]),
      ),
    ].join('\n'),
    `Each value is the expected ${card.measure}. The best choice is in bold: it is the strategy ` +
      'the declared figures assume.',
    '### What the strategy returns',
    [
      row(['Figure', ...figures.map((rules) => rules.label)]),
      row([':--', ...figures.map(() => '--:')]),
      across('RTP', (rules) => percent(rules.rtp, 2)),
      across('House edge', (rules) => percent(rules.houseEdge, 2)),
      across('Element of risk', (rules) => percent(rules.elementOfRisk, 2)),
      across('Win frequency', (rules) => percent(rules.hitFrequency, 2)),
      ...choices.map((choice) =>
        across(`${choice}, share of rounds`, (rules) =>
          optional(
            rules.choiceFrequencies.find((frequency) => frequency.choice === choice)?.frequency,
            (value) => percent(value, 2),
          ),
        ),
      ),
      across('Fee paid, share of rounds', (rules) => percent(rules.feeFrequency, 2)),
      across('Average fee per round', (rules) => `${percent(rules.averageFee, 2)} of the bet`),
      across('Volatility index', (rules) => rules.standardDeviation.toFixed(3)),
    ].join('\n'),
    'The house edge is the loss per unit of the main bet, fees included. The element of risk ' +
      'divides the same loss by everything the player pays: the bet and the fees.',
  ];
}

/** The bets' exact figures on the table's own shoe, beside the declared ones. */
function renderFiniteShoe(bets: readonly BetMath[], shoe: string): string[] {
  const rows = bets.flatMap((bet) =>
    bet.finiteShoe === undefined
      ? []
      : [
          row([
            bet.label,
            percent(bet.finiteShoe.hitFrequency, 2),
            percent(bet.finiteShoe.rtp, 2),
            percent(1 - bet.finiteShoe.rtp, 2),
            points(1 - bet.finiteShoe.rtp - bet.houseEdge),
          ]),
        ],
  );
  return [
    `On the table's ${shoe}, every round returns exactly:`,
    [
      row(['Bet', 'Hit frequency', 'RTP', 'House edge', 'Edge vs declared']),
      row([':--', '--:', '--:', '--:', '--:']),
      ...rows,
    ].join('\n'),
  ];
}

function renderBet(bet: BetMath, shoe: string | undefined): string {
  return [
    `### ${bet.label} (${bet.kind === 'main' ? 'main bet' : 'side bet'})`,
    ...(bet.description === undefined ? [] : [bet.description]),
    ...(bet.breakdown === undefined ? [renderPaytable(bet)] : renderBreakdown(bet.breakdown)),
    ...(bet.progressive === undefined ? [] : renderProgressive(bet, bet.progressive, shoe)),
  ].join('\n\n');
}

/** A progressive bet's meter: how it is funded and paid, and what it is worth. */
function renderProgressive(
  bet: BetMath,
  meter: ProgressiveMath,
  shoe: string | undefined,
): string[] {
  const { fixedOdds, fixedRtp, fullShareStake, hitProbability, seed } = meter;
  const finite = shoe === undefined ? undefined : bet.finiteShoe;
  // The same figure on the table's shoe, when the bet declares its figures there.
  const onShoe = (text: (hit: number, fixed: number, rtp: number) => string): string =>
    finite === undefined || shoe === undefined
      ? ''
      : `; ${shoe}: ${text(finite.hitFrequency, finite.rtp - meter.contributionRate, finite.rtp)}`;
  const chance = (p: number) => `${percent(p, 4)} (1 in ${count(1 / p)})`;
  const stakes = [...new Set([bet.min, 100, 500, fullShareStake])]
    .filter((stake) => stake >= bet.min && stake <= fullShareStake)
    .sort((a, b) => a - b);
  const multiple = fixedOdds.to / fixedOdds.per;
  const terms: [string, string][] = [
    ['Hit chance per round', chance(hitProbability) + onShoe((hit) => chance(hit))],
    [
      'Fixed pays alone',
      `${oddsLabel(fixedOdds)}: RTP ${percent(fixedRtp, 2)}, house edge ` +
        percent(1 - fixedRtp, 2) +
        onShoe((_, fixed) => `RTP ${percent(fixed, 2)}`),
    ],
    [
      'Contribution to the meter',
      `${percent(meter.contributionRate, Number.isInteger(meter.contributionRate * 100) ? 0 : 2)} ` +
        'of every stake',
    ],
    [
      'RTP excluding the seed',
      `${percent(meter.rtpExcludingSeed, 2)} (house edge ` +
        `${percent(1 - meter.rtpExcludingSeed, 2)}): the fixed pays plus the contributions, ` +
        'which the meter pays out in the long run' +
        onShoe((_, __, rtp) => percent(rtp, 2)),
    ],
    [
      'Meter share of a hit',
      `stake ÷ ${amount(fullShareStake)} of the meter (the whole meter at ` +
        `${amount(fullShareStake)})`,
    ],
    [
      'RTP with the meter at M',
      `${percent(fixedRtp, 2)} + M ÷ ${amount(fullShareStake / hitProbability)}, for any stake`,
    ],
    [
      `RTP with the meter at its seed (${amount(seed)})`,
      percent(meter.rtpAtSeed, 2) +
        onShoe((hit, fixed) => percent(fixed + (hit * seed) / fullShareStake, 2)),
    ],
    [
      'Break-even meter',
      amount(meter.breakEvenMeter) +
        onShoe((hit, fixed) => amount(((1 - fixed) * fullShareStake) / hit)),
    ],
    [
      'Average cycle',
      `${count(meter.cycleRounds)} rounds from hit to hit` +
        onShoe((hit) => `${count(1 / hit)} rounds`),
    ],
    [
      'Meter at a hit, on average',
      `${amount(seed)} + ${trim(meter.contributionRate * meter.cycleRounds)} × the mean stake: ` +
        stakes
          .map((stake) => `${amount(expectedMeterAtHit(meter, stake))} at ${amount(stake)}`)
          .join(', '),
    ],
    [
      'Seed cost to the house',
      `${amount(meter.seedCostPerRound)} per round at ${amount(fullShareStake)} ` +
        `(${percent(meter.seedCostPerRound / fullShareStake, 2)} of the stake): a cost, not ` +
        'part of the RTP',
    ],
    [
      'Max exposure per round',
      `${trim(multiple)} × ${amount(fullShareStake)} + the meter: ` +
        `${amount(multiple * fullShareStake + seed)} with the meter at its seed, unbounded as ` +
        'it grows',
    ],
    [
      'Volatility index at the seed',
      bet.standardDeviation === undefined ? '—' : bet.standardDeviation.toFixed(3),
    ],
  ];
  return [
    [
      row(['Meter', 'Value']),
      row([':--', ':--']),
      ...terms.map(([term, value]) => row([term, value])),
    ].join('\n'),
    `The meter at a hit is exact on average when every cycle starts at the seed, as it does at ` +
      `${amount(fullShareStake)}, where each hit takes the whole meter; smaller stakes leave part ` +
      'of it behind, so their average is a little higher.',
  ];
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
  if ('push' in entry) return 'Push';
  const jackpot = entry.jackpot === undefined ? undefined : jackpotLabel(entry.jackpot);
  if (!('odds' in entry)) return jackpot ?? '';
  return jackpot === undefined ? oddsLabel(entry.odds) : `${oddsLabel(entry.odds)} + ${jackpot}`;
}

function jackpotLabel({ jackpotId, share, fullShareStake }: JackpotPayout): string {
  const part = share === 1 ? '' : `${percent(share, 0)} of `;
  return fullShareStake === undefined
    ? `${part}${jackpotId} jackpot`
    : `stake ÷ ${amount(fullShareStake)} of ${part}the meter`;
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

/** 0.0815 → "+0.082", −1 → "−1.000". */
function signed(value: number, digits = 3): string {
  const text = Math.abs(value).toFixed(digits);
  return `${value < 0 && Number(text) !== 0 ? '−' : '+'}${text}`;
}

/** −0.0057 → "−0.57 pp", 0.0301 → "+3.01 pp". */
function points(difference: number): string {
  const text = Math.abs(difference * 100).toFixed(2);
  return `${difference < 0 && Number(text) !== 0 ? '−' : '+'}${text} pp`;
}

/** 1295.6 → "1,296". */
function count(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** 4 → "4", 0.5 → "0.5", 1/3 → "0.33". */
function trim(value: number): string {
  return String(Number(value.toFixed(2)));
}

function amount(cents: number): string {
  const [whole = '0', fraction = '00'] = (cents / 100).toFixed(2).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
}
