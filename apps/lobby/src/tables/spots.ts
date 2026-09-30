import type { BetDefinition, Cents } from '@casinogames/engine';
import { BetSpot, type BetRejection } from '@casinogames/ui';

/** What the round has left for a placed bet before it settles. */
export type BetOutlook = 'live' | 'won' | 'push' | 'out';

export interface SpotCallbacks<TBetId extends string> {
  /** The chip selected on the rail. */
  readonly chipValue: () => Cents;
  /** Whether `amount` more can be staked (the bankroll covers the new total). */
  readonly canAdd: (amount: Cents) => boolean;
  readonly onChange: (betId: TBetId, amount: Cents) => void;
  readonly onReject: (reason: BetRejection) => void;
}

/** The part of a felt a table drives: the spots, their outlook marks, and teardown. */
export interface TableFelt<TBetId extends string> {
  readonly element: HTMLElement;
  readonly spots: Readonly<Record<TBetId, BetSpot>>;
  /** Marks what the round leaves each placed bet; null clears the marks. */
  showOutlook(outlook: Partial<Record<TBetId, BetOutlook>> | null): void;
  destroy(): void;
}

/** One bet spot per definition, labelled and limited by the engine's bet definitions. */
export function createSpots<TBetId extends string>(
  bets: readonly (BetDefinition & { readonly id: TBetId })[],
  caption: (bet: BetDefinition & { readonly id: TBetId }) => string,
  callbacks: SpotCallbacks<TBetId>,
): Record<TBetId, BetSpot> {
  return Object.fromEntries(
    bets.map((bet) => [
      bet.id,
      new BetSpot({
        id: bet.id,
        label: bet.label,
        caption: caption(bet),
        variant: bet.kind,
        max: bet.max,
        chipValue: callbacks.chipValue,
        canAdd: callbacks.canAdd,
        onChange: (amount) => {
          callbacks.onChange(bet.id, amount);
        },
        onReject: callbacks.onReject,
      }),
    ]),
  ) as Record<TBetId, BetSpot>;
}

/** Sets or clears each spot's outlook mark (data-outlook, styled by table.css). */
export function markOutlook<TBetId extends string>(
  spots: Readonly<Record<TBetId, BetSpot>>,
  outlook: Partial<Record<TBetId, BetOutlook>> | null,
): void {
  for (const [id, spot] of Object.entries(spots) as [TBetId, BetSpot][]) {
    const value = outlook?.[id];
    if (value === undefined) delete spot.element.dataset.outlook;
    else spot.element.dataset.outlook = value;
  }
}
