# Roll & Deal

**Four original table games. The player rolls the dice; the dealer deals the cards.**

Roll & Deal is a family of casino table games built on one idea: every round puts the two oldest
randomisers in the house side by side, the player's dice and the dealer's shoe. The dice belong to
the player, who throws them, and in one game chooses which to keep. The cards belong to the
dealer: they come from a six-deck shoe, face down, and turn over one by one. Each game can be
learnt in a round, settles on one roll and a card or a few, and publishes math that is proven
twice, exactly and by simulation, against the code that ships.

- **Play the demo:** <https://jonathascosta.github.io/CasinoGames/> (virtual chips, any phone or
  desktop browser).
- **Read the submission pack:** [SUBMISSION-PACK.pdf](SUBMISSION-PACK.pdf), each game's Rules of
  Play (for pit managers and dealer trainers) and Math Report (for gaming labs and analysts) in
  one file, generated from the code; [README.md](README.md#submission-documents) explains how to
  verify every figure.
- **Check the math live:** the demo's [RTP stats](https://jonathascosta.github.io/CasinoGames/stats)
  set every round played in the browser against the declared figures, bet by bet.

## At a glance

| Game          | In one line                                          | Main bet RTP |            Main bet wins | Side bets                          |
| :------------ | :--------------------------------------------------- | -----------: | -----------------------: | :--------------------------------- |
| Dice Spread   | Will the card land between your dice?                |       96.30% | 18.5% (and 44.4% pushes) | Four, 83.33% to 91.67%             |
| Moving Target | Your dice set the target. Will the cards land on it? |       96.15% |                    17.3% | Two, 91.67% and 89.58%             |
| Mirror        | Your dice against the dealer's cards, hand for hand. |       94.91% |                    47.5% | Five, one with a progressive meter |
| Lock & Roll   | Lock a die, roll the other, beat the cards.          |       95.93% |                    56.9% | None: a decision instead           |

Every RTP is an exact fraction (Between's is 26/27), declared on an infinite shoe; each game
Math Report also gives the figures on the table's own six-deck shoe. The demo's limits are 0.50 to
250.00 on a main bet and 0.50 to 25.00 on a side bet.

## The games

### Dice Spread

The player rolls two dice and the dealer deals one card, ace to six. **Between** wins when the
card lands strictly between the dice, and the closer the dice, the more it pays: 4 to 1 with a
single value between them, down to 1 to 2 with four. Dice one apart, or a pair, leave no room, so
the stake comes back. Every roll sets its own odds before the card turns, and the base game stays
gentle: 96.30%, with 18.5% of rounds won and 44.4% pushed. Four side bets ride on the same roll
and card, among them Bullseye (22 to 1, the card dead centre of a spread of two) and Triple (30
to 1, a pair and its card). The Math Report measures card counting exactly and flags that Between can
be counted at the default shoe penetration, which a live table needs to know.

### Moving Target

The dice set the target: their sum, 2 to 12. The dealer deals from a shoe of aces to tens, face
up, adding the cards as they come, and stops as soon as the total reaches or passes the target.
**Exact Hit** wins when the total lands exactly on it, and pays by how hard the target is to hit:
7.5 to 1 on a 2, 3 to 1 on a 10, 5 to 1 on 11 and 12, each target with its own published price
and house edge. Every card changes the count, so the tension builds card by card: of the four,
it is the game the dealer drives most. First Card (9 to 1: the first card alone hits the target)
and 3+ Cards (4 to 1: the dealer needs three cards or more) settle on the same deal. Exact Hit
returns 96.15%, and the Math Report measures how the real six-deck shoe moves each bet, by 0.11 points
at most.

### Mirror

The dice are the player's hand and two cards, ace to six, the dealer's, and both are read the
same way: a pair beats any non-pair and a higher pair a lower one; otherwise the higher sum wins,
then the higher value. **Mirror** pays even money when the dice outrank the cards, and a tie goes
to the house: 94.91%, won almost every other round (47.5%), the steadiest main bet of the four.
Five side bets play on the two hands mirroring each other, from Tie (17 to 1) and Equal Sums (7
to 1) to Perfect Mirror (200 to 1: the same pair) and **Double Sixes**: 1000 to 1 when both hands
are 6-6, plus a share of a progressive meter fed by 10% of its stakes and seeded at 5,000.00. The
lobby shows the meter live. It is where a shared or network jackpot plugs in.

### Lock & Roll

The game with a decision. After the roll the player may **Stand**, or **Lock**: keep one die and
roll the other once more, for the Lock fee of 40% of the bet, free on 1-1 and never returned.
The dealer then deals two cards, ace to six, and the bet pays even money when the dice add up to
more; a tie goes to the house. The best choice on each of the 21 rolls is computed by expected
value and published as a strategy card, and with it the game returns 95.93%. As in blackjack, the
declared RTP assumes the best play, and a player who strays from it returns less. The demo's
optional hint shows the best play, and autoplay follows it. The decision is a single one, so the
rounds stay short.

## Why dice and cards

- **The player holds the dice.** The throw is theirs: tap to roll, or hold and release to throw
  harder. The result is drawn the same way whatever the throw, which only shapes the animation;
  the agency is in the feel, as at a craps table, and in Lock & Roll's choice.
- **The dealer holds the shoe.** Cards give each round its reveal, and a shoe and a dealer are
  what players already know from live tables.
- **Short rounds, plain rules.** A round is one roll and a card or two: only Moving Target deals
  more, until its total reaches the target, at most 12 cards. None needs a paytable to be learnt.
- **One family.** The four share the table layout, chips, controls and conventions. A player who
  knows one can play the others; an operator integrates one engine and one client for all four.
- **Math anyone can check.** Every declared RTP is an exact fraction, proven by running the real
  game over every possible draw and confirmed by seeded simulations of millions of rounds, on an
  infinite shoe and on the real one. The paytables, the Rules of Play, the Math Reports and their PDF
  are generated from the code, every figure traced to the test that reproduces it, and CI fails if
  they drift.

## Random numbers

- **In the demo** every outcome comes from the browser's cryptographic RNG (Web Crypto), read in
  blocks. Integers are drawn by rejection sampling, so each die face and each card position has a
  probability of exactly 1/n, with no modulo bias, and shoes are shuffled by Fisher–Yates in a
  specified draw order.
- **In tests and simulations** a seeded xoshiro128\*\* (seeded through SplitMix64, and checked
  against the reference C implementation's vectors) makes every round reproducible: a seed and
  the bets replay a round exactly.
- **No `Math.random`,** anywhere: lint bans it. Every draw goes through one injected `Rng`
  interface.
- **Certification.** A certified RNG replaces the built-in one by implementing that interface:
  `next()` for a stream of uniform numbers, or `nextInt(n)` when the RNG service does its own
  certified scaling. The order of the draws is part of the engine's tested contract, and each
  round's event log records them in that order (a reshuffle, the dice, every card), so a
  laboratory can reproduce rounds from the RNG's output. The Math Reports make up the math side
  of a submission, and the Rules of Play its rules.

## At a live table

Each game's dealer side is already a real card game, so the four work as live formats as well as
RNG ones.

- **Real shoes.** Every figure is published for the six-deck shoe with the cut card at three
  quarters, not only for an infinite deck, and every Math Report measures the card counting
  exposure. Where a bet can be counted, as Between can at the default penetration, a studio can
  shuffle earlier or use a continuous shuffler.
- **The dealer rolls for the table.** Live, one roll (from a shaker or an automatic dice table,
  as in Sic Bo) and the same cards settle every player's bets. Lock & Roll's re-roll becomes one
  more die, rolled once for everyone who locked: each player keeps the die they chose, and the
  math of every seat is unchanged.
- **Readers feed the same engine.** The engine takes its cards through a `CardSource` interface
  and its dice through the RNG's `nextInt`, so a studio's card reader and dice recognition can
  feed the very engine that settles the online game: one implementation of the rules and one set
  of math for both products.
- **Results as events.** A round is an ordered event log (`dice-rolled`, `card-dealt`,
  `card-revealed`, `bet-settled`…), and the table client only replays events. The same betting
  interface can run over a studio's video, driven by the studio's events.

## Going server-side

In the demo the engine runs in the browser with virtual chips. With real money, the operator's
server decides every outcome and holds the money, and the client only shows them. The plan keeps
the engine as it is.

1. **The engine, unchanged, behind an API.** `packages/engine` has no dependencies and uses no
   browser or Node API: the compiler and lint enforce both, and CI already imports its built
   package from plain Node, versions 20 to 24. A thin service wraps its two calls:
   `start(bets, rng)` opens a round and `decide(state, choice)` answers Lock & Roll's decision.
   Invalid input comes back as typed errors (`STAKE_ABOVE_MAX`, `MAIN_BET_REQUIRED`…) that map to
   4xx responses.
2. **A certified RNG in place of Web Crypto.** The server hands its certified RNG to `start()`
   through the same `Rng` interface. Nothing in the games changes, and the exact and Monte Carlo
   suites run in the server's CI against the code it deploys.
3. **Rounds stored as they are.** A round is a sequence of immutable snapshots of plain data. The
   server stores each one (without the RNG), resumes a pending decision from the stored snapshot,
   and keeps the event log as the audit trail: every roll, card, decision, stake, fee and payout,
   in order.
4. **Only what the player may see.** The server sends a projection of each snapshot: the game's
   private data dropped, and face-down cards blank until they are revealed. The table client
   already deals a face-down card without its face, so a hidden card never reaches the page.
5. **A wallet API, to be defined.** The event log already names every money movement, in integer
   cents: debit the stakes on `round-started` and `stake-added`, debit `fee-charged` (the Lock
   fee), credit each `bet-settled` payout, and reconcile on `round-settled`. What the API agreed
   with each aggregator adds is what a demo does not need: player sessions and authentication,
   balance checks before a round, idempotent transaction ids for retries, the rollback of a round
   that fails before it settles, currencies, and the jackpot's contributions and wins.
6. **Shared progressives.** Mirror's meter moves to the server as the pool's exact state, which
   the engine's `ProgressiveJackpot` keeps and carries on from, and can then be shared across
   players, tables or operators.

The rules, the paytables, the declared RTPs, the event log and the table client stay as they are:
the client replays the same events whether the engine runs in the page or behind an API.

## The client

- **Mobile first.** Built from 360 px up, portrait or landscape, touch, mouse or keyboard.
  Lighthouse, as a phone, scores every page at 98 or more for performance and 100 for
  accessibility, and CI fails any page under 90.
- **Light.** The lobby loads about 15 kB of compressed JavaScript. A table opens on CSS dice and
  cards, then loads the 3D dice and dealt cards (PixiJS, the one runtime dependency) on the
  player's first tap, and switches to them at the next round.
- **Accessible.** Every control works from the keyboard, dealt cards and results are announced to
  screen readers, and reduced motion is honoured throughout. Sound is synthesised, with no audio
  files to load.

## Where it stands

Version 0.1.0 is a complete demo: four playable games, their math proven exactly and by
simulation, a Rules of Play and a Math Report per game generated from the code, a lobby with the declared RTPs and
the live meter, and an RTP stats page. The next steps are the ones an operator sets: the wallet
API with a first aggregator, the engine deployed behind it with a certified RNG, and the
certification of the RNG and the math. The architecture and the math behind every figure are in
[ARCHITECTURE.md](ARCHITECTURE.md) and [MATH.md](MATH.md).
