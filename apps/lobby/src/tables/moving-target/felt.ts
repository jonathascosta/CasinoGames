import {
  MOVING_TARGET_BETS,
  type MovingTargetBetId,
  type BetDefinition,
} from '@casinogames/engine';
import { h } from '@casinogames/ui';
import { createSpots, markOutlook, type SpotCallbacks, type TableFelt } from '../spots.ts';
import { toOne } from './target-board.ts';

/** Reminders printed under each bet's name. */
const REMINDERS: Readonly<Record<MovingTargetBetId, string>> = {
  'exact-hit': 'total lands on the target',
  'first-card': 'first card on target',
  'three-plus-cards': '3 cards or more',
};

function caption(bet: BetDefinition & { readonly id: MovingTargetBetId }): string {
  const entry = bet.paytable[0];
  const odds = bet.kind === 'side' && entry !== undefined && 'odds' in entry ? entry.odds : null;
  return odds === null ? REMINDERS[bet.id] : `${toOne(odds)} · ${REMINDERS[bet.id]}`;
}

/**
 * The layout: Exact Hit in the centre and a side bet on each side. Exact Hit's
 * payouts by target are on the target board, where the round shows them.
 * Every label and payout comes from the engine's definitions.
 */
export function createFelt(
  callbacks: SpotCallbacks<MovingTargetBetId>,
): TableFelt<MovingTargetBetId> {
  const spots = createSpots(MOVING_TARGET_BETS, caption, callbacks);
  // The felt is a size container: its layout follows its own width, which
  // depends on the table's layout rather than on the viewport.
  const element = h(
    'div',
    { class: 'tb-felt mt-felt', role: 'group', 'aria-label': 'Bets' },
    h(
      'div',
      { class: 'mt-felt__layout' },
      ...MOVING_TARGET_BETS.map((bet) =>
        h('div', { class: 'mt-felt__spot', dataset: { bet: bet.id } }, spots[bet.id].element),
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
