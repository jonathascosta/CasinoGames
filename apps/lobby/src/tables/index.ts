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
  'dice-spread': async () => (await import('./dice-spread/page.ts')).diceSpreadPage,
  'moving-target': async () => (await import('./moving-target/page.ts')).movingTargetPage,
  mirror: async () => (await import('./mirror/page.ts')).mirrorPage,
  'lock-and-roll': async () => (await import('./lock-and-roll/page.ts')).lockAndRollPage,
};

export function isPlayable(game: GameEntry): boolean {
  return TABLES[game.slug] !== undefined;
}
