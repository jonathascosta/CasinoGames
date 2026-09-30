import {
  DICE_SPREAD_BETS,
  type BetDefinition,
  type DiceSpreadBetId,
  type Odds,
  type Spread,
} from '@casinogames/engine';
import { h } from '@casinogames/ui';
import { createSpots, markOutlook, type SpotCallbacks, type TableFelt } from '../spots.ts';

export interface DiceSpreadFelt extends TableFelt<DiceSpreadBetId> {
  /** Lights the spread's column in the printed paytable; null clears it. */
  showSpread(spread: Spread | null): void;
}

/** Reminders printed under each bet's name. */
const REMINDERS: Readonly<Record<DiceSpreadBetId, string>> = {
  between: 'card between the dice',
  match: 'card on a die',
  bullseye: 'middle card',
  doubles: 'a pair',
  triple: 'pair + its card',
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
 * The layout: Between in the centre, the four side bets around it, and Between's
 * paytable printed along the bottom. Every label and payout comes from the
 * engine's bet definitions.
 */
export function createFelt(callbacks: SpotCallbacks<DiceSpreadBetId>): DiceSpreadFelt {
  const spots = createSpots(
    DICE_SPREAD_BETS,
    (bet) => (bet.kind === 'main' ? REMINDERS[bet.id] : `${sideOdds(bet)}${REMINDERS[bet.id]}`),
    callbacks,
  );

  const between = DICE_SPREAD_BETS.find((bet) => bet.id === 'between')!;
  const columns = between.paytable.map((entry) => ({
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
    h('caption', { class: 'cg-sr-only' }, 'Between pays by spread (high die minus low die)'),
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
    { class: 'tb-felt ds-felt', role: 'group', 'aria-label': 'Bets' },
    h(
      'div',
      { class: 'ds-felt__layout' },
      ...DICE_SPREAD_BETS.map((bet) =>
        h('div', { class: 'ds-felt__spot', dataset: { bet: bet.id } }, spots[bet.id].element),
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
