import {
  oddsLabel,
  type BetBreakdown,
  type BetMath,
  type JackpotPayout,
  type MathSummary,
  type PaytableEntry,
} from '@casinogames/engine';
import { h } from '../dom/h.ts';
import { formatCents, formatPercent } from '../format/format.ts';
import { Modal } from './Modal.ts';
import './paytable.css';

/** The paytable of every bet, generated from the game's math summary. */
export function createPaytable(summary: MathSummary): HTMLElement {
  return h(
    'div',
    { class: 'cg-paytable' },
    ...summary.bets.map(renderBet),
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
        : stat('Hit frequency', formatPercent(bet.hitFrequency)),
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
          h('td', { class: 'cg-num' }, pays(entry)),
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
