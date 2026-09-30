import { ENTRE_DADOS_ID, entreDadosMathSummary } from '@casinogames/engine';
import { tablePage } from '../table-page.ts';
import { EntreDadosTable } from './table.ts';
import './entre-dados.css';

/** The Entre Dados table page: the table (with its rules and paytable) and the RTP monitor. */
export const entreDadosPage = tablePage({
  gameId: ENTRE_DADOS_ID,
  math: entreDadosMathSummary,
  createTable: (options) => new EntreDadosTable(options),
});
