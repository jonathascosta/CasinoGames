import {
  ESPELHO_BETS,
  ESPELHO_CONFIG,
  JACKPOT_BET,
  type BetDefinition,
  type Cents,
  type EspelhoBetId,
} from '@casinogames/engine';
import { ProgressiveMeter, formatCents, h, type Motion, type Store } from '@casinogames/ui';
import { createSpots, markOutlook, type SpotCallbacks, type TableFelt } from '../spots.ts';

/** Reminders printed under each bet's name. */
const REMINDERS: Readonly<Record<EspelhoBetId, string>> = {
  espelho: 'your dice outrank the cards · ties lose',
  empate: 'the hands rank equal',
  'somas-iguais': 'the same sum',
  'par-vs-par': 'both hands pairs',
  'espelho-perfeito': 'the same pair',
  'seis-seis': '6-6 against 6-6 + the meter',
};

function caption(bet: BetDefinition & { readonly id: EspelhoBetId }): string {
  const entry = bet.paytable[0];
  if (bet.kind === 'main' || entry === undefined || !('odds' in entry)) return REMINDERS[bet.id];
  return `${entry.odds.to}:1 · ${REMINDERS[bet.id]}`;
}

const { seed, contributionRate } = ESPELHO_CONFIG.jackpot;
const RATE = `${Math.round(contributionRate * 100)}%`;

/** What the jackpot spot's tooltip says: the meter, its seed and how it is fed and paid. */
export function jackpotTitle(meter: Cents): string {
  return (
    `Meter ${formatCents(meter)} · seed ${formatCents(seed)} · ${RATE} of every stake on this ` +
    `bet feeds it · a hit pays stake ÷ ${formatCents(ESPELHO_CONFIG.sideMax)} of it`
  );
}

export interface EspelhoFelt extends TableFelt<EspelhoBetId> {
  readonly meter: ProgressiveMeter;
}

/**
 * The layout: the progressive meter across the top, then Espelho in the
 * centre with 6-6 vs 6-6 under it and two side bets on each side. Every
 * label and payout comes from the engine's definitions.
 */
export function createFelt(
  callbacks: SpotCallbacks<EspelhoBetId>,
  meterStore: Store<Cents>,
  motion: Motion,
): EspelhoFelt {
  const spots = createSpots(
    ESPELHO_BETS as readonly (BetDefinition & { readonly id: EspelhoBetId })[],
    caption,
    callbacks,
  );
  const meter = new ProgressiveMeter({
    store: meterStore,
    label: '6-6 vs 6-6 progressive',
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
    { class: 'tb-felt es-felt', role: 'group', 'aria-label': 'Bets' },
    h('div', { class: 'es-felt__meter' }, meter.element),
    h(
      'div',
      { class: 'es-felt__layout' },
      ...ESPELHO_BETS.map((bet) =>
        h(
          'div',
          { class: 'es-felt__spot', dataset: { bet: bet.id } },
          spots[bet.id as EspelhoBetId].element,
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
