/**
 * The four tables of the demo. Plain data with no imports, so the Vite
 * config can read the slugs to pre-render one HTML entry per route, and the
 * lobby shows each table's figures without loading its math.
 */
export interface GameEntry {
  /** URL slug and game id. */
  readonly slug: string;
  readonly name: string;
  /** The game in one line, under its name. */
  readonly tagline: string;
  /** Accent colour for the table art. */
  readonly accent: string;
  /** The main bet, whose declared RTP the lobby shows. */
  readonly mainBet: string;
  /**
   * The main bet's declared RTP, as its mathSummary() declares it (a test
   * holds the two together). Lock & Roll's assumes the reference strategy.
   */
  readonly rtp: number;
}

export const GAMES: readonly GameEntry[] = [
  {
    slug: 'dice-spread',
    name: 'Dice Spread',
    tagline: 'Will the card land between your dice?',
    accent: '#c3303b',
    mainBet: 'Between',
    rtp: 26 / 27,
  },
  {
    slug: 'moving-target',
    name: 'Moving Target',
    tagline: 'Your dice set the target. Will the cards land on it?',
    accent: '#2f7fbf',
    mainBet: 'Exact Hit',
    rtp: 17_307_296_056_493 / 18_000_000_000_000,
  },
  {
    slug: 'mirror',
    name: 'Mirror',
    tagline: "Your dice against the dealer's cards, hand for hand.",
    accent: '#8b5cc4',
    mainBet: 'Mirror',
    rtp: 205 / 216,
  },
  {
    slug: 'lock-and-roll',
    name: 'Lock & Roll',
    tagline: 'Lock a die, roll the other, beat the cards.',
    accent: '#d08a2a',
    mainBet: 'Lock & Roll',
    rtp: 18_649 / 19_440,
  },
];
