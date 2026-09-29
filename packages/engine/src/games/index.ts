import type { Game } from '../game/types.ts';

/**
 * The demo's games, registered here as they are implemented. The sheet
 * generator (scripts/sync-game-sheets.ts) walks this list, so a registered
 * game always has its paytable section published from its own code.
 */
export const GAMES: readonly Pick<Game, 'id' | 'name' | 'mathSummary'>[] = [];
