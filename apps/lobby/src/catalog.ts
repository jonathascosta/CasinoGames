/**
 * The four tables of the demo. Plain data with no imports, so the Vite
 * config can read the slugs to pre-render one HTML entry per route.
 */
export interface GameEntry {
  /** URL slug and game id. */
  readonly slug: string;
  readonly name: string;
  /** English gloss of the Portuguese name. */
  readonly gloss: string;
  /** Accent colour for the table art. */
  readonly accent: string;
}

export const GAMES: readonly GameEntry[] = [
  { slug: 'entre-dados', name: 'Entre Dados', gloss: 'Between the dice', accent: '#c3303b' },
  { slug: 'alvo-movel', name: 'Alvo Móvel', gloss: 'Moving target', accent: '#2f7fbf' },
  { slug: 'espelho', name: 'Espelho', gloss: 'Mirror', accent: '#8b5cc4' },
  { slug: 'trancar', name: 'Trancar', gloss: 'Lock it in', accent: '#d08a2a' },
];
