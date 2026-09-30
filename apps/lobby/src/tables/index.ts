import type { GameEntry } from '../catalog.ts';
import type { Page, Router } from '../router/router.ts';
import type { Services } from '../services.ts';

export type TablePage = (game: GameEntry, services: Services, router: Router) => Promise<Page>;

/**
 * Tables whose rules are implemented, each loaded on demand (with PixiJS)
 * only when a player sits down. Games without an entry show their
 * placeholder page.
 */
export const TABLES: Readonly<Partial<Record<string, () => Promise<TablePage>>>> = {
  'entre-dados': async () => (await import('./entre-dados/page.ts')).entreDadosPage,
};

export function isPlayable(game: GameEntry): boolean {
  return TABLES[game.slug] !== undefined;
}
