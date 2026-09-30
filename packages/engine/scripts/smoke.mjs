// Proves the built engine runs as plain ES modules on Node: no bundler, no
// TypeScript, no DOM. CI runs it after `pnpm --filter @casinogames/engine build`.
import assert from 'node:assert/strict';
import {
  ProgressiveJackpot,
  RANK_SETS,
  Shoe,
  createMovingTarget,
  createCryptoRng,
  createDiceSpread,
  createMirror,
  createMirrorJackpot,
  createSeededRng,
  createLockAndRoll,
  defineBets,
  exactReturns,
  odds,
  playRound,
  simulate,
  startRound,
  summarizeMath,
  lockAndRollStrategy,
} from '../dist/index.js';
import { createUniformRankSource } from '../dist/testing/index.js';

const SEVEN = odds(4);
const bets = defineBets([
  {
    id: 'seven',
    label: 'Seven',
    kind: 'main',
    min: 100,
    max: 10_000,
    rtp: 5 / 6,
    paytable: [{ id: 'seven', label: 'Total of 7', odds: SEVEN, probability: 1 / 6 }],
  },
]);

function createGame() {
  const game = {
    id: 'smoke',
    name: 'Smoke Test',
    bets,
    start(placed, rng) {
      const round = startRound(game, placed, rng);
      const [first, second] = round.rollDice();
      if (first + second === 7) round.win('seven', SEVEN, 'seven');
      else round.lose('seven');
      return round.finish(undefined);
    },
    decide() {
      throw new Error('No decisions in this game');
    },
    mathSummary: () => summarizeMath(game),
  };
  return game;
}

const exact = exactReturns(createGame, { seven: 100 });
assert.equal(exact.bets.seven.rtp.toString(), '5/6');

const report = simulate(createGame(), {
  rounds: 200_000,
  rng: createSeededRng('smoke'),
  bets: { seven: 100 },
});
assert.ok(Math.abs(report.bets.seven.rtp - 5 / 6) < 0.01, `RTP ${report.bets.seven.rtp}`);

const shoe = new Shoe({ decks: 6 });
const rng = createCryptoRng();
shoe.beginRound(rng);
shoe.draw(rng);
assert.equal(shoe.remaining(), 311);

const jackpot = new ProgressiveJackpot({ id: 'grand', seed: 100_000, contributionRate: 0.01 });
jackpot.contribute(10_000);
assert.equal(jackpot.amount, 100_100);

// A real game: Dice Spread, exactly and on its six-deck shoe.
const between = exactReturns(
  () => createDiceSpread({ source: createUniformRankSource(RANK_SETS.aceToSix) }),
  { between: 100, triple: 100 },
);
assert.equal(between.outcomes, 216);
assert.equal(between.bets.between.rtp.toString(), '26/27');
assert.equal(between.bets.triple.rtp.toString(), '31/36');
const table = createDiceSpread();
for (let round = 0; round < 1_000; round++) {
  const state = table.start({ between: 100, match: 50 }, rng);
  assert.equal(state.phase, 'settled');
}

// A game with a variable number of cards: Moving Target, exactly and on its six-deck shoe.
const movingTarget = exactReturns(
  () => createMovingTarget({ source: createUniformRankSource(RANK_SETS.aceToTen) }),
  { 'exact-hit': 100, 'three-plus-cards': 100 },
);
assert.equal(movingTarget.outcomes, 71_469);
assert.equal(movingTarget.bets['exact-hit'].rtp.toString(), '17307296056493/18000000000000');
assert.equal(movingTarget.bets['three-plus-cards'].rtp.toString(), '43/48');
const movingTargetTable = createMovingTarget();
for (let round = 0; round < 1_000; round++) {
  const state = movingTargetTable.start({ 'exact-hit': 100, 'first-card': 50 }, rng);
  assert.equal(state.phase, 'settled');
}

// A game with a progressive meter: Mirror, exactly and on its six-deck shoe, with its meter.
const mirror = exactReturns(
  () =>
    createMirror({
      source: createUniformRankSource(RANK_SETS.aceToSix),
      jackpot: new ProgressiveJackpot({ id: 'mirror', seed: 0, contributionRate: 0 }),
    }),
  { mirror: 100, 'double-sixes': 100 },
);
assert.equal(mirror.outcomes, 1_296);
assert.equal(mirror.bets.mirror.rtp.toString(), '205/216');
assert.equal(mirror.bets['double-sixes'].rtp.toString(), '1001/1296');
const mirrorTable = createMirror();
for (let round = 0; round < 1_000; round++) {
  const state = mirrorTable.start({ mirror: 100, 'double-sixes': 50 }, rng);
  assert.equal(state.phase, 'settled');
}
// The meter carries on from its stored state.
const stored = JSON.parse(JSON.stringify(mirrorTable.jackpot.state()));
assert.deepEqual(createMirrorJackpot(stored).state(), mirrorTable.jackpot.state());

// A game with a decision and a fee: Lock & Roll, exactly with its strategy, and on its six-deck shoe.
const lockAndRoll = exactReturns(
  () => createLockAndRoll({ source: createUniformRankSource(RANK_SETS.aceToSix) }),
  { 'lock-and-roll': 100 },
  lockAndRollStrategy(),
);
assert.equal(lockAndRoll.outcomes, (19 + 17 * 6) * 36);
assert.equal(lockAndRoll.bets['lock-and-roll'].rtp.toString(), '18649/19440');
assert.equal(lockAndRoll.bets['lock-and-roll'].expectedFee.toString(), '160/9');
const lockAndRollTable = createLockAndRoll();
const bot = lockAndRollStrategy();
let fees = 0;
for (let round = 0; round < 1_000; round++) {
  const pending = lockAndRollTable.start({ 'lock-and-roll': 100 }, rng);
  assert.equal(pending.phase, 'awaiting-decision');
  const state = lockAndRollTable.decide(pending, bot(pending));
  assert.equal(state.phase, 'settled');
  fees += state.settlement['lock-and-roll'].fee ?? 0;
}
assert.ok(fees > 0);
assert.equal(playRound(lockAndRollTable, { 'lock-and-roll': 50 }, rng, bot).phase, 'settled');

console.log(
  `engine dist OK on Node ${process.versions.node}: exact RTP ${exact.bets.seven.rtp}, ` +
    `simulated ${report.bets.seven.rtp.toFixed(4)} over ${report.rounds} rounds; ` +
    `Dice Spread exact RTP ${between.bets.between.rtp} over ${between.outcomes} outcomes; ` +
    `Moving Target over ${movingTarget.outcomes} outcomes; Mirror over ${mirror.outcomes}, meter ` +
    `${(mirrorTable.jackpot.amount / 100).toFixed(2)}; Lock & Roll ${lockAndRoll.bets['lock-and-roll'].rtp} ` +
    `over ${lockAndRoll.outcomes}`,
);
