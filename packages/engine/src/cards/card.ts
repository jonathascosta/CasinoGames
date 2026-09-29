export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

/** Ace = 1, Jack = 11, Queen = 12, King = 13. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export const ACE = 1 satisfies Rank;
export const JACK = 11 satisfies Rank;
export const QUEEN = 12 satisfies Rank;
export const KING = 13 satisfies Rank;

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}

export function isRank(value: unknown): value is Rank {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 13;
}

/** The ranks from `from` to `to` inclusive, e.g. rankRange(1, 6) for A–6. */
export function rankRange(from: Rank, to: Rank): readonly Rank[] {
  if (from > to) throw new RangeError(`rankRange: ${from} > ${to}`);
  return Array.from({ length: to - from + 1 }, (_, i) => (from + i) as Rank);
}

/** Rank sets used by the demo's shoes. Each rank appears in all four suits. */
export const RANK_SETS = {
  aceToSix: rankRange(1, 6),
  aceToTen: rankRange(1, 10),
  aceToKing: rankRange(1, 13),
} as const;

const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
const RANK_CODES = 'A23456789TJQK';

const SUIT_SYMBOLS: Readonly<Record<Suit, string>> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank - 1]!;
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOLS[suit];
}

export function isRed(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

/** Human-readable label, e.g. "10♥". */
export function cardLabel(card: Card): string {
  return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
}

/** Fixed-width ASCII code for logs and audit trails, e.g. "TH", "AS". */
export function cardCode(card: Card): string {
  return `${RANK_CODES[card.rank - 1]!}${card.suit[0]!.toUpperCase()}`;
}

const SUIT_BY_CODE: Readonly<Record<string, Suit>> = {
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
};

/** Inverse of {@link cardCode}: "TH" → 10♥. Throws on malformed input. */
export function parseCardCode(code: string): Card {
  const rankIndex = code.length === 2 ? RANK_CODES.indexOf(code[0]!) : -1;
  const suit = SUIT_BY_CODE[code[1] ?? ''];
  if (rankIndex < 0 || suit === undefined) throw new SyntaxError(`Invalid card code "${code}"`);
  return { rank: (rankIndex + 1) as Rank, suit };
}
