/**
 * The documents' authorship and revision history: the only hand-written data
 * the generator reads. A revision is added here when a document changes in
 * substance (a rule, a figure, a section), and the newest one dates both
 * documents of its game. Its figures stay out of this file: they come from
 * the engine and the tests.
 */
export const AUTHOR = 'Jonathas Costa';

/** Where the demo runs: each table is at <SITE><game id>. */
export const SITE = 'https://jonathascosta.github.io/CasinoGames/';

export interface Revision {
  readonly revision: string;
  readonly date: string;
  readonly change: string;
}

const FIRST = 'First game sheet: rules, declared math, exact and Monte Carlo tests.';
const RENAMED = 'Renamed from its working title, with English names for the game and its bets.';
const SUBMISSION =
  'Reformatted for submission as two documents, Rules of Play and Math Report, generated ' +
  'from the code with every figure traced to the engine or to a test; card counting ' +
  'measured on every game.';

export const REVISIONS: Readonly<Record<string, readonly Revision[]>> = {
  'dice-spread': [
    { revision: '1', date: '2026-09-30', change: `${FIRST} Card counting exposure measured.` },
    { revision: '2', date: '2026-09-30', change: RENAMED },
    { revision: '3', date: '2026-09-30', change: SUBMISSION },
  ],
  'moving-target': [
    { revision: '1', date: '2026-09-30', change: `${FIRST} The six-deck shoe's shift measured.` },
    { revision: '2', date: '2026-09-30', change: RENAMED },
    { revision: '3', date: '2026-09-30', change: SUBMISSION },
  ],
  mirror: [
    {
      revision: '1',
      date: '2026-09-30',
      change: `${FIRST} The progressive meter's economics and card counting measured.`,
    },
    {
      revision: '2',
      date: '2026-09-30',
      change: `${RENAMED} The progressive bet is Double Sixes.`,
    },
    { revision: '3', date: '2026-09-30', change: SUBMISSION },
  ],
  'lock-and-roll': [
    {
      revision: '1',
      date: '2026-09-30',
      change: `${FIRST} The strategy computed by expected value; card counting measured.`,
    },
    {
      revision: '2',
      date: '2026-09-30',
      change: `${RENAMED} The choices are Stand and Lock, and the re-roll costs the Lock fee.`,
    },
    { revision: '3', date: '2026-09-30', change: SUBMISSION },
  ],
};
