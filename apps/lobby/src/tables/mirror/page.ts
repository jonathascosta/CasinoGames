import { MIRROR_ID, mirrorMathSummary } from '@casinogames/engine';
import { tablePage } from '../table-page.ts';
import { MirrorTable } from './table.ts';
import './mirror.css';

/** The Mirror table page: the table (with its rules and paytable) and the RTP monitor. */
export const mirrorPage = tablePage({
  gameId: MIRROR_ID,
  math: mirrorMathSummary,
  createTable: (options) => new MirrorTable(options),
});
