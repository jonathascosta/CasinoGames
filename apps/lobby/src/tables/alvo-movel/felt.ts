import { ALVO_MOVEL_BETS, type AlvoMovelBetId, type BetDefinition } from '@casinogames/engine';
import { h } from '@casinogames/ui';
import { createSpots, markOutlook, type SpotCallbacks, type TableFelt } from '../spots.ts';
import { toOne } from './target-board.ts';

/** Reminders printed under each bet's name. */
const REMINDERS: Readonly<Record<AlvoMovelBetId, string>> = {
  acerta: 'total lands on the target',
  'primeira-carta': 'first card on target',
  'tres-ou-mais': '3 cards or more',
};

function caption(bet: BetDefinition & { readonly id: AlvoMovelBetId }): string {
  const entry = bet.paytable[0];
  const odds = bet.kind === 'side' && entry !== undefined && 'odds' in entry ? entry.odds : null;
  return odds === null ? REMINDERS[bet.id] : `${toOne(odds)} · ${REMINDERS[bet.id]}`;
}

/**
 * The layout: Acerta in the centre and a side bet on each side. Acerta's
 * payouts by target are on the target board, where the round shows them.
 * Every label and payout comes from the engine's definitions.
 */
export function createFelt(callbacks: SpotCallbacks<AlvoMovelBetId>): TableFelt<AlvoMovelBetId> {
  const spots = createSpots(ALVO_MOVEL_BETS, caption, callbacks);
  // The felt is a size container: its layout follows its own width, which
  // depends on the table's layout rather than on the viewport.
  const element = h(
    'div',
    { class: 'tb-felt am-felt', role: 'group', 'aria-label': 'Bets' },
    h(
      'div',
      { class: 'am-felt__layout' },
      ...ALVO_MOVEL_BETS.map((bet) =>
        h('div', { class: 'am-felt__spot', dataset: { bet: bet.id } }, spots[bet.id].element),
      ),
    ),
  );

  return {
    element,
    spots,
    showOutlook(outlook) {
      markOutlook(spots, outlook);
    },
    destroy() {
      for (const spot of Object.values(spots)) spot.destroy();
      element.remove();
    },
  };
}
