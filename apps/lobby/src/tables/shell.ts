import { createInfoModal, h, icon, type Modal } from '@casinogames/ui';
import type { GameEntry } from '../catalog.ts';
import type { Router } from '../router/router.ts';

/** The Rules of Play in docs/rules, which tools/generate-docs.ts writes, loaded on demand. */
const RULES = import.meta.glob<string>('../../../../docs/rules/*.md', {
  query: '?raw',
  import: 'default',
});

export async function loadRules(slug: string): Promise<string> {
  const load = Object.entries(RULES).find(([path]) => path.endsWith(`/${slug}.md`))?.[1];
  return load === undefined ? '# Rules\nThe Rules of Play are not available yet.' : load();
}

/** Where the players' part of the Rules of Play starts and ends (see tools/docs/rules.ts). */
const PLAYER_START = '<!-- player-rules:start -->';
const PLAYER_END = '<!-- player-rules:end -->';

/**
 * The part of the Rules of Play a player needs at the table: from the
 * objective to the settlement, as the document numbers its sections. The
 * whole document, with the live-dealer notes and the rulings, opens from the
 * lobby.
 */
export function playerRules(rules: string): string {
  const start = rules.indexOf(PLAYER_START);
  const end = rules.indexOf(PLAYER_END);
  if (start === -1 || end < start) return rules;
  return (
    'From the Rules of Play, sections 2 to 8. The full document, with the live-dealer notes and ' +
    "the rulings on irregularities, opens from the lobby's Rules of Play button.\n\n" +
    rules.slice(start + PLAYER_START.length, end).trim()
  );
}

/** The leading part of a table's top bar: a back link, the name and its tagline. */
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
      h('span', { class: 'table-title__tagline' }, game.tagline),
    ),
  );
}

/**
 * Rules of Play in a dialog, without their title (the dialog names the game):
 * the players' part at a table, the whole document in the lobby.
 */
export function createRulesModal(
  game: GameEntry,
  rules: string,
  heading: 'Rules' | 'Rules of Play' = 'Rules',
): Modal {
  return createInfoModal({
    title: `${game.name} · ${heading}`,
    markdown: rules.replace(/^# .*\n+/, ''),
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
