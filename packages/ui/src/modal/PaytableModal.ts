import {
  oddsLabel,
  type BetBreakdown,
  type BetMath,
  type DecisionSummary,
  type JackpotPayout,
  type MathSummary,
  type PaytableEntry,
} from '@casinogames/engine';
import { h } from '../dom/h.ts';
import { formatCents, formatPercent } from '../format/format.ts';
import { Modal } from './Modal.ts';
import './paytable.css';

/** The paytable of every bet, generated from the game's math summary, with its strategy card. */
export function createPaytable(summary: MathSummary): HTMLElement {
  return h(
    'div',
    { class: 'cg-paytable' },
    ...summary.bets.map(renderBet),
    summary.decisions === undefined ? null : renderStrategy(summary.decisions),
    h(
      'p',
      { class: 'cg-paytable__note' },
      'RTP (return to player) is the long-run share of wagers paid back, pushes included; ' +
        'house edge = 1 − RTP. Hit frequency is the chance that a bet wins in a round, max ' +
        'exposure the largest net win per unit staked, and the volatility index the standard ' +
        'deviation of the net result per unit staked. These figures are generated from the game ' +
        'code and verified by exact enumeration and multi-million-round seeded simulations.',
    ),
  );
}

export function createPaytableModal(summary: MathSummary): Modal {
  return new Modal({
    title: `${summary.gameName} · Paytable`,
    size: 'lg',
    content: () => createPaytable(summary),
  });
}

function renderBet(bet: BetMath): HTMLElement {
  return h(
    'section',
    { class: 'cg-paytable__bet' },
    h(
      'header',
      { class: 'cg-paytable__header' },
      h('h3', null, bet.label),
      h(
        'span',
        { class: 'cg-paytable__kind', dataset: { kind: bet.kind } },
        bet.kind === 'main' ? 'Main bet' : 'Side bet',
      ),
    ),
    bet.description === undefined
      ? null
      : h('p', { class: 'cg-paytable__description' }, bet.description),
    // Wide tables scroll inside the card rather than widening the dialog.
    h(
      'div',
      { class: 'cg-paytable__lines' },
      bet.breakdown === undefined ? renderLines(bet) : renderBreakdown(bet.breakdown),
    ),
    h(
      'dl',
      { class: 'cg-paytable__stats' },
      stat('RTP', formatPercent(bet.rtp)),
      stat('House edge', formatPercent(bet.houseEdge)),
      bet.hitFrequency === undefined
        ? null
        : // Rare hits keep a third decimal: 0.077%, not 0.08%.
          stat('Hit frequency', formatPercent(bet.hitFrequency, bet.hitFrequency < 0.01 ? 3 : 2)),
      bet.pushFrequency === undefined ? null : stat('Push', formatPercent(bet.pushFrequency)),
      bet.maxExposure === undefined
        ? null
        : stat('Max exposure', `${Number(bet.maxExposure.toFixed(2))}× stake`),
      bet.standardDeviation === undefined
        ? null
        : stat('Volatility index', bet.standardDeviation.toFixed(2)),
      stat('Limits', `${formatCents(bet.min)} – ${formatCents(bet.max)}`),
    ),
  );
}

/** The bet's paytable lines: outcome, payout and, when declared, probability. */
function renderLines(bet: BetMath): HTMLElement {
  const withProbability = bet.paytable.some((entry) => entry.probability !== undefined);
  return h(
    'table',
    { class: 'cg-table' },
    h(
      'thead',
      null,
      h(
        'tr',
        null,
        h('th', { scope: 'col' }, 'Outcome'),
        h('th', { scope: 'col' }, 'Pays'),
        withProbability ? h('th', { scope: 'col' }, 'Probability') : null,
      ),
    ),
    h(
      'tbody',
      null,
      ...bet.paytable.map((entry) =>
        h(
          'tr',
          null,
          h('td', null, entry.label),
          h(
            'td',
            { class: 'jackpot' in entry ? 'cg-num cg-paytable__meter-pays' : 'cg-num' },
            pays(entry),
          ),
          withProbability
            ? h(
                'td',
                { class: 'cg-num' },
                entry.probability === undefined ? '—' : formatPercent(entry.probability, 3),
              )
            : null,
        ),
      ),
    ),
  );
}

/** A bet paid under a condition (Alvo Móvel's target): one row per value, with the figures given it. */
function renderBreakdown({ by, rows }: BetBreakdown): HTMLElement {
  return h(
    'table',
    { class: 'cg-table cg-paytable__breakdown' },
    h(
      'caption',
      { class: 'cg-paytable__caption' },
      `Chance is how often a round has each ${by.toLowerCase()}; the hit chance and house edge ` +
        `are for the rounds with that ${by.toLowerCase()}.`,
    ),
    h(
      'thead',
      null,
      h(
        'tr',
        null,
        h('th', { scope: 'col' }, by),
        h('th', { scope: 'col' }, 'Chance'),
        h('th', { scope: 'col' }, 'Pays'),
        h('th', { scope: 'col' }, 'Hit chance'),
        h('th', { scope: 'col' }, 'House edge'),
      ),
    ),
    h(
      'tbody',
      null,
      ...rows.map((row) =>
        h(
          'tr',
          null,
          h('th', { scope: 'row', class: 'cg-num' }, row.value),
          h('td', { class: 'cg-num' }, formatPercent(row.probability)),
          h('td', { class: 'cg-num' }, row.paytable.map(pays).join(', ')),
          h('td', { class: 'cg-num' }, formatPercent(row.hitFrequency)),
          h('td', { class: 'cg-num' }, formatPercent(row.houseEdge)),
        ),
      ),
    ),
  );
}

/**
 * A game's decisions: in each situation how to play it and the value of
 * every choice (the best highlighted), then what that strategy returns under
 * the rules and their variants. The RTPs above assume it. The play comes
 * first, so a narrow screen shows it before the figures.
 */
function renderStrategy({ description, card, figures }: DecisionSummary): HTMLElement {
  const value = (number: number) => `${number < 0 ? '−' : '+'}${Math.abs(number).toFixed(3)}`;
  return h(
    'section',
    { class: 'cg-paytable__bet cg-paytable__strategy' },
    h('header', { class: 'cg-paytable__header' }, h('h3', null, 'Strategy')),
    h('p', { class: 'cg-paytable__description' }, description),
    h(
      'div',
      { class: 'cg-paytable__lines' },
      h(
        'table',
        { class: 'cg-table cg-paytable__card' },
        h(
          'caption',
          { class: 'cg-paytable__caption' },
          `Each value is the expected ${card.measure}; the best choice is highlighted.`,
        ),
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            h('th', { scope: 'col' }, card.situation),
            h('th', { scope: 'col' }, 'Play'),
            ...card.choices.map((choice) => h('th', { scope: 'col' }, choice)),
            h('th', { scope: 'col' }, 'Chance'),
          ),
        ),
        h(
          'tbody',
          null,
          ...card.rows.map((row) =>
            h(
              'tr',
              null,
              h('th', { scope: 'row', class: 'cg-num' }, row.situation),
              h('td', { class: 'cg-paytable__play' }, row.play),
              ...row.values.map((number, index) =>
                h(
                  'td',
                  { class: index === row.best ? 'cg-num cg-paytable__best' : 'cg-num' },
                  value(number),
                ),
              ),
              h('td', { class: 'cg-num' }, formatPercent(row.probability)),
            ),
          ),
        ),
      ),
    ),
    h(
      'div',
      { class: 'cg-paytable__lines' },
      h(
        'table',
        { class: 'cg-table cg-paytable__rules' },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            h('th', { scope: 'col' }, 'The strategy returns'),
            ...figures.map((rules) => h('th', { scope: 'col' }, rules.label)),
          ),
        ),
        h(
          'tbody',
          null,
          figureRow('RTP', figures, (rules) => formatPercent(rules.rtp)),
          figureRow('House edge', figures, (rules) => formatPercent(rules.houseEdge)),
          ...(figures[0]?.choiceFrequencies ?? []).map(({ choice }) =>
            figureRow(`${choice}, share of rounds`, figures, (rules) => {
              const frequency = rules.choiceFrequencies.find((entry) => entry.choice === choice);
              return frequency === undefined ? '—' : formatPercent(frequency.frequency);
            }),
          ),
          figureRow('Fee paid, share of rounds', figures, (rules) =>
            formatPercent(rules.feeFrequency),
          ),
        ),
      ),
    ),
  );
}

function figureRow(
  label: string,
  figures: DecisionSummary['figures'],
  cell: (rules: DecisionSummary['figures'][number]) => string,
): HTMLElement {
  return h(
    'tr',
    null,
    h('th', { scope: 'row' }, label),
    ...figures.map((rules) => h('td', { class: 'cg-num' }, cell(rules))),
  );
}

function pays(entry: PaytableEntry): string {
  if ('push' in entry) return 'Push';
  const jackpot = entry.jackpot === undefined ? undefined : jackpotLabel(entry.jackpot);
  if (!('odds' in entry)) return jackpot ?? '';
  return jackpot === undefined ? oddsLabel(entry.odds) : `${oddsLabel(entry.odds)} + ${jackpot}`;
}

function jackpotLabel({ jackpotId, share, fullShareStake }: JackpotPayout): string {
  const part = share === 1 ? '' : `${formatPercent(share, 0)} of `;
  return fullShareStake === undefined
    ? `${part}${jackpotId} jackpot`
    : `stake ÷ ${formatCents(fullShareStake)} of ${part}the meter`;
}

function stat(label: string, value: string): HTMLElement {
  return h('div', null, h('dt', null, label), h('dd', { class: 'cg-num' }, value));
}
