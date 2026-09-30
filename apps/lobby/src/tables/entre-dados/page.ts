import { ENTRE_DADOS_ID, entreDadosMathSummary } from '@casinogames/engine';
import { RtpPanel, RtpTracker, createPaytableModal, h, icon, type Modal } from '@casinogames/ui';
import type { GameEntry } from '../../catalog.ts';
import { siteFooter } from '../../pages/lobby.ts';
import type { Page, Router } from '../../router/router.ts';
import type { Services } from '../../services.ts';
import { createTopBar } from '../../shell/topbar.ts';
import { createRulesModal, loadSheet, tableTitle } from '../shell.ts';
import { EntreDadosTable } from './table.ts';
import '../../pages/game.css';
import '../table.css';
import './entre-dados.css';

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

/** The Entre Dados table page: the table (with its rules and paytable) and the RTP monitor. */
export async function entreDadosPage(
  game: GameEntry,
  services: Services,
  router: Router,
): Promise<Page> {
  const sheet = await loadSheet(game.slug);
  return {
    title: game.name,
    mount(outlet) {
      const math = entreDadosMathSummary();
      // The balance sits beside the chips, with the bet.
      const topbar = createTopBar(services, tableTitle(game, router), { balance: false });
      const rules = createRulesModal(game, sheet);
      const paytable = createPaytableModal(math);
      const tracker = new RtpTracker({ gameId: ENTRE_DADOS_ID, storage: services.storage });
      const rtp = new RtpPanel({ tracker, math, collapsed: true });
      const table = new EntreDadosTable({
        services,
        tracker,
        tools: [iconButton('Rules', 'info', rules), iconButton('Paytable', 'paytable', paytable)],
      });

      outlet.append(
        h(
          'div',
          { class: 'table-page ed-page', style: `--accent: ${game.accent}` },
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
}
