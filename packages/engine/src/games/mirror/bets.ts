import type { Odds } from '../../game/money.ts';
import type { BetDefinition } from '../../game/types.ts';
import { defineBets } from '../../game/validation.ts';
import { Fraction } from '../../math/fraction.ts';
import { MIRROR_CONFIG } from './config.ts';

const { decks, odds, jackpot, sideMax } = MIRROR_CONFIG;

/**
 * The 21 kinds of hand two values from 1 to 6 can make, weakest first: the
 * 15 non-pairs by sum and then by their higher value, then the six pairs.
 */
interface HandKind {
  readonly pair: boolean;
  readonly high: number;
  readonly sum: number;
}

const KINDS: readonly HandKind[] = [
  ...[1, 2, 3, 4, 5, 6]
    .flatMap((high) => [1, 2, 3, 4, 5].filter((low) => low < high).map((low) => ({ high, low })))
    .map(({ high, low }) => ({ pair: false, high, sum: high + low }))
    .sort((a, b) => a.sum - b.sum || a.high - b.high),
  ...[1, 2, 3, 4, 5, 6].map((value) => ({ pair: true, high: value, sum: 2 * value })),
];

/** The chance of one pair (say 4-4) and of one non-pair (say 3 and 6, in either order). */
interface Draw {
  readonly pair: Fraction;
  readonly nonPair: Fraction;
}

const chanceOf = (draw: Draw, kind: HandKind) => (kind.pair ? draw.pair : draw.nonPair);

/** Two dice, or two cards from an infinite shoe: every ordered pair of values is 1 in 36. */
const INDEPENDENT: Draw = { pair: Fraction.of(1, 36), nonPair: Fraction.of(2, 36) };

/**
 * Two cards dealt from a full shoe of `decks` decks of aces to sixes: n of
 * each value among N cards, the second card drawn from the N − 1 left. In
 * a game that deals the same two cards every round, that is every round's
 * chance, however deep the shoe has been dealt.
 */
function fromShoe(deckCount: number): Draw {
  const n = BigInt(4 * deckCount);
  const cards = 6n * n;
  const pairs = cards * (cards - 1n);
  return { pair: Fraction.of(n * (n - 1n), pairs), nonPair: Fraction.of(2n * n * n, pairs) };
}

/**
 * Each bet's chance of winning, for the dice against cards drawn by `cards`.
 * Summed over the kinds of hand, so an exact fraction for any source.
 */
function winChances(cards: Draw) {
  const sum = (term: (kind: HandKind, index: number) => Fraction) =>
    KINDS.reduce((total, kind, index) => total.add(term(kind, index)), Fraction.ZERO);
  const dice = (kind: HandKind) => chanceOf(INDEPENDENT, kind);
  const dealt = (kind: HandKind) => chanceOf(cards, kind);
  return {
    // The dice's kind is stronger than the cards': the cards' kinds below it.
    mirror: sum((kind, index) =>
      dice(kind).mul(sum((other, below) => (below < index ? dealt(other) : Fraction.ZERO))),
    ),
    // The same kind of hand on both sides.
    tie: sum((kind) => dice(kind).mul(dealt(kind))),
    // The same sum on both sides, whatever the kinds.
    equalSums: sum((kind) =>
      dice(kind).mul(sum((other) => (other.sum === kind.sum ? dealt(other) : Fraction.ZERO))),
    ),
    pairVsPair: Fraction.of(6).mul(INDEPENDENT.pair).mul(Fraction.of(6).mul(cards.pair)),
    perfectMirror: Fraction.of(6).mul(INDEPENDENT.pair).mul(cards.pair),
    doubleSixes: INDEPENDENT.pair.mul(cards.pair),
  };
}

const multiplier = ({ to, per }: Odds) => Fraction.of(to + per, per);
/** The contribution rate as an exact fraction (the pool stores it in parts per million). */
const CONTRIBUTION = Fraction.of(Math.round(jackpot.contributionRate * 1_000_000), 1_000_000);
/** What a hit pays per unit staked from a meter at its seed: seed ÷ SIDE_MAX. */
const SEED_SHARE = Fraction.of(jackpot.seed, sideMax);

const DECLARED = winChances(INDEPENDENT);
const SIX_DECK = winChances(fromShoe(decks));

/** A single winning line paying `payout` per unit with chance p: RTP m·p and σ² = m²·p(1 − p). */
function line(payout: Fraction, p: Fraction) {
  return {
    rtp: payout.mul(p),
    standardDeviation: Math.sqrt(payout.mul(payout).mul(p).mul(Fraction.ONE.sub(p)).toNumber()),
  };
}

/**
 * The declared math of each bet, as exact fractions: on an infinite shoe
 * (the declared figures, which the exact test checks by running the game
 * over 36 × 24 × 24 draws) and on the table's six-deck shoe (finiteShoe,
 * checked by running it over 36 × 144 × 143). Double Sixes' RTP excludes the
 * meter's seed: its fixed pays plus the 10% of every stake the meter pays
 * back in the long run.
 */
export const MIRROR_MATH = {
  mirror: { p: DECLARED.mirror, shoe: SIX_DECK.mirror, odds: odds.mirror },
  tie: { p: DECLARED.tie, shoe: SIX_DECK.tie, odds: odds.tie },
  equalSums: { p: DECLARED.equalSums, shoe: SIX_DECK.equalSums, odds: odds.equalSums },
  pairVsPair: { p: DECLARED.pairVsPair, shoe: SIX_DECK.pairVsPair, odds: odds.pairVsPair },
  perfectMirror: {
    p: DECLARED.perfectMirror,
    shoe: SIX_DECK.perfectMirror,
    odds: odds.perfectMirror,
  },
  doubleSixes: { p: DECLARED.doubleSixes, shoe: SIX_DECK.doubleSixes, odds: odds.doubleSixes },
} as const;

/** Double Sixes' fixed pays alone: 1001/1296 at 1000 to 1. */
export const DOUBLE_SIXES_FIXED_RTP = multiplier(odds.doubleSixes).mul(DECLARED.doubleSixes);
/** Double Sixes' declared RTP: the fixed pays plus the contributions (the seed excluded). */
export const DOUBLE_SIXES_RTP = DOUBLE_SIXES_FIXED_RTP.add(CONTRIBUTION);
/** One round of Double Sixes with the meter at its seed. */
export const DOUBLE_SIXES_RTP_AT_SEED = DOUBLE_SIXES_FIXED_RTP.add(
  DECLARED.doubleSixes.mul(SEED_SHARE),
);

function fixedBet(
  base: Omit<BetDefinition, 'rtp' | 'standardDeviation' | 'finiteShoe' | 'paytable'>,
  math: { readonly p: Fraction; readonly shoe: Fraction; readonly odds: Odds },
  entry: { readonly id: string; readonly label: string },
): BetDefinition {
  const payout = multiplier(math.odds);
  const { rtp, standardDeviation } = line(payout, math.p);
  return {
    ...base,
    rtp: rtp.toNumber(),
    standardDeviation,
    finiteShoe: { rtp: payout.mul(math.shoe).toNumber(), hitFrequency: math.shoe.toNumber() },
    paytable: [{ ...entry, odds: math.odds, probability: math.p.toNumber() }],
  };
}

const main = { kind: 'main', min: MIRROR_CONFIG.mainMin, max: MIRROR_CONFIG.mainMax } as const;
const side = { kind: 'side', min: MIRROR_CONFIG.sideMin, max: sideMax } as const;

/**
 * The bets of Mirror. mirror.test.ts enumerates the game to prove every
 * figure; mirror.math.test.ts and six-deck.math.test.ts simulate it.
 */
export const MIRROR_BETS = defineBets([
  fixedBet(
    {
      id: 'mirror',
      label: 'Mirror',
      ...main,
      description:
        "Wins when your dice outrank the dealer's two cards. A pair beats any non-pair and a " +
        'higher pair a lower one; between non-pairs the higher sum wins, then the higher value. ' +
        'Ties lose.',
    },
    MIRROR_MATH.mirror,
    { id: 'higher', label: "Dice outrank the dealer's cards" },
  ),
  fixedBet(
    {
      id: 'tie',
      label: 'Tie',
      ...side,
      description:
        'Wins when the two hands rank exactly equal: the same pair, or the same two values.',
    },
    MIRROR_MATH.tie,
    { id: 'tie', label: 'The hands rank equal' },
  ),
  fixedBet(
    {
      id: 'equal-sums',
      label: 'Equal Sums',
      ...side,
      description: 'Wins when the dice and the cards add up to the same total.',
    },
    MIRROR_MATH.equalSums,
    { id: 'same-sum', label: 'Same sum' },
  ),
  fixedBet(
    {
      id: 'pair-vs-pair',
      label: 'Pair vs Pair',
      ...side,
      description: 'Wins when both hands are pairs.',
    },
    MIRROR_MATH.pairVsPair,
    { id: 'pairs', label: 'Both hands are pairs' },
  ),
  fixedBet(
    {
      id: 'perfect-mirror',
      label: 'Perfect Mirror',
      ...side,
      description: 'Wins when both hands are the same pair.',
    },
    MIRROR_MATH.perfectMirror,
    { id: 'same-pair', label: 'Both hands are the same pair' },
  ),
  {
    id: 'double-sixes',
    label: 'Double Sixes',
    ...side,
    description:
      'Wins when both hands are 6-6: 1000 to 1, plus a share of the progressive meter in ' +
      'proportion to the stake (the whole meter at the 25.00 maximum). 10% of every stake on ' +
      'this bet goes to the meter.',
    rtp: DOUBLE_SIXES_RTP.toNumber(),
    // With the meter at its seed, a hit pays 1 + 1000 + seed ÷ SIDE_MAX per unit staked.
    standardDeviation: line(multiplier(odds.doubleSixes).add(SEED_SHARE), DECLARED.doubleSixes)
      .standardDeviation,
    progressive: {
      jackpotId: jackpot.id,
      seed: jackpot.seed,
      contributionRate: jackpot.contributionRate,
      fullShareStake: sideMax,
      hitProbability: DECLARED.doubleSixes.toNumber(),
      fixedRtp: DOUBLE_SIXES_FIXED_RTP.toNumber(),
    },
    finiteShoe: {
      rtp: multiplier(odds.doubleSixes).mul(SIX_DECK.doubleSixes).add(CONTRIBUTION).toNumber(),
      hitFrequency: SIX_DECK.doubleSixes.toNumber(),
    },
    paytable: [
      {
        id: 'six-six',
        label: 'Both hands are 6-6',
        odds: odds.doubleSixes,
        jackpot: { jackpotId: jackpot.id, share: 1, fullShareStake: sideMax },
        probability: DECLARED.doubleSixes.toNumber(),
      },
    ],
  },
]);
