// Proves the built engine runs as plain ES modules on Node: no bundler, no
// TypeScript, no DOM. CI runs it after `pnpm --filter @casinogames/engine build`.
import assert from 'node:assert/strict';
import {
  ProgressiveJackpot,
  RANK_SETS,
  Shoe,
  createAlvoMovel,
  createCryptoRng,
  createEntreDados,
  createSeededRng,
  defineBets,
  exactReturns,
  odds,
  simulate,
  startRound,
  summarizeMath,
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

// A real game: Entre Dados, exactly and on its six-deck shoe.
const entre = exactReturns(
  () => createEntreDados({ source: createUniformRankSource(RANK_SETS.aceToSix) }),
  { entre: 100, triplo: 100 },
);
assert.equal(entre.outcomes, 216);
assert.equal(entre.bets.entre.rtp.toString(), '26/27');
assert.equal(entre.bets.triplo.rtp.toString(), '31/36');
const table = createEntreDados();
for (let round = 0; round < 1_000; round++) {
  const state = table.start({ entre: 100, exato: 50 }, rng);
  assert.equal(state.phase, 'settled');
}

// A game with a variable number of cards: Alvo Móvel, exactly and on its six-deck shoe.
const alvo = exactReturns(
  () => createAlvoMovel({ source: createUniformRankSource(RANK_SETS.aceToTen) }),
  { acerta: 100, 'tres-ou-mais': 100 },
);
assert.equal(alvo.outcomes, 71_469);
assert.equal(alvo.bets.acerta.rtp.toString(), '17307296056493/18000000000000');
assert.equal(alvo.bets['tres-ou-mais'].rtp.toString(), '43/48');
const alvoTable = createAlvoMovel();
for (let round = 0; round < 1_000; round++) {
  const state = alvoTable.start({ acerta: 100, 'primeira-carta': 50 }, rng);
  assert.equal(state.phase, 'settled');
}

console.log(
  `engine dist OK on Node ${process.versions.node}: exact RTP ${exact.bets.seven.rtp}, ` +
    `simulated ${report.bets.seven.rtp.toFixed(4)} over ${report.rounds} rounds; ` +
    `Entre Dados exact RTP ${entre.bets.entre.rtp} over ${entre.outcomes} outcomes; ` +
    `Alvo Móvel over ${alvo.outcomes} outcomes`,
);
