import type { Modal } from '@casinogames/ui';
import type { GameEntry } from '../catalog.ts';
import { createRulesModal, loadRules } from '../tables/shell.ts';

/**
 * A table's Rules of Play for the lobby, whole: the rules, the live-dealer
 * notes and the rulings, then where to find the Math Report and every game's
 * documents in one PDF.
 *
 * The lobby imports this module only on demand, and nothing else imports it:
 * loaded on its own, it keeps the documents, the Markdown renderer (and the
 * bundler's module-namespace helper, which lives with PixiJS) out of the
 * lobby's first load.
 */
export async function createSheetDialog(game: GameEntry, pack: string): Promise<Modal> {
  const rules = await loadRules(game.slug);
  const markdown =
    `${rules.trimEnd()}\n\n---\n\n` +
    `The Math Report, and both documents for every game, are in the submission pack: ` +
    `[download the submission pack (PDF)](${pack}).\n`;
  return createRulesModal(game, markdown, 'Rules of Play');
}
