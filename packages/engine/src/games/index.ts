import type { Game } from '../game/types.ts';
import {
  MOVING_TARGET_ID,
  MOVING_TARGET_NAME,
  movingTargetMathSummary,
} from './moving-target/game.ts';
import { DICE_SPREAD_ID, DICE_SPREAD_NAME, diceSpreadMathSummary } from './dice-spread/game.ts';
import { MIRROR_ID, MIRROR_NAME, mirrorMathSummary } from './mirror/game.ts';
import {
  LOCK_AND_ROLL_ID,
  LOCK_AND_ROLL_NAME,
  lockAndRollMathSummary,
} from './lock-and-roll/game.ts';

/**
 * The demo's games, registered here as they are implemented. The document
 * generator (tools/generate-docs.ts) walks this list, so a registered game
 * always has its Rules of Play and Math Report written from its own code.
 */
export const GAMES: readonly Pick<Game, 'id' | 'name' | 'mathSummary'>[] = [
  { id: DICE_SPREAD_ID, name: DICE_SPREAD_NAME, mathSummary: diceSpreadMathSummary },
  { id: MOVING_TARGET_ID, name: MOVING_TARGET_NAME, mathSummary: movingTargetMathSummary },
  { id: MIRROR_ID, name: MIRROR_NAME, mathSummary: mirrorMathSummary },
  { id: LOCK_AND_ROLL_ID, name: LOCK_AND_ROLL_NAME, mathSummary: lockAndRollMathSummary },
];
