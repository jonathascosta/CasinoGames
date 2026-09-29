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
export { EngineError, type EngineErrorCode } from './game/errors.ts';
export { summarizeMath } from './game/math-summary.ts';
export {
  isCents,
  odds,
  oddsLabel,
  oddsMultiplier,
  winnings,
  type Cents,
  type Odds,
} from './game/money.ts';
export {
  RoundBuilder,
  continueRound,
  startRound,
  type EmittableEvent,
  type GameInfo,
} from './game/round.ts';
export {
  settleLoss,
  settlePush,
  settleWin,
  settleWithPayout,
  settlementTotals,
  type Outcome,
  type Settlement,
  type SettlementLine,
  type SettlementTotals,
} from './game/settlement.ts';
export type {
  BetDefinition,
  BetId,
  BetKind,
  BetMath,
  Bets,
  CustomEvent,
  DecisionOption,
  Game,
  GameEvent,
  GameEventType,
  JackpotPayout,
  MathSummary,
  PaytableEntry,
  RoundPhase,
  RoundState,
} from './game/types.ts';
export { defineBets, validateBets } from './game/validation.ts';
export { playRound, type Strategy } from './game/play.ts';
export {
  enumerateOutcomes,
  type EnumerateOptions,
  type WeightedOutcome,
} from './math/enumerate.ts';
export { exactReturns, type ExactReport, type ExactReturn } from './math/exact.ts';
export { Fraction } from './math/fraction.ts';
export { MATH_END, MATH_START, renderMathSection, replaceMathSection } from './math/sheet.ts';
export { GAMES } from './games/index.ts';
export {
  roundsForTolerance,
  simulate,
  type BetStatistics,
  type SimulationOptions,
  type SimulationReport,
} from './math/simulate.ts';
export {
  ProgressiveJackpot,
  type ProgressiveOptions,
  type ProgressiveSnapshot,
} from './progressive/progressive.ts';
export { createCryptoRng, type RandomValuesSource } from './rng/crypto.ts';
export { randomInt, shuffleInPlace, type IntegerRng, type Rng } from './rng/rng.ts';
export { createSeededRng, type Seed } from './rng/seeded.ts';
