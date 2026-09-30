import { ESPELHO_ID, espelhoMathSummary } from '@casinogames/engine';
import { tablePage } from '../table-page.ts';
import { EspelhoTable } from './table.ts';
import './espelho.css';

/** The Espelho table page: the table (with its rules and paytable) and the RTP monitor. */
export const espelhoPage = tablePage({
  gameId: ESPELHO_ID,
  math: espelhoMathSummary,
  createTable: (options) => new EspelhoTable(options),
});
