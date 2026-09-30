import { LOCK_AND_ROLL_ID, lockAndRollMathSummary } from '@casinogames/engine';
import { tablePage } from '../table-page.ts';
import { LockAndRollTable } from './table.ts';
import './lock-and-roll.css';

/** The Lock & Roll table page: the table (with its rules and paytable) and the RTP monitor. */
export const lockAndRollPage = tablePage({
  gameId: LOCK_AND_ROLL_ID,
  math: lockAndRollMathSummary,
  createTable: (options) => new LockAndRollTable(options),
});
