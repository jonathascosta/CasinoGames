# Original Table Games

A client-side demo lobby of four original casino table games. In each one **the player rolls two
dice and the dealer deals cards from a shoe**. It is a portfolio piece for game aggregators and
live-dealer studios. The priorities are code quality, a mobile-first table UX and math that anyone
can verify, ahead of feature count. There is no backend: everything runs in the browser with
virtual chips.

**Live demo:** <https://jonathascosta.github.io/CasinoGames/> ·
component playground: [`/dev.html`](https://jonathascosta.github.io/CasinoGames/dev.html)
(published from `main` by GitHub Actions, see [Deployment](#deployment))

## Status

The foundation is in place and three games, **Entre Dados**, **Alvo Móvel** and **Espelho**, are
playable, with their math proven exactly and by simulation. The fourth game is in design.

| Area                                              | State                                                                                                                                                                                                    |
| :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/engine`](packages/engine/src/index.ts) | Done: RNG, dice, shoe, round state machine, settlement, progressive jackpots, and the exact and Monte Carlo math tooling, all with tests                                                                 |
| [`packages/ui`](packages/ui/src/index.ts)         | Done: every table component, shown on the playground page                                                                                                                                                |
| [`apps/lobby`](apps/lobby/src/main.ts)            | Done: lobby grid, one route per game, the Entre Dados, Alvo Móvel and Espelho tables on a shared table controller, a placeholder table for the fourth                                                    |
| CI/CD                                             | Done: lint, typecheck, unit tests, Monte Carlo suites, Node 20/24 matrix, GitHub Pages deploy                                                                                                            |
| The games                                         | [Entre Dados](docs/games/entre-dados.md), [Alvo Móvel](docs/games/alvo-movel.md) and [Espelho](docs/games/espelho.md): playable, with game sheets, exact and Monte Carlo tests. Trancar: rules in design |

| Game                                     | Gloss            | Route          | State           |
| :--------------------------------------- | :--------------- | :------------- | :-------------- |
| [Entre Dados](docs/games/entre-dados.md) | Between the dice | `/entre-dados` | Playable        |
| [Alvo Móvel](docs/games/alvo-movel.md)   | Moving target    | `/alvo-movel`  | Playable        |
| [Espelho](docs/games/espelho.md)         | Mirror           | `/espelho`     | Playable        |
| Trancar                                  | Lock it in       | `/trancar`     | Rules in design |

## Quick start

You need Node 20.19+ or 22.13+ (22 LTS is recommended; `nvm use` reads [`.nvmrc`](.nvmrc)). You
also need pnpm, which Corepack provides at the version pinned in `package.json`.

```sh
corepack enable
pnpm install
pnpm dev   # lobby at http://localhost:5173, playground at http://localhost:5173/dev.html
```

| Command                                        | What it does                                                                                         |
| :--------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                     | Starts the Vite dev server for the lobby and the playground                                          |
| `pnpm build`                                   | Builds everything: the engine into `packages/engine/dist`, the site into `apps/lobby/dist`           |
| `pnpm preview`                                 | Serves the built site                                                                                |
| `pnpm test`                                    | Runs unit and exact-math tests for the engine, the UI kit (in jsdom) and the lobby (about 10 s)      |
| `pnpm test:math`                               | Runs the Monte Carlo suites: about 535 million seeded rounds (about 6 minutes)                       |
| `pnpm lint` · `pnpm format` · `pnpm typecheck` | Run type-aware ESLint, Prettier, and `tsc` for every project                                         |
| `pnpm docs:sheets`                             | Regenerates the paytables in `docs/games/*.md` from each game's `mathSummary()` (needs Node ≥ 22.18) |
| `pnpm docs:check`                              | Fails when a game sheet no longer matches the code (CI runs it)                                      |
| `pnpm --filter @casinogames/engine smoke`      | Imports the built engine from plain Node and plays rounds with it (run after `pnpm build`)           |

A Husky pre-commit hook runs `lint`, `format:check`, `typecheck` and `test`.

## Repository layout

```text
packages/
  engine/            Pure TypeScript game engine: zero dependencies, no DOM
    src/rng/           Rng interface, seeded xoshiro128**, crypto RNG, unbiased integers, shuffle
    src/dice/          rollDie, rollDice
    src/cards/         Cards, rank sets, Shoe (N decks, cut card, infinite mode), CardSource
    src/game/          Game and RoundState types, RoundBuilder, money, settlement, bet validation
    src/progressive/   In-memory progressive jackpot pool
    src/math/          Exact enumeration, BigInt fractions, Monte Carlo simulator, sheet renderer
    src/games/         The games (Entre Dados, Alvo Móvel, Espelho) and the GAMES registry
    src/testing/       Scripted RNG and cards, chi-square test (@casinogames/engine/testing)
    src/fixtures/      Two toy games that exercise the engine and its math tooling
  ui/                Table kit: DOM + CSS components with a PixiJS animation layer
    src/pixi/          The only place PixiJS is imported, loaded on demand
    src/theme/         Design tokens and base styles
apps/
  lobby/             The site: lobby, the tables on a shared controller (src/tables), playground
docs/
  ARCHITECTURE.md    How the pieces fit together, and why
  MATH.md            RTP conventions and how every declared figure is verified
  games/             One sheet per game, with paytables generated from code
  prompts/           The prompts that produced this repository, verbatim
scripts/             Repository tooling (the game-sheet generator)
.github/workflows/   CI and GitHub Pages deployment
```

## Architecture in brief

```mermaid
flowchart TD
  lobby["apps/lobby<br/>lobby, routes, playground"] --> ui["packages/ui<br/>DOM + CSS table kit"]
  lobby --> engine
  ui --> engine["packages/engine<br/>rules, RNG, money, math<br/>zero dependencies, no DOM"]
  ui --> pixi["pixi.js 8.21.0<br/>only in ui/src/pixi, loaded on demand"]
```

- **The engine decides every outcome and moves every cent. The UI only animates.** A round is a
  sequence of immutable `RoundState` snapshots. Each snapshot carries an ordered event log
  (`dice-rolled`, `card-dealt`, `decision-requested`, `bet-settled`…), which the UI replays with
  animations.
- **No `Math.random`, anywhere.** ESLint bans it. Every draw comes from an injected
  `Rng`, so rounds are reproducible from a seed and a certified RNG can replace the built-in ones.
- **The engine cannot reach the DOM.** It compiles against the bare ES2022 library with no ambient
  types, ESLint bans browser globals and UI imports inside it, and a test fails if it gains a
  runtime dependency.
- **PixiJS is confined to the animation layer.** It may only be imported in `packages/ui/src/pixi`
  (lint-enforced) and loads on demand, so the lobby never downloads it. Every Pixi view has a DOM
  fallback behind the same interface.
- **Published math comes from code.** Each game's paytable modal and game sheet are generated from
  its bet definitions. CI fails if a sheet drifts from the code.

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) covers each package, the round lifecycle, the event
catalogue and the reasoning behind the main decisions.

### A game, in miniature

Rules are written against a small builder that enforces the invariants: integer stakes within
limits, every placed bet settled exactly once, and no changes after a step closes. This toy (not one
of the four games) is complete:

```ts
import {
  defineBets,
  diceTotal,
  odds,
  startRound,
  summarizeMath,
  type Game,
} from '@casinogames/engine';

const EVEN = odds(1);
const bets = defineBets([
  {
    id: 'over',
    label: 'Over 7',
    kind: 'main',
    min: 50,
    max: 10_000,
    rtp: 30 / 36,
    paytable: [{ id: 'eight-plus', label: 'Total 8–12', odds: EVEN, probability: 15 / 36 }],
  },
]);

export function createOverSeven(): Game {
  const game: Game = {
    id: 'over-seven',
    name: 'Over Seven',
    bets,
    start(placed, rng) {
      const round = startRound(game, placed, rng); // validates stakes, emits round-started
      const dice = round.rollDice(); // draws from the injected rng, emits dice-rolled
      if (diceTotal(dice) >= 8) round.win('over', EVEN, 'eight-plus');
      else round.lose('over'); // either way, emits bet-settled
      return round.finish(undefined); // checks every bet is settled, emits round-settled
    },
    decide() {
      throw new Error('No decisions in this game');
    },
    mathSummary: () => summarizeMath(game),
  };
  return game;
}
```

Two calls then check the declared RTP, exactly and by simulation:

```ts
import { createSeededRng, exactReturns, simulate } from '@casinogames/engine';

// Exact, over all 36 rolls: '5/6'
exactReturns(createOverSeven, { over: 100 }).bets.over!.rtp.toString();
// Seeded Monte Carlo: bets.over.rtp lands within ±0.15 pp of 5/6
simulate(createOverSeven(), { rounds: 5_000_000, rng: createSeededRng('mc'), bets: { over: 100 } });
```

## Moving the engine server-side

In this demo the engine runs in the browser. In production the operator's server must decide the
outcomes and hold the money, and the client only renders them. The engine is built so that this
move is a deployment change rather than a port: the same package runs behind an API, unmodified.

**Why the code moves as is**

- **Platform-free by construction.** `packages/engine` has no runtime dependencies. It compiles
  against `lib: ["ES2022"]` with `types: []`, so a reference to `window`, `document`, `Buffer` or
  `process` does not compile. ESLint also bans browser globals and UI or PixiJS imports inside it.
- **Proven on Node in CI.** `pnpm build` emits plain ES2022 modules with type declarations. CI
  imports that build from plain Node ([`smoke.mjs`](packages/engine/scripts/smoke.mjs)) on Node 20,
  22 and 24. Node ≥ 22.18 can also run the TypeScript sources directly, because they use only
  erasable syntax (`erasableSyntaxOnly`).
- **Randomness is injected.** Games draw only from the `Rng` handed to `start()`. A server
  plugs in its certified RNG by implementing `next()`. If its RNG service does its own certified
  range scaling, it implements `IntegerRng.nextInt(n)` instead. Integer draws use rejection
  sampling, so there is no modulo bias, and the shuffle's draw order is specified. Replaying the
  same RNG stream therefore reproduces a round exactly.
- **Integer money.** Stakes, payouts and balances are integer cents. The only rounding is explicit
  breakage on fractional odds, so settlement agrees with a ledger to the cent.
- **Rounds are values.** `start(bets, rng)` and `decide(state, choice)` move from one immutable
  `RoundState` to the next. Apart from its `rng`, a snapshot is plain data: current bets, the
  ordered event log, settlement lines, the options on offer and the game's private `data`.
- **Typed rejections.** Every invalid input throws an `EngineError` with a stable `code`
  (`STAKE_ABOVE_MAX`, `MAIN_BET_REQUIRED`, `INVALID_CHOICE`, `NOT_AWAITING_DECISION`…). An API maps
  each code to a 4xx response.

**What a server adds around it**

1. **Persistence.** Store each snapshot without its `rng` and resume a round with
   `game.decide({ ...stored, rng }, choice)`.
2. **Wallet.** Debit the stakes in `round-started` and every `stake-added`, and credit the `payout`
   of every `bet-settled`. `round-settled` carries the round totals for reconciliation.
3. **Audit trail.** Keep `events`: every roll, card, decision, stake and settlement, in order.
4. **Client projection.** Before sending a snapshot, drop `data` and blank the card in every
   face-down `card-dealt` until its `card-revealed`. The UI kit already works this way:
   `CardDealer.deal(null, hand, { faceUp: false })` deals a face-down card without its face, and
   `reveal()` paints the face once it arrives, so a hidden card never reaches the page.
5. **Table resources.** Games take cards through the `CardSource` interface, so a server can
   serve a persisted shoe and a live table can serve a card reader. `ProgressiveJackpot` is the
   reference for the pool arithmetic: `state()` is its exact state to keep, and
   `new ProgressiveJackpot(options, state)` carries on from it, as the demo does between visits.
6. **Math checks.** `exactReturns` and `simulate` run in the server's CI against the same code
   it deploys.

The UI components never decide anything. `DiceRoller` animates the dice the engine drew,
`CardDealer` deals the cards it is handed and `replayEvents` drives both from the event log. The
client therefore stays the same whether the engine runs locally or behind an API.

## Verifiable math

Every declared RTP is proven twice, against the real game code:

- **Exact.** `exactReturns` runs the game over every possible sequence of draws (dice and an
  infinite shoe) with exact BigInt fractions. The declared RTP must equal the enumerated fraction.
- **Monte Carlo.** A seeded simulation must land within ±0.15 percentage points of the declared
  RTP, dealt from the card source the declared figures assume. Each run has at least 2,000,000
  rounds. Volatile bets get more, sized from the bet's standard deviation so the tolerance is 3.29
  standard errors (99.9%). Where the real shoe returns slightly different figures, a second run
  measures the shift and the game sheet publishes it.

Entre Dados shows the standard on a real game. All 36 rolls × 6 card values give exactly the
declared fractions: 26/27 for Entre, 11/12, 23/27, 5/6 and 31/36 for the side bets. A seeded run of
124,852,059 rounds against the real six-deck shoe lands every bet within 0.062 pp. The
[game sheet](docs/games/entre-dados.md) also measures card counting exactly, and flags that Entre
is countable at the default shoe penetration.

Alvo Móvel deals several cards a round, which a finite shoe changes. A memoised recursion over the
dealer's running total reproduces its published table, equals the declared figures and equals the
real game run over all 71,469 roll and card sequences, fraction for fraction. A seeded run of 40
million rounds on an infinite shoe lands every bet within 0.03 pp. A second run, of 184 million
rounds on the real six-deck shoe, measures how far each house edge moves: +0.03 pp for Acerta,
+0.09 pp for Primeira Carta and −0.09 pp for Três ou Mais, all published in the
[game sheet](docs/games/alvo-movel.md) with Acerta's per target. [docs/MATH.md](docs/MATH.md) covers
the RTP conventions, the RNG, finite and infinite shoes, round-count sizing and progressive
jackpots.

Espelho has a progressive meter. Its published table is reproduced from 36 rolls × 24 × 24 cards
(one figure corrected: Somas Iguais' edge is 8/81 = 9.88%, not 9.85%), and the game run over all
20,736 draws equals every declared fraction. Two cards a round and 54 rounds a shoe make every
round of the six-deck shoe a uniform draw from the full shoe, so its figures are exact too: the
pair bets lose about three points there. 6-6 vs 6-6 pays 1000 to 1 plus stake ÷ 25.00 of a meter
fed by 10% of its stakes; its declared 87.24% excludes the seed, and the sheet sets out the
meter's economics, including the seed's cost. Seeded runs of 125 million rounds on an infinite
shoe and 31 million on the real one confirm every figure, and measure the card counting exposure
per bet in the [game sheet](docs/games/espelho.md).

## Quality gates

| Where              | What runs                                                                            |
| :----------------- | :----------------------------------------------------------------------------------- |
| Pre-commit (Husky) | `lint`, `format:check`, `typecheck`, `test`                                          |
| CI: verify         | The same gates, then `docs:check`, `build`, and the engine smoke test on plain Node  |
| CI: math           | `test:math`, the Monte Carlo suites                                                  |
| CI: Node matrix    | Unit tests, engine build and smoke test on Node 20 (the supported floor) and Node 24 |
| Pages deploy       | Unit tests gate every deployment                                                     |

TypeScript runs in its strictest practical configuration: `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes` and `verbatimModuleSyntax`. ESLint uses `strictTypeChecked` plus the
architecture rules above.

## Deployment

[`pages.yml`](.github/workflows/pages.yml) builds the lobby and deploys it to GitHub Pages on every
push to `main`; it can also be run by hand. One-time setup: **Settings → Pages → Build and
deployment → Source: GitHub Actions**. The base path (`/CasinoGames/`) comes from
`actions/configure-pages`, so a custom domain needs no code change.

GitHub Pages only serves static files. For that reason the build writes a copy of `index.html` into
each game's folder, so deep links such as `/CasinoGames/espelho/` load directly. It also writes a
`404.html` that lets the client-side router handle any other path.

## Toolchain decisions

- **TypeScript 6.0.** It is the newest line supported by `typescript-eslint`.
- **Vitest 4 and jsdom 29.** Newer majors require Node 22, and the project supports Node 20. CI
  tests both ends.
- **PixiJS pinned to 8.21.0 exactly.** It is the only runtime dependency. There is no UI framework:
  the chrome is DOM and CSS, built with a small `h()` helper.
- **No other runtime dependencies.** The Markdown renderer for rules sheets, the router, the sound
  (Web Audio synthesis, no audio files) and the statistics are written in the repository and
  tested.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): packages, engine design, UI layering, data flow and
  decisions.
- [docs/MATH.md](docs/MATH.md): RTP conventions, verification method, progressive jackpots.
- [docs/games/](docs/games/): one sheet per game, which is also the in-game Rules dialog.
- [docs/prompts/](docs/prompts/): the prompt history of this project.

## License

All rights reserved. No license is granted to use, copy or distribute this code
(`"license": "UNLICENSED"` in every `package.json`).
