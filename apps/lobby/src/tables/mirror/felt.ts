import {
  MIRROR_BETS,
  MIRROR_CONFIG,
  JACKPOT_BET,
  type BetDefinition,
  type Cents,
  type MirrorBetId,
} from '@casinogames/engine';
import { ProgressiveMeter, formatCents, h, type Motion, type Store } from '@casinogames/ui';
import { createSpots, markOutlook, type SpotCallbacks, type TableFelt } from '../spots.ts';

/** Reminders printed under each bet's name. */
const REMINDERS: Readonly<Record<MirrorBetId, string>> = {
  mirror: 'your dice outrank the cards · ties lose',
  tie: 'the hands rank equal',
  'equal-sums': 'the same sum',
  'pair-vs-pair': 'both hands pairs',
  'perfect-mirror': 'the same pair',
  'double-sixes': '6-6 against 6-6 + the meter',
};

function caption(bet: BetDefinition & { readonly id: MirrorBetId }): string {
  const entry = bet.paytable[0];
  if (bet.kind === 'main' || entry === undefined || !('odds' in entry)) return REMINDERS[bet.id];
  return `${entry.odds.to}:1 · ${REMINDERS[bet.id]}`;
}

const { seed, contributionRate } = MIRROR_CONFIG.jackpot;
const RATE = `${Math.round(contributionRate * 100)}%`;

/** What the jackpot spot's tooltip says: the meter, its seed and how it is fed and paid. */
export function jackpotTitle(meter: Cents): string {
  return (
    `Meter ${formatCents(meter)} · seed ${formatCents(seed)} · ${RATE} of every stake on this ` +
    `bet feeds it · a hit pays stake ÷ ${formatCents(MIRROR_CONFIG.sideMax)} of it`
  );
}

export interface MirrorFelt extends TableFelt<MirrorBetId> {
  readonly meter: ProgressiveMeter;
}

/**
 * The layout: the progressive meter across the top, then Mirror in the
 * centre with Double Sixes under it and two side bets on each side. Every
 * label and payout comes from the engine's definitions.
 */
export function createFelt(
  callbacks: SpotCallbacks<MirrorBetId>,
  meterStore: Store<Cents>,
  motion: Motion,
): MirrorFelt {
  const spots = createSpots(
    MIRROR_BETS as readonly (BetDefinition & { readonly id: MirrorBetId })[],
    caption,
    callbacks,
  );
  const meter = new ProgressiveMeter({
    store: meterStore,
    label: 'Double Sixes progressive',
    caption: `${RATE} of every 6-6 stake · seed ${formatCents(seed)}`,
    motion,
  });
  const jackpotSpot = spots[JACKPOT_BET].element;
  jackpotSpot.title = jackpotTitle(meterStore.get());
  const unsubscribe = meterStore.subscribe((amount) => {
    jackpotSpot.title = jackpotTitle(amount);
  });

  // The felt is a size container: its layout follows its own width, which
  // depends on the table's layout rather than on the viewport.
  const element = h(
    'div',
    { class: 'tb-felt mr-felt', role: 'group', 'aria-label': 'Bets' },
    h('div', { class: 'mr-felt__meter' }, meter.element),
    h(
      'div',
      { class: 'mr-felt__layout' },
      ...MIRROR_BETS.map((bet) =>
        h(
          'div',
          { class: 'mr-felt__spot', dataset: { bet: bet.id } },
          spots[bet.id as MirrorBetId].element,
        ),
      ),
    ),
  );

  return {
    element,
    spots,
    meter,
    showOutlook(outlook) {
      markOutlook(spots, outlook);
    },
    destroy() {
      unsubscribe();
      meter.destroy();
      for (const spot of Object.values(spots)) spot.destroy();
      element.remove();
    },
  };
}
