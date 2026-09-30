import {
  TRANCAR_BET,
  TRANCAR_BETS,
  TRANCAR_CONFIG,
  type BetDefinition,
  type TrancarBetId,
} from '@casinogames/engine';
import { h } from '@casinogames/ui';
import { createSpots, markOutlook, type SpotCallbacks, type TableFelt } from '../spots.ts';

const { fee, freeOneOne } = TRANCAR_CONFIG.rules;
/** The fee as the felt prints it: "40%". */
export const FEE_RATE = `${String(Math.round((100 * fee.numerator) / fee.denominator))}%`;

/**
 * The felt: the one bet, with the house rules printed under it. The label,
 * limits and payout come from the engine's definition.
 */
export function createFelt(callbacks: SpotCallbacks<TrancarBetId>): TableFelt<TrancarBetId> {
  const spots = createSpots(
    TRANCAR_BETS as readonly (BetDefinition & { readonly id: TrancarBetId })[],
    () => 'your dice beat the cards · 1 to 1',
    callbacks,
  );
  const element = h(
    'div',
    { class: 'tb-felt tr-felt', role: 'group', 'aria-label': 'Bets' },
    spots[TRANCAR_BET].element,
    h(
      'p',
      { class: 'tr-felt__terms' },
      h('span', null, 'Ties lose'),
      h('span', null, `Trancar costs ${FEE_RATE} of the bet`),
      freeOneOne ? h('span', null, '1-1 re-rolls free') : null,
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
