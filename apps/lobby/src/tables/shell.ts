import { createInfoModal, h, icon, type Modal } from '@casinogames/ui';
import type { GameEntry } from '../catalog.ts';
import type { Router } from '../router/router.ts';

/** Game sheets from docs/games (not the _TEMPLATE), loaded on demand as the in-game rules text. */
const SHEETS = import.meta.glob<string>(
  ['../../../../docs/games/*.md', '!../../../../docs/games/_*.md'],
  { query: '?raw', import: 'default' },
);

export async function loadSheet(slug: string): Promise<string> {
  const load = Object.entries(SHEETS).find(([path]) => path.endsWith(`/${slug}.md`))?.[1];
  return load === undefined ? '# Rules\nThe game sheet is not available yet.' : load();
}

/** The leading part of a table's top bar: a back link, the name and its gloss. */
export function tableTitle(game: GameEntry, router: Router): HTMLElement {
  return h(
    'div',
    { class: 'table-title' },
    h(
      'a',
      {
        class: 'cg-btn cg-btn--icon cg-btn--ghost',
        href: router.href('/'),
        'aria-label': 'Back to the lobby',
      },
      icon('back'),
    ),
    h(
      'div',
      null,
      h('h1', null, game.name),
      h('span', { class: 'table-title__gloss' }, game.gloss),
    ),
  );
}

/** The Rules dialog: the game sheet, without its title (the dialog names the game). */
export function createRulesModal(game: GameEntry, sheet: string): Modal {
  return createInfoModal({
    title: `${game.name} · Rules`,
    markdown: sheet.replace(/^# .*\n+/, ''),
  });
}

/** A button that opens `modal`. */
export function modalButton(
  label: string,
  iconName: 'info' | 'paytable',
  modal: Modal,
  extra: Record<string, string> = {},
): HTMLButtonElement {
  const button = h('button', { type: 'button', class: 'cg-btn', ...extra }, icon(iconName), label);
  button.addEventListener('click', () => {
    modal.open();
  });
  return button;
}
