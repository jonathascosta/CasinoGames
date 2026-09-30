import { MOVING_TARGET_ID, movingTargetMathSummary } from '@casinogames/engine';
import { tablePage } from '../table-page.ts';
import { MovingTargetTable } from './table.ts';
import './moving-target.css';

/** The Moving Target table page: the table (with its rules and paytable) and the RTP monitor. */
export const movingTargetPage = tablePage({
  gameId: MOVING_TARGET_ID,
  math: movingTargetMathSummary,
  createTable: (options) => new MovingTargetTable(options),
});
