import type { Game } from '../game/types.ts';
import { ALVO_MOVEL_ID, ALVO_MOVEL_NAME, alvoMovelMathSummary } from './alvo-movel/game.ts';
import { ENTRE_DADOS_ID, ENTRE_DADOS_NAME, entreDadosMathSummary } from './entre-dados/game.ts';
import { ESPELHO_ID, ESPELHO_NAME, espelhoMathSummary } from './espelho/game.ts';

/**
 * The demo's games, registered here as they are implemented. The sheet
 * generator (scripts/sync-game-sheets.ts) walks this list, so a registered
 * game always has its paytable section published from its own code.
 */
export const GAMES: readonly Pick<Game, 'id' | 'name' | 'mathSummary'>[] = [
  { id: ENTRE_DADOS_ID, name: ENTRE_DADOS_NAME, mathSummary: entreDadosMathSummary },
  { id: ALVO_MOVEL_ID, name: ALVO_MOVEL_NAME, mathSummary: alvoMovelMathSummary },
  { id: ESPELHO_ID, name: ESPELHO_NAME, mathSummary: espelhoMathSummary },
];
