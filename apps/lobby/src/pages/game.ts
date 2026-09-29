import { createInfoModal, h, icon } from '@casinogames/ui';
import { gameArt } from '../art/art.ts';
import type { GameEntry } from '../catalog.ts';
import type { Page, Router } from '../router/router.ts';
import type { Services } from '../services.ts';
import { createTopBar } from '../shell/topbar.ts';
import { siteFooter } from './lobby.ts';
import './game.css';

/** Game sheets from docs/games (not the _TEMPLATE), loaded on demand as the in-game rules text. */
const SHEETS = import.meta.glob<string>(
  ['../../../../docs/games/*.md', '!../../../../docs/games/_*.md'],
  { query: '?raw', import: 'default' },
);

async function loadSheet(slug: string): Promise<string> {
  const load = Object.entries(SHEETS).find(([path]) => path.endsWith(`/${slug}.md`))?.[1];
  return load === undefined ? '# Rules\nThe game sheet is not available yet.' : load();
}

/**
 * A table page. Until a game's rules land it shows the table frame (header,
 * rules, balance, settings) around an "in development" stage.
 */
export async function gamePage(game: GameEntry, services: Services, router: Router): Promise<Page> {
  const sheet = await loadSheet(game.slug);
  return {
    title: game.name,
    mount(outlet) {
      const back = h(
        'a',
        {
          class: 'cg-btn cg-btn--icon cg-btn--ghost',
          href: router.href('/'),
          'aria-label': 'Back to the lobby',
        },
        icon('back'),
      );
      const title = h(
        'div',
        { class: 'table-title' },
        back,
        h(
          'div',
          null,
          h('h1', null, game.name),
          h('span', { class: 'table-title__gloss' }, game.gloss),
        ),
      );
      const topbar = createTopBar(services, title);
      // The dialog title already names the game: drop the sheet's own title.
      const rules = createInfoModal({
        title: `${game.name} · Rules`,
        markdown: sheet.replace(/^# .*\n+/, ''),
      });
      const rulesButton = h('button', { type: 'button', class: 'cg-btn' }, icon('info'), 'Rules');
      rulesButton.addEventListener('click', () => {
        rules.open();
      });
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
