import {
  BankrollDisplay,
  createSoundToggle,
  createTurboToggle,
  h,
  type Child,
} from '@casinogames/ui';
import type { Services } from '../services.ts';
import { createHouseControls, type HouseControlsOptions } from './house.ts';

/** Minimum stake of the demo tables; below it the balance offers a top-up. */
export const TOP_UP_BELOW = 50;

export interface TopBarOptions {
  /** The balance; a table that shows it beside its chips passes false. */
  readonly balance?: boolean;
  /** The turbo and sound switches, which act at the tables. */
  readonly settings?: boolean;
  /**
   * The house controls of the lobby and the stats page: the bankroll's reset
   * beside the balance, the RTP stats and their reset.
   */
  readonly house?: HouseControlsOptions;
}

/**
 * The bar across the top of every page: `leading` on the left (the brand or
 * a back link), then the balance, the house controls or the turbo and sound
 * switches, as the page asks.
 */
export function createTopBar(
  services: Services,
  leading: Child,
  { balance = true, settings = true, house }: TopBarOptions = {},
): { element: HTMLElement; destroy: () => void } {
  const bankroll = balance
    ? new BankrollDisplay({ bankroll: services.bankroll, topUpBelow: TOP_UP_BELOW })
    : null;
  const controls = house === undefined ? null : createHouseControls(services, house);
  const turbo = settings ? createTurboToggle(services.settings) : null;
  const sound = settings ? createSoundToggle(services.settings) : null;
  const balanceGroup =
    bankroll === null
      ? null
      : controls === null
        ? bankroll.element
        : h('div', { class: 'house-group' }, bankroll.element, controls.bankrollReset);
  const element = h(
    'header',
    { class: 'topbar' },
    h('div', { class: 'topbar__leading' }, leading),
    h(
      'div',
      { class: 'topbar__actions' },
      balanceGroup,
      controls?.stats ?? null,
      turbo?.element ?? null,
      sound?.element ?? null,
    ),
    controls?.status ?? null,
  );
  return {
    element,
    destroy: () => {
      bankroll?.destroy();
      controls?.destroy();
      turbo?.destroy();
      sound?.destroy();
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
