/**
 * @casinogames/engine — the platform-agnostic core of the demo.
 *
 * Everything that decides an outcome or moves money lives here: RNG, dice,
 * shoe, round state machines, settlement and math. The package has zero
 * runtime dependencies and compiles against the bare ES2022 library (no DOM,
 * no Node typings), so the same code can run in a browser or on a server.
 */
export {
  ACE,
  JACK,
  KING,
  QUEEN,
  RANK_SETS,
  SUITS,
  cardCode,
  cardLabel,
  isRank,
  isRed,
  parseCardCode,
  rankLabel,
  rankRange,
  suitSymbol,
  type Card,
  type Rank,
  type Suit,
} from './cards/card.ts';
export {
  DEFAULT_PENETRATION,
  Shoe,
  ShoeExhaustedError,
  type CardSource,
  type ShoeOptions,
} from './cards/shoe.ts';
export {
  DIE_FACES,
  diceTotal,
  isDieFace,
  rollDice,
  rollDie,
  type DicePair,
  type DieFace,
} from './dice/dice.ts';
export { createCryptoRng, type RandomValuesSource } from './rng/crypto.ts';
export { randomInt, shuffleInPlace, type Rng } from './rng/rng.ts';
export { createSeededRng, type Seed } from './rng/seeded.ts';
