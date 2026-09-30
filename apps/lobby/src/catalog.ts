/**
 * The four tables of the demo. Plain data with no imports, so the Vite
 * config can read the slugs to pre-render one HTML entry per route.
 */
export interface GameEntry {
  /** URL slug and game id. */
  readonly slug: string;
  readonly name: string;
  /** The game in one line, under its name. */
  readonly tagline: string;
  /** Accent colour for the table art. */
  readonly accent: string;
}

export const GAMES: readonly GameEntry[] = [
  {
    slug: 'dice-spread',
    name: 'Dice Spread',
    tagline: 'Will the card land between your dice?',
    accent: '#c3303b',
  },
  {
    slug: 'moving-target',
    name: 'Moving Target',
    tagline: 'Your dice set the target. Will the cards land on it?',
    accent: '#2f7fbf',
  },
  {
    slug: 'mirror',
    name: 'Mirror',
    tagline: "Your dice against the dealer's cards, hand for hand.",
    accent: '#8b5cc4',
  },
  {
    slug: 'lock-and-roll',
    name: 'Lock & Roll',
    tagline: 'Lock a die, roll the other, beat the cards.',
    accent: '#d08a2a',
  },
];
