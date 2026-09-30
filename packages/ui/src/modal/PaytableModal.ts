import { oddsLabel, type BetMath, type MathSummary, type PaytableEntry } from '@casinogames/engine';
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
  const withProbability = bet.paytable.some((entry) => entry.probability !== undefined);
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
    h(
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

function pays(entry: PaytableEntry): string {
  if ('odds' in entry) return oddsLabel(entry.odds);
  if ('push' in entry) return 'Push';
  const share = entry.jackpot.share === 1 ? '' : `${formatPercent(entry.jackpot.share, 0)} of `;
  return `${share}${entry.jackpot.jackpotId} jackpot`;
}

function stat(label: string, value: string): HTMLElement {
  return h('div', null, h('dt', null, label), h('dd', { class: 'cg-num' }, value));
}
