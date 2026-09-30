import type { Modal } from '@casinogames/ui';
import type { GameEntry } from '../catalog.ts';
import { createRulesModal, loadSheet } from '../tables/shell.ts';

/**
 * A table's Game sheet dialog, for the lobby: the sheet as the table's Rules
 * dialog shows it, then where to find all four sheets in one PDF.
 *
 * The lobby imports this module only on demand, and nothing else imports it:
 * loaded on its own, it keeps the sheets, the Markdown renderer (and the
 * bundler's module-namespace helper, which lives with PixiJS) out of the
 * lobby's first load.
 */
export async function createSheetDialog(game: GameEntry, pdf: string): Promise<Modal> {
  const sheet = await loadSheet(game.slug);
  const markdown =
    `${sheet.trimEnd()}\n\n---\n\n` +
    `All four game sheets are also in one PDF: [download the game sheets](${pdf}).\n`;
  return createRulesModal(game, markdown, 'Game sheet');
}
