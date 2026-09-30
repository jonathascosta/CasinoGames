import { Modal, clearRtpStats, formatCents, h, icon } from '@casinogames/ui';
import { GAMES } from '../catalog.ts';
import type { Services } from '../services.ts';

export interface HouseControlsOptions {
  /** The RTP stats page. */
  readonly statsHref: string;
  /** Runs after the RTP stats of every table were cleared (the stats page redraws). */
  readonly onStatsReset?: () => void;
}

export interface HouseControls {
  /** Goes beside the balance. */
  readonly bankrollReset: HTMLButtonElement;
  /** The RTP stats link and its reset, as one group. */
  readonly stats: HTMLElement;
  /** Says what a reset did, for everyone. */
  readonly status: HTMLElement;
  destroy(): void;
}

/** How long a reset's confirmation stays on screen. */
const STATUS_MS = 4000;

/**
 * The house controls of the lobby and the stats page: reset the bankroll,
 * see the RTP stats of every table, and reset them. A reset asks first, in a
 * dialog that says what it clears, with Cancel focused.
 */
export function createHouseControls(
  services: Services,
  { statsHref, onStatsReset }: HouseControlsOptions,
): HouseControls {
  const { bankroll, storage } = services;
  const status = h('p', { class: 'house-status', role: 'status' });
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  const say = (message: string) => {
    clearTimeout(statusTimer);
    status.textContent = message;
    status.dataset.visible = 'true';
    statusTimer = setTimeout(() => {
      status.dataset.visible = 'false';
    }, STATUS_MS);
  };

  const starting = formatCents(bankroll.initial);
  const bankrollDialog = confirmDialog({
    title: 'Reset the bankroll',
    text: `Your balance goes back to ${starting} in virtual chips. Your RTP stats stay.`,
    action: `Reset to ${starting}`,
    onConfirm: () => {
      bankroll.reset();
      say(`Bankroll reset to ${starting}.`);
    },
  });
  const statsDialog = confirmDialog({
    title: 'Reset the RTP stats',
    text:
      'The rounds recorded at all four tables are cleared, and every RTP monitor starts ' +
      'again from zero. Your balance stays.',
    action: 'Reset RTP stats',
    onConfirm: () => {
      for (const game of GAMES) clearRtpStats(storage, game.slug);
      say('RTP stats reset at all four tables.');
      onStatsReset?.();
    },
  });

  const bankrollReset = resetButton('Reset bankroll', `Reset the bankroll to ${starting}`);
  const statsReset = resetButton('Reset RTP stats', 'Reset the RTP stats of every table');
  bankrollReset.addEventListener('click', () => {
    bankrollDialog.open();
  });
  statsReset.addEventListener('click', () => {
    statsDialog.open();
  });
  const stats = h(
    'div',
    { class: 'house-group' },
    h(
      'a',
      { class: 'house-link', href: statsHref },
      icon('chart'),
      h('span', { class: 'house-link__text' }, 'RTP stats'),
    ),
    statsReset,
  );

  return {
    bankrollReset,
    stats,
    status,
    destroy: () => {
      clearTimeout(statusTimer);
      bankrollDialog.destroy();
      statsDialog.destroy();
    },
  };
}

function resetButton(label: string, title: string): HTMLButtonElement {
  return h(
    'button',
    {
      type: 'button',
      class: 'cg-btn cg-btn--icon cg-btn--ghost house-reset',
      'aria-label': label,
      title,
    },
    icon('reset'),
  );
}

interface ConfirmOptions {
  readonly title: string;
  readonly text: string;
  readonly action: string;
  readonly onConfirm: () => void;
}

/** A dialog that asks before a reset; Cancel has the focus, so Enter never clears by accident. */
function confirmDialog({ title, text, action, onConfirm }: ConfirmOptions): Modal {
  const cancel = h('button', { type: 'button', class: 'cg-btn', autofocus: true }, 'Cancel');
  const confirm = h('button', { type: 'button', class: 'cg-btn cg-btn--primary' }, action);
  const modal = new Modal({
    title,
    content: h(
      'div',
      { class: 'house-confirm' },
      h('p', null, text),
      h('div', { class: 'house-confirm__actions' }, cancel, confirm),
    ),
  });
  cancel.addEventListener('click', () => {
    modal.close();
  });
  confirm.addEventListener('click', () => {
    onConfirm();
    modal.close();
  });
  return modal;
}
