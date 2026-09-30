import type { Game } from '../game/types.ts';
import { ENTRE_DADOS_ID, ENTRE_DADOS_NAME, entreDadosMathSummary } from './entre-dados/game.ts';

/**
 * The demo's games, registered here as they are implemented. The sheet
 * generator (scripts/sync-game-sheets.ts) walks this list, so a registered
 * game always has its paytable section published from its own code.
 */
export const GAMES: readonly Pick<Game, 'id' | 'name' | 'mathSummary'>[] = [
  { id: ENTRE_DADOS_ID, name: ENTRE_DADOS_NAME, mathSummary: entreDadosMathSummary },
];
