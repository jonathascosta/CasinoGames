import type { MathSummary } from '@casinogames/engine';
import { RtpPanel, RtpTracker, createPaytableModal, h, icon, type Modal } from '@casinogames/ui';
import { siteFooter } from '../pages/lobby.ts';
import { createTopBar } from '../shell/topbar.ts';
import type { TableOptions } from './dice-table.ts';
import type { TablePage } from './index.ts';
import { createRulesModal, loadSheet, tableTitle } from './shell.ts';
import '../pages/game.css';
import './table.css';

export interface TablePageConfig {
  /** The game's id, which keys its RTP statistics in storage. */
  readonly gameId: string;
  readonly math: () => MathSummary;
  readonly createTable: (options: TableOptions) => {
    readonly element: HTMLElement;
    destroy(): void;
  };
}

function iconButton(label: string, name: 'info' | 'paytable', modal: Modal): HTMLButtonElement {
  const button = h(
    'button',
    {
      type: 'button',
      class: 'cg-btn cg-btn--icon cg-btn--ghost',
      'aria-label': label,
      title: label,
    },
    icon(name),
  );
  button.addEventListener('click', () => {
    modal.open();
  });
  return button;
}

/**
 * A table's page: the top bar, the table with its Rules (the game sheet) and
 * Paytable (the math summary) buttons beside the balance, and the RTP monitor.
 */
export function tablePage(config: TablePageConfig): TablePage {
  return async (game, services, router) => {
    const sheet = await loadSheet(game.slug);
    return {
      title: game.name,
      mount(outlet) {
        const math = config.math();
        // The balance sits beside the chips, with the bet.
        const topbar = createTopBar(services, tableTitle(game, router), { balance: false });
        const rules = createRulesModal(game, sheet);
        const paytable = createPaytableModal(math);
        const tracker = new RtpTracker({ gameId: config.gameId, storage: services.storage });
        const rtp = new RtpPanel({ tracker, math, collapsed: true });
        const table = config.createTable({
          services,
          tracker,
          tools: [iconButton('Rules', 'info', rules), iconButton('Paytable', 'paytable', paytable)],
        });

        outlet.append(
          h(
            'div',
            { class: 'table-page', style: `--accent: ${game.accent}` },
            topbar.element,
            h('main', { class: 'tb-main' }, table.element, rtp.element),
            siteFooter(),
          ),
        );
        return () => {
          table.destroy();
          rtp.destroy();
          tracker.flush();
          rules.destroy();
          paytable.destroy();
          topbar.destroy();
        };
      },
    };
  };
}
