import type { Odds } from '../../game/money.ts';
import type { BetDefinition } from '../../game/types.ts';
import { defineBets } from '../../game/validation.ts';
import { Fraction } from '../../math/fraction.ts';
import { ESPELHO_CONFIG } from './config.ts';

const { decks, odds, jackpot, sideMax } = ESPELHO_CONFIG;

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
    espelho: sum((kind, index) =>
      dice(kind).mul(sum((other, below) => (below < index ? dealt(other) : Fraction.ZERO))),
    ),
    // The same kind of hand on both sides.
    empate: sum((kind) => dice(kind).mul(dealt(kind))),
    // The same sum on both sides, whatever the kinds.
    somasIguais: sum((kind) =>
      dice(kind).mul(sum((other) => (other.sum === kind.sum ? dealt(other) : Fraction.ZERO))),
    ),
    parVsPar: Fraction.of(6).mul(INDEPENDENT.pair).mul(Fraction.of(6).mul(cards.pair)),
    espelhoPerfeito: Fraction.of(6).mul(INDEPENDENT.pair).mul(cards.pair),
    seisSeis: INDEPENDENT.pair.mul(cards.pair),
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
 * checked by running it over 36 × 144 × 143). 6-6 vs 6-6's RTP excludes the
 * meter's seed: its fixed pays plus the 10% of every stake the meter pays
 * back in the long run.
 */
export const ESPELHO_MATH = {
  espelho: { p: DECLARED.espelho, shoe: SIX_DECK.espelho, odds: odds.espelho },
  empate: { p: DECLARED.empate, shoe: SIX_DECK.empate, odds: odds.empate },
  somasIguais: { p: DECLARED.somasIguais, shoe: SIX_DECK.somasIguais, odds: odds.somasIguais },
  parVsPar: { p: DECLARED.parVsPar, shoe: SIX_DECK.parVsPar, odds: odds.parVsPar },
  espelhoPerfeito: {
    p: DECLARED.espelhoPerfeito,
    shoe: SIX_DECK.espelhoPerfeito,
    odds: odds.espelhoPerfeito,
  },
  seisSeis: { p: DECLARED.seisSeis, shoe: SIX_DECK.seisSeis, odds: odds.seisSeis },
} as const;

/** 6-6 vs 6-6's fixed pays alone: 1001/1296 at 1000 to 1. */
export const SEIS_SEIS_FIXED_RTP = multiplier(odds.seisSeis).mul(DECLARED.seisSeis);
/** 6-6 vs 6-6's declared RTP: the fixed pays plus the contributions (the seed excluded). */
export const SEIS_SEIS_RTP = SEIS_SEIS_FIXED_RTP.add(CONTRIBUTION);
/** One round of 6-6 vs 6-6 with the meter at its seed. */
export const SEIS_SEIS_RTP_AT_SEED = SEIS_SEIS_FIXED_RTP.add(DECLARED.seisSeis.mul(SEED_SHARE));

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

const main = { kind: 'main', min: ESPELHO_CONFIG.mainMin, max: ESPELHO_CONFIG.mainMax } as const;
const side = { kind: 'side', min: ESPELHO_CONFIG.sideMin, max: sideMax } as const;

/**
 * The bets of Espelho. espelho.test.ts enumerates the game to prove every
 * figure; espelho.math.test.ts and six-deck.math.test.ts simulate it.
 */
export const ESPELHO_BETS = defineBets([
  fixedBet(
    {
      id: 'espelho',
      label: 'Espelho',
      ...main,
      description:
        "Wins when your dice outrank the dealer's two cards. A pair beats any non-pair and a " +
        'higher pair a lower one; between non-pairs the higher sum wins, then the higher value. ' +
        'Ties lose.',
    },
    ESPELHO_MATH.espelho,
    { id: 'higher', label: "Dice outrank the dealer's cards" },
  ),
  fixedBet(
    {
      id: 'empate',
      label: 'Empate',
      ...side,
      description:
        'Wins when the two hands rank exactly equal: the same pair, or the same two values.',
    },
    ESPELHO_MATH.empate,
    { id: 'tie', label: 'The hands rank equal' },
  ),
  fixedBet(
    {
      id: 'somas-iguais',
      label: 'Somas Iguais',
      ...side,
      description: 'Wins when the dice and the cards add up to the same total.',
    },
    ESPELHO_MATH.somasIguais,
    { id: 'same-sum', label: 'Same sum' },
  ),
  fixedBet(
    {
      id: 'par-vs-par',
      label: 'Par vs Par',
      ...side,
      description: 'Wins when both hands are pairs.',
    },
    ESPELHO_MATH.parVsPar,
    { id: 'pairs', label: 'Both hands are pairs' },
  ),
  fixedBet(
    {
      id: 'espelho-perfeito',
      label: 'Espelho Perfeito',
      ...side,
      description: 'Wins when both hands are the same pair.',
    },
    ESPELHO_MATH.espelhoPerfeito,
    { id: 'same-pair', label: 'Both hands are the same pair' },
  ),
  {
    id: 'seis-seis',
    label: '6-6 vs 6-6',
    ...side,
    description:
      'Wins when both hands are 6-6: 1000 to 1, plus a share of the progressive meter in ' +
      'proportion to the stake (the whole meter at the 25.00 maximum). 10% of every stake on ' +
      'this bet goes to the meter.',
    rtp: SEIS_SEIS_RTP.toNumber(),
    // With the meter at its seed, a hit pays 1 + 1000 + seed ÷ SIDE_MAX per unit staked.
    standardDeviation: line(multiplier(odds.seisSeis).add(SEED_SHARE), DECLARED.seisSeis)
      .standardDeviation,
    progressive: {
      jackpotId: jackpot.id,
      seed: jackpot.seed,
      contributionRate: jackpot.contributionRate,
      fullShareStake: sideMax,
      hitProbability: DECLARED.seisSeis.toNumber(),
      fixedRtp: SEIS_SEIS_FIXED_RTP.toNumber(),
    },
    finiteShoe: {
      rtp: multiplier(odds.seisSeis).mul(SIX_DECK.seisSeis).add(CONTRIBUTION).toNumber(),
      hitFrequency: SIX_DECK.seisSeis.toNumber(),
    },
    paytable: [
      {
        id: 'six-six',
        label: 'Both hands are 6-6',
        odds: odds.seisSeis,
        jackpot: { jackpotId: jackpot.id, share: 1, fullShareStake: sideMax },
        probability: DECLARED.seisSeis.toNumber(),
      },
    ],
  },
]);
