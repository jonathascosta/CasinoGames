import {
  BankrollDisplay,
  createSoundToggle,
  createTurboToggle,
  h,
  type Child,
} from '@casinogames/ui';
import type { Services } from '../services.ts';

/** Minimum stake of the demo tables; below it the balance offers a top-up. */
export const TOP_UP_BELOW = 50;

/**
 * The bar across the top of every page: `leading` on the left (the brand or
 * a back link), then the balance and the turbo and sound switches. A table
 * that shows the balance beside its chips passes `balance: false`.
 */
export function createTopBar(
  services: Services,
  leading: Child,
  { balance = true }: { balance?: boolean } = {},
): { element: HTMLElement; destroy: () => void } {
  const bankroll = balance
    ? new BankrollDisplay({ bankroll: services.bankroll, topUpBelow: TOP_UP_BELOW })
    : null;
  const turbo = createTurboToggle(services.settings);
  const sound = createSoundToggle(services.settings);
  const element = h(
    'header',
    { class: 'topbar' },
    h('div', { class: 'topbar__leading' }, leading),
    h('div', { class: 'topbar__actions' }, bankroll?.element ?? null, turbo.element, sound.element),
  );
  return {
    element,
    destroy: () => {
      bankroll?.destroy();
      turbo.destroy();
      sound.destroy();
    },
  };
}

/** The brand mark: a brass chip and the product name. */
export function brand(href: string): HTMLAnchorElement {
  return h(
    'a',
    { class: 'brand', href, 'aria-label': 'Roll & Deal, lobby' },
    h('span', { class: 'brand__chip', 'aria-hidden': 'true' }),
    h('span', { class: 'brand__name' }, 'Roll ', h('em', null, '& Deal')),
  );
}
