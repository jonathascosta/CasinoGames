import { DICE_SPREAD_ID, diceSpreadMathSummary } from '@casinogames/engine';
import { tablePage } from '../table-page.ts';
import { DiceSpreadTable } from './table.ts';
import './dice-spread.css';

/** The Dice Spread table page: the table (with its rules and paytable) and the RTP monitor. */
export const diceSpreadPage = tablePage({
  gameId: DICE_SPREAD_ID,
  math: diceSpreadMathSummary,
  createTable: (options) => new DiceSpreadTable(options),
});
