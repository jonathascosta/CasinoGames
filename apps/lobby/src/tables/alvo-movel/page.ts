import { ALVO_MOVEL_ID, alvoMovelMathSummary } from '@casinogames/engine';
import { tablePage } from '../table-page.ts';
import { AlvoMovelTable } from './table.ts';
import './alvo-movel.css';

/** The Alvo Móvel table page: the table (with its rules and paytable) and the RTP monitor. */
export const alvoMovelPage = tablePage({
  gameId: ALVO_MOVEL_ID,
  math: alvoMovelMathSummary,
  createTable: (options) => new AlvoMovelTable(options),
});
