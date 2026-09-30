import {
  ENTRE_DADOS_BETS,
  type BetDefinition,
  type EntreDadosBetId,
  type Odds,
  type Spread,
} from '@casinogames/engine';
import { h } from '@casinogames/ui';
import { createSpots, markOutlook, type SpotCallbacks, type TableFelt } from '../spots.ts';

export interface EntreDadosFelt extends TableFelt<EntreDadosBetId> {
  /** Lights the spread's column in the printed paytable; null clears it. */
  showSpread(spread: Spread | null): void;
}

/** Reminders printed under each bet's name. */
const REMINDERS: Readonly<Record<EntreDadosBetId, string>> = {
  entre: 'card between the dice',
  exato: 'card on a die',
  'olho-de-boi': 'middle card',
  dobros: 'a pair',
  triplo: 'pair + its card',
};

/** "4:1", as printed on felt. */
function compact({ to, per }: Odds): string {
  return `${to}:${per}`;
}

function sideOdds(bet: BetDefinition): string {
  const entry = bet.paytable[0];
  return entry !== undefined && 'odds' in entry ? `${compact(entry.odds)} · ` : '';
}

/**
 * The layout: Entre in the centre, the four side bets around it, and Entre's
 * paytable printed along the bottom. Every label and payout comes from the
 * engine's bet definitions.
 */
export function createFelt(callbacks: SpotCallbacks<EntreDadosBetId>): EntreDadosFelt {
  const spots = createSpots(
    ENTRE_DADOS_BETS,
    (bet) => (bet.kind === 'main' ? REMINDERS[bet.id] : `${sideOdds(bet)}${REMINDERS[bet.id]}`),
    callbacks,
  );

  const entre = ENTRE_DADOS_BETS.find((bet) => bet.id === 'entre')!;
  const columns = entre.paytable.map((entry) => ({
    key: entry.id.replace('spread-', ''),
    spread: entry.id.startsWith('spread-') ? entry.id.replace('spread-', '') : '1 · pair',
    pays: 'odds' in entry ? compact(entry.odds) : 'push',
  }));
  const cells = (row: 'spread' | 'pays') =>
    columns.map((column) => h('td', { dataset: { spread: column.key } }, column[row]));
  const spreadRow = cells('spread');
  const paysRow = cells('pays');
  const paytable = h(
    'table',
    { class: 'tb-paytable' },
    h('caption', { class: 'cg-sr-only' }, 'Entre pays by spread (high die minus low die)'),
    h(
      'tbody',
      null,
      h('tr', null, h('th', { scope: 'row' }, 'Spread'), ...spreadRow),
      h('tr', null, h('th', { scope: 'row' }, 'Pays'), ...paysRow),
    ),
  );

  // The felt is a size container: its layout follows its own width, which
  // depends on the table's layout rather than on the viewport.
  const element = h(
    'div',
    { class: 'tb-felt ed-felt', role: 'group', 'aria-label': 'Bets' },
    h(
      'div',
      { class: 'ed-felt__layout' },
      ...ENTRE_DADOS_BETS.map((bet) =>
        h('div', { class: 'ed-felt__spot', dataset: { bet: bet.id } }, spots[bet.id].element),
      ),
      paytable,
    ),
  );

  return {
    element,
    spots,
    showSpread(spread) {
      const lit = spread === null ? null : spread >= 2 ? String(spread) : 'push';
      for (const cell of [...spreadRow, ...paysRow]) {
        cell.toggleAttribute('data-lit', cell.dataset.spread === lit);
      }
    },
    showOutlook(outlook) {
      markOutlook(spots, outlook);
    },
    destroy() {
      for (const spot of Object.values(spots)) spot.destroy();
      element.remove();
    },
  };
}
