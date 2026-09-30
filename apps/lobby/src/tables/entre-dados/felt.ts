import {
  ENTRE_DADOS_BETS,
  type BetDefinition,
  type Cents,
  type EntreDadosBetId,
  type Odds,
  type Spread,
} from '@casinogames/engine';
import { BetSpot, h, type BetRejection } from '@casinogames/ui';

/** How the roll leaves a placed bet before the card is revealed. */
export type BetOutlook = 'live' | 'won' | 'push' | 'out';

export interface FeltOptions {
  /** The chip selected on the rail. */
  readonly chipValue: () => Cents;
  /** Whether `amount` more can be staked (the bankroll covers the new total). */
  readonly canAdd: (amount: Cents) => boolean;
  readonly onChange: (betId: EntreDadosBetId, amount: Cents) => void;
  readonly onReject: (reason: BetRejection) => void;
}

export interface Felt {
  readonly element: HTMLElement;
  readonly spots: Readonly<Record<EntreDadosBetId, BetSpot>>;
  /** Lights the spread's column in the printed paytable; null clears it. */
  showSpread(spread: Spread | null): void;
  /** Marks what the roll means for each placed bet; null clears the marks. */
  showOutlook(outlook: Partial<Record<EntreDadosBetId, BetOutlook>> | null): void;
  destroy(): void;
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
export function createFelt(options: FeltOptions): Felt {
  const spots = Object.fromEntries(
    ENTRE_DADOS_BETS.map((bet) => [
      bet.id,
      new BetSpot({
        id: bet.id,
        label: bet.label,
        caption: bet.kind === 'main' ? REMINDERS[bet.id] : `${sideOdds(bet)}${REMINDERS[bet.id]}`,
        variant: bet.kind,
        max: bet.max,
        chipValue: options.chipValue,
        canAdd: options.canAdd,
        onChange: (amount) => {
          options.onChange(bet.id, amount);
        },
        onReject: options.onReject,
      }),
    ]),
  ) as Record<EntreDadosBetId, BetSpot>;

  const entre = ENTRE_DADOS_BETS.find((bet) => bet.id === 'entre')!;
  const columns = entre.paytable.map((entry) => ({
    key: entry.id.replace('spread-', ''),
    spread: entry.id.startsWith('spread-') ? entry.id.replace('spread-', '') : '1 · pair',
    pays: 'odds' in entry ? compact(entry.odds) : 'push',
  }));
  const paytable = h(
    'table',
    { class: 'ed-paytable' },
    h('caption', { class: 'cg-sr-only' }, 'Entre pays by spread (high die minus low die)'),
    h(
      'tbody',
      null,
      h(
        'tr',
        null,
        h('th', { scope: 'row' }, 'Spread'),
        ...columns.map((column) => h('td', { dataset: { spread: column.key } }, column.spread)),
      ),
      h(
        'tr',
        null,
        h('th', { scope: 'row' }, 'Pays'),
        ...columns.map((column) => h('td', { dataset: { spread: column.key } }, column.pays)),
      ),
    ),
  );

  // The felt is a size container: its layout follows its own width, which
  // depends on the table's layout rather than on the viewport.
  const element = h(
    'div',
    { class: 'ed-felt', role: 'group', 'aria-label': 'Bets' },
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
      if (spread === null) delete element.dataset.spread;
      else element.dataset.spread = spread >= 2 ? String(spread) : 'push';
    },
    showOutlook(outlook) {
      for (const [id, spot] of Object.entries(spots) as [EntreDadosBetId, BetSpot][]) {
        const value = outlook?.[id];
        if (value === undefined) delete spot.element.dataset.outlook;
        else spot.element.dataset.outlook = value;
      }
    },
    destroy() {
      for (const spot of Object.values(spots)) spot.destroy();
      element.remove();
    },
  };
}
