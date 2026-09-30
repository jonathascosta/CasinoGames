# Documentation

| Document                                      | What it covers                                                                                            |
| :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| [Submission documents](#submission-documents) | Per game, the Rules of Play and the Math Report, generated from the code; all of them in one PDF          |
| [ARCHITECTURE.md](ARCHITECTURE.md)            | Packages and the rules between them, engine design, UI layering, the lobby, data flow, testing, decisions |
| [MATH.md](MATH.md)                            | RTP conventions, randomness, exact and Monte Carlo verification, progressive jackpots                     |
| [PITCH.md](PITCH.md)                          | The pitch for aggregators and studios                                                                     |
| [prompts/](prompts/)                          | The prompts that produced this repository, verbatim                                                       |

Start with the [README](../README.md) for what the project is and how to run it.

## Submission documents

Two documents per game, for table-game distributors and gaming laboratories:

| Game          | Rules of Play                                    | Math Report                                    |
| :------------ | :----------------------------------------------- | :--------------------------------------------- |
| Dice Spread   | [rules/dice-spread.md](rules/dice-spread.md)     | [math/dice-spread.md](math/dice-spread.md)     |
| Moving Target | [rules/moving-target.md](rules/moving-target.md) | [math/moving-target.md](math/moving-target.md) |
| Mirror        | [rules/mirror.md](rules/mirror.md)               | [math/mirror.md](math/mirror.md)               |
| Lock & Roll   | [rules/lock-and-roll.md](rules/lock-and-roll.md) | [math/lock-and-roll.md](math/lock-and-roll.md) |

- **The Rules of Play** are for a pit manager or a live-dealer trainer: plain English, no code and
  no figure beyond the paytable. The game and the document, the objective, the equipment, the
  table layout, each wager (when it is placed, its limits, what wins, pushes and loses, and what
  it pays), the sequence of play with the dealer's procedure, how hands or totals compare, the
  settlement, how the game runs at a live table, and the rulings on irregularities. The rulings
  that are standard casino practice rather than rules the code decides close each document, in a
  list to confirm. The table's Rules dialog in the demo shows the objective to the settlement;
  the lobby shows the whole document.
- **The Math Report** is for a gaming-lab mathematician or a distributor's analyst: a summary of
  every wager (RTP, house edge, hit frequency, standard deviation, maximum payout and exposure),
  the game model, each wager's exact analysis with its full outcome table, the progressive meter
  (Mirror), the effect of the real six-deck shoe, the simulations that verify the figures, the
  assumptions, card counting included, and an appendix. Every table names the test that
  reproduces it.
- **[results.json](results.json)** holds every figure both documents quote, and
  **[SUBMISSION-PACK.pdf](SUBMISSION-PACK.pdf)** holds all eight documents behind a cover.

### How they are generated

[`tools/generate-docs.ts`](../tools/generate-docs.ts) writes all of them (`pnpm docs:generate`),
from two sources only: each game's `mathSummary()`, which declares its figures, and the figures
its tests record. Every exact and Monte Carlo suite writes what it computes to
`packages/engine/src/games/<game>/results/<name>.json`, with the test's file and name
([`record.ts`](../packages/engine/src/testing/record.ts)); a test fails when it computes anything
else. The generator gathers them into `results.json`, with the table facts the Rules of Play read
from the engine's configuration and rules, and writes the documents from `results.json` alone.

No number in a document is typed by hand. The templates
([`tools/docs/`](../tools/docs/)) cannot hold a digit: every number is a value of
`results.json`, written by a named formatter and marked with its path. Once a document is
written, the generator re-reads each figure from `results.json` and fails if its text differs,
or if any digit stands outside a figure or a section number. `pnpm docs:check`, which CI runs,
regenerates everything without writing and fails if a file differs from what the code gives now:
a hand-edited document, a stale `results.json` or a PDF printed from older sources.

The Math Report names the commit its figures come from: the last commit that changed the engine,
its tests or their records. After changing a game or a test, record the new figures
(`pnpm test -u`, `pnpm test:math -u`), commit the engine, then run `pnpm docs:generate` and
commit the documents. Merge such a branch with a merge commit: a squash merge makes a new engine
commit, and `pnpm docs:check` then fails until the documents are regenerated to name it. The PDF
needs Chrome or Chromium (`CHROME_PATH`); `--skip-pdf` writes the rest without it.

### How to verify

Clone the repository and install it (`corepack enable`, `pnpm install`; Node 22.18 or later),
then run `pnpm test:math`. It replays every simulation of the Math Reports from its seed through
the production game and compares what it measures, figure by figure, with the results it
recorded: those are the figures in `results.json`, under each game's `records`, each with the
test that produced it. The run fails on any difference, so a pass reproduces every simulated
figure exactly. `pnpm test` does the same for the exact figures, which it derives by enumerating
the real game over every outcome, and `pnpm docs:check` regenerates `results.json` and every
document from the code and fails if one differs from the committed files.
