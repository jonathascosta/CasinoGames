/** Handlers keyed by event type, each receiving the narrowed event. */
export type EventHandlers<E extends { readonly type: string }> = {
  readonly [K in E['type']]?: (event: Extract<E, { readonly type: K }>) => void | Promise<void>;
};

/**
 * Plays a round's events in order, awaiting each handler, so animations run
 * one after another exactly as the engine recorded them. Events without a
 * handler are skipped; aborting stops before the next event.
 *
 * @example
 * await replayEvents(state.events.slice(shown), {
 *   'dice-rolled': (event) => roller.roll(event.dice),
 *   'card-dealt': (event) => dealer.deal(event.card, event.to, { faceUp: event.faceUp }),
 * });
 */
export async function replayEvents<E extends { readonly type: string }>(
  events: readonly E[],
  handlers: EventHandlers<E>,
  options: { readonly signal?: AbortSignal } = {},
): Promise<void> {
  for (const event of events) {
    if (options.signal?.aborted === true) return;
    const handler = handlers[event.type as E['type']] as
      ((event: E) => void | Promise<void>) | undefined;
    await handler?.(event);
  }
}
