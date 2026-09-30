import { TRANCAR_ID, trancarMathSummary } from '@casinogames/engine';
import { tablePage } from '../table-page.ts';
import { TrancarTable } from './table.ts';
import './trancar.css';

/** The Trancar table page: the table (with its rules and paytable) and the RTP monitor. */
export const trancarPage = tablePage({
  gameId: TRANCAR_ID,
  math: trancarMathSummary,
  createTable: (options) => new TrancarTable(options),
});
