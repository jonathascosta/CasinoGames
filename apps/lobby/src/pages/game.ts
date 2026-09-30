import { h, icon } from '@casinogames/ui';
import { gameArt } from '../art/art.ts';
import type { GameEntry } from '../catalog.ts';
import type { Page, Router } from '../router/router.ts';
import type { Services } from '../services.ts';
import { createTopBar } from '../shell/topbar.ts';
import {
  createRulesModal,
  loadRules,
  modalButton,
  playerRules,
  tableTitle,
} from '../tables/shell.ts';
import { siteFooter } from './lobby.ts';
import './game.css';

/**
 * A table page. Until a game's rules land it shows the table frame (header,
 * rules, balance, settings) around an "in development" stage.
 */
export async function gamePage(game: GameEntry, services: Services, router: Router): Promise<Page> {
  const text = playerRules(await loadRules(game.slug));
  return {
    title: game.name,
    mount(outlet) {
      const topbar = createTopBar(services, tableTitle(game, router));
      const rules = createRulesModal(game, text);
      const rulesButton = modalButton('Rules', 'info', rules);
      const paytableButton = h(
        'button',
        {
          type: 'button',
          class: 'cg-btn',
          disabled: true,
          title: "Generated from the game's mathSummary() once its rules are implemented",
        },
        icon('paytable'),
        'Paytable',
      );

      outlet.append(
        h(
          'div',
          { class: 'table-page', style: `--accent: ${game.accent}` },
          topbar.element,
          h(
            'section',
            { class: 'table-stage', 'aria-labelledby': 'stage-title' },
            h('div', { class: 'table-stage__art' }, gameArt(game)),
            h(
              'div',
              { class: 'table-stage__panel cg-panel' },
              h('span', { class: 'table-stage__status' }, 'In development'),
              h('h2', { id: 'stage-title' }, 'This table is being built'),
              h(
                'p',
                null,
                `Rules, math sheet and live play for ${game.name} arrive in the next build. ` +
                  'Everything it will run on is already live:',
              ),
              h(
                'ul',
                { class: 'table-stage__kit' },
                h('li', null, 'Player dice — tap or hold to roll, in 3D'),
                h('li', null, 'Dealer cards from a six-deck shoe with a cut card'),
                h('li', null, 'Chip rail, bet spots, autoplay and turbo mode'),
                h('li', null, 'Live RTP monitor against the declared figures'),
              ),
              h(
                'div',
                { class: 'table-stage__actions' },
                rulesButton,
                paytableButton,
                h(
                  'a',
                  { class: 'cg-btn cg-btn--primary', href: `${import.meta.env.BASE_URL}dev.html` },
                  'Try the table kit',
                ),
              ),
            ),
          ),
          siteFooter(),
        ),
      );
      return () => {
        rules.destroy();
        topbar.destroy();
      };
    },
  };
}
