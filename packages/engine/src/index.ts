/**
 * @casinogames/engine — the platform-agnostic core of the demo.
 *
 * Everything that decides an outcome or moves money lives here: RNG, dice,
 * shoe, round state machines, settlement and math. The package has zero
 * runtime dependencies and compiles against the bare ES2022 library (no DOM,
 * no Node typings), so the same code can run in a browser or on a server.
 */
export { createCryptoRng, type RandomValuesSource } from './rng/crypto.ts';
export { randomInt, shuffleInPlace, type Rng } from './rng/rng.ts';
export { createSeededRng, type Seed } from './rng/seeded.ts';
