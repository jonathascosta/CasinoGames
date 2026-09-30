# Moving Target — Math Report

_Your dice set the target. Will the cards land on it?_

## 1. Cover

| Game | Moving Target, an original table game of the Roll & Deal family |
| :-- | :-- |
| Version | 0.1.0 |
| Document | Math Report, revision 3 |
| Date | 2026-09-30 |
| Author | Jonathas Costa |
| Code | commit `47bab22a941c983cd3e18fd6989ebb7a1e6479b5` (2026-09-30): the last change to the engine, its tests or their recorded results |
| Figures | `docs/results.json`, written with this report by `tools/generate-docs.ts` |
| Companion | Rules of Play (`docs/rules/moving-target.md`) |

**Revision history**

| Revision | Date | Author | Change |
| :-- | :-- | :-- | :-- |
| 1 | 2026-09-30 | Jonathas Costa | First game sheet: rules, declared math, exact and Monte Carlo tests. The six-deck shoe's shift measured. |
| 2 | 2026-09-30 | Jonathas Costa | Renamed from its working title, with English names for the game and its bets. |
| 3 | 2026-09-30 | Jonathas Costa | Reformatted for submission as two documents, Rules of Play and Math Report, generated from the code with every figure traced to the engine or to a test; card counting measured on every game. |

**How to read this report.** Every figure is read from `docs/results.json`, which the generator
builds from the game's `mathSummary()` (the declared figures) and from the figures its tests record
(`packages/engine/src/games/moving-target/results/`); the generator fails if a document holds a
number that is not in it. Each table names the test that reproduces it, as file › suite › test:
`pnpm test` runs the exact tests and `pnpm test:math` the simulations, and each fails if it no
longer reproduces its recorded figures. Returns are per unit staked, the stake included; exact
figures are fractions, rounded percentages beside them.

## 2. Summary

| Wager | RTP | House edge | Hit frequency | SD per unit | Max payout | Max exposure at max bet |
| :-- | --: | --: | --: | --: | --: | --: |
| Exact Hit (main) | 96.1516% | 3.8484% | 17.3010% | 2.1478 | 7.5× | 1,875.00 (on 250.00) |
| First Card (side) | 91.6667% | 8.3333% | 9.1667% | 2.8855 | 9× | 225.00 (on 25.00) |
| 3+ Cards (side) | 89.5833% | 10.4167% | 17.9167% | 1.9175 | 4× | 100.00 (on 25.00) |

- **RTP** and **house edge** are per unit staked, pushes included. **Hit frequency** is the chance
  that the wager wins in a round. **SD per unit** is the standard deviation of the net result per
  unit staked.
- **Max payout** is the largest net win per unit staked, the stake being returned on top. **Max
  exposure at max bet** is the most a single wager at its maximum can win in a round, found by
  running the real game over every outcome at the table maximums; all the wagers of one position
  together can win at most 2,075.00 in a round.

_Reproduced by `packages/engine/src/games/moving-target/moving-target.test.ts` › Moving Target —
exact math › the real game over every roll and card sequence › breaks every bet down by target,
adding up to its declared figures, and finds the most a round can pay._ The declared figures are
`mathSummary()` (bets.ts); the test holds them equal to the enumeration.

## 3. Game model

- **Sample space.** The dice (d₁, d₂) are uniform on 1 to 6: 36 rolls, whose sum is the target T,
  from 2 to 12. The cards c₁, c₂, … take values 1 to 10, and the deal stops at the first K with c₁ +
  … + c_K ≥ T. Ω is the set of rolls and the card sequences each can deal: 71,469 outcomes (from 19
  sequences for a target of 2 to 18,424 for 12), each with the product of its draws' chances.
- **Card supply.** The declared figures take every card value equally likely and independent: an
  infinite shoe, as an RNG game that draws each card independently deals it. With every value
  equally likely, the running total, which starts at zero, passes through n with chance h(n) = (h(n
  − 1) + … + h(n − 10)) / 10, and Exact Hit on a target T wins with chance h(T); bets.ts declares
  these chances in closed form, and the exact test checks the closed forms against the recursion and
  the game. The real 6-deck shoe deals without replacement and its rounds interact; section six
  measures by how much that moves each figure.
- **Decisions.** None: every wager is settled by the roll and the deal.

## 4. Per-wager analysis

### 4.1 Exact Hit (main)

**Wins** when the running total X_k = c₁ + … + c_k takes the value T for some k, that is X_K = T
where K is the first k with X_k ≥ T; paid at the odds of T. **Method:** a memoised recursion over
the running total and the card count, written from the rules alone, checked against the closed forms
of bets.ts and against exact enumeration of the production game over Ω; all three agree as
fractions.

By target, weighted by the dice:

| Target | P(target) | P(win \| target) | Pays | Return given target | House edge given target | P(target and win) | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| 2 | 1/36 | 11/100 (11.00%) | 15 to 2 | 93.500% | 6.500% | 0.3056% | 2.5972% |
| 3 | 1/18 | 121/1000 (12.10%) | 7 to 1 | 96.800% | 3.200% | 0.6722% | 5.3778% |
| 4 | 1/12 | 1331/10000 (13.31%) | 6 to 1 | 93.170% | 6.830% | 1.1092% | 7.7642% |
| 5 | 1/9 | 14641/100000 (14.64%) | 11 to 2 | 95.166% | 4.833% | 1.6268% | 10.5741% |
| 6 | 5/36 | 161051/1000000 (16.11%) | 5 to 1 | 96.631% | 3.369% | 2.2368% | 13.4209% |
| 7 | 1/6 | 1771561/10000000 (17.72%) | 9 to 2 | 97.436% | 2.564% | 2.9526% | 16.2393% |
| 8 | 5/36 | 19487171/100000000 (19.49%) | 4 to 1 | 97.436% | 2.564% | 2.7066% | 13.5328% |
| 9 | 1/9 | 214358881/1000000000 (21.44%) | 7 to 2 | 96.461% | 3.539% | 2.3818% | 10.7179% |
| 10 | 1/12 | 2357947691/10000000000 (23.58%) | 3 to 1 | 94.318% | 5.682% | 1.9650% | 7.8598% |
| 11 | 1/18 | 15937424601/100000000000 (15.94%) | 5 to 1 | 95.625% | 4.375% | 0.8854% | 5.3125% |
| 12 | 1/36 | 165311670611/1000000000000 (16.53%) | 5 to 1 | 99.187% | 0.813% | 0.4592% | 2.7552% |
| **All targets** |  |  |  |  |  |  | **96.1516%** |

As an outcome table:

| Outcome | Probability | Exactly | Pays | Returns per unit | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: |
| Total exactly 2 | 0.3056% | 11/3600 | 15 to 2 | 17/2 | 187/7200 |
| Total exactly 3 | 0.6722% | 121/18000 | 7 to 1 | 8 | 121/2250 |
| Total exactly 4 | 1.1092% | 1331/120000 | 6 to 1 | 7 | 9317/120000 |
| Total exactly 5 | 1.6268% | 14641/900000 | 11 to 2 | 13/2 | 190333/1800000 |
| Total exactly 6 | 2.2368% | 161051/7200000 | 5 to 1 | 6 | 161051/1200000 |
| Total exactly 7 | 2.9526% | 1771561/60000000 | 9 to 2 | 11/2 | 19487171/120000000 |
| Total exactly 8 | 2.7066% | 19487171/720000000 | 4 to 1 | 5 | 19487171/144000000 |
| Total exactly 9 | 2.3818% | 214358881/9000000000 | 7 to 2 | 9/2 | 214358881/2000000000 |
| Total exactly 10 | 1.9650% | 2357947691/120000000000 | 3 to 1 | 4 | 2357947691/30000000000 |
| Total exactly 11 | 0.8854% | 5312474867/600000000000 | 5 to 1 | 6 | 5312474867/100000000000 |
| Total exactly 12 | 0.4592% | 165311670611/36000000000000 | 5 to 1 | 6 | 165311670611/6000000000000 |
| Any other outcome | 82.6990% | 29771629856069/36000000000000 | loses | 0 | 0 |

- **Total return (RTP):** 17307296056493/18000000000000 (96.1516%), the sum of the contributions.
- **House edge:** 692703943507/18000000000000 (3.8484%).
- **Variance** of the net result per unit staked:
  1494642153505545850952540951/324000000000000000000000000 (4.6131); **standard deviation** 2.1478.
- **Hit frequency** (the wager wins): 6228370143931/36000000000000 (17.3010%).

_Reproduced by `packages/engine/src/games/moving-target/moving-target.test.ts` › Moving Target —
exact math › the real game over every roll and card sequence › breaks every bet down by target,
adding up to its declared figures, and finds the most a round can pay._

### 4.2 First Card (side)

**Wins** when c₁ = T (possible only for T ≤ 10). **Method:** a memoised recursion over the running
total and the card count, written from the rules alone, checked against the closed forms of bets.ts
and against exact enumeration of the production game over Ω; all three agree as fractions.

By target, weighted by the dice:

| Target | P(target) | P(win \| target) | Pays | Return given target | House edge given target | P(target and win) | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| 2 | 1/36 | 1/10 (10.00%) | 9 to 1 | 100.000% | 0.000% | 0.2778% | 2.7778% |
| 3 | 1/18 | 1/10 (10.00%) | 9 to 1 | 100.000% | 0.000% | 0.5556% | 5.5556% |
| 4 | 1/12 | 1/10 (10.00%) | 9 to 1 | 100.000% | 0.000% | 0.8333% | 8.3333% |
| 5 | 1/9 | 1/10 (10.00%) | 9 to 1 | 100.000% | 0.000% | 1.1111% | 11.1111% |
| 6 | 5/36 | 1/10 (10.00%) | 9 to 1 | 100.000% | 0.000% | 1.3889% | 13.8889% |
| 7 | 1/6 | 1/10 (10.00%) | 9 to 1 | 100.000% | 0.000% | 1.6667% | 16.6667% |
| 8 | 5/36 | 1/10 (10.00%) | 9 to 1 | 100.000% | 0.000% | 1.3889% | 13.8889% |
| 9 | 1/9 | 1/10 (10.00%) | 9 to 1 | 100.000% | 0.000% | 1.1111% | 11.1111% |
| 10 | 1/12 | 1/10 (10.00%) | 9 to 1 | 100.000% | 0.000% | 0.8333% | 8.3333% |
| 11 | 1/18 | 0 (0.00%) | 9 to 1 | 0.000% | 100.000% | 0.0000% | 0.0000% |
| 12 | 1/36 | 0 (0.00%) | 9 to 1 | 0.000% | 100.000% | 0.0000% | 0.0000% |
| **All targets** |  |  |  |  |  |  | **91.6667%** |

As an outcome table:

| Outcome | Probability | Exactly | Pays | Returns per unit | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: |
| The first card is the target | 9.1667% | 11/120 | 9 to 1 | 10 | 11/12 |
| Any other outcome | 90.8333% | 109/120 | loses | 0 | 0 |

- **Total return (RTP):** 11/12 (91.6667%), the sum of the contributions.
- **House edge:** 1/12 (8.3333%).
- **Variance** of the net result per unit staked: 1199/144 (8.3264); **standard deviation** 2.8855.
- **Hit frequency** (the wager wins): 11/120 (9.1667%).

_Reproduced by `packages/engine/src/games/moving-target/moving-target.test.ts` › Moving Target —
exact math › the real game over every roll and card sequence › breaks every bet down by target,
adding up to its declared figures, and finds the most a round can pay._

### 4.3 3+ Cards (side)

**Wins** when K ≥ 3, that is c₁ + c₂ < T. **Method:** a memoised recursion over the running total
and the card count, written from the rules alone, checked against the closed forms of bets.ts and
against exact enumeration of the production game over Ω; all three agree as fractions.

By target, weighted by the dice:

| Target | P(target) | P(win \| target) | Pays | Return given target | House edge given target | P(target and win) | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| 2 | 1/36 | 0 (0.00%) | 4 to 1 | 0.000% | 100.000% | 0.0000% | 0.0000% |
| 3 | 1/18 | 1/100 (1.00%) | 4 to 1 | 5.000% | 95.000% | 0.0556% | 0.2778% |
| 4 | 1/12 | 3/100 (3.00%) | 4 to 1 | 15.000% | 85.000% | 0.2500% | 1.2500% |
| 5 | 1/9 | 3/50 (6.00%) | 4 to 1 | 30.000% | 70.000% | 0.6667% | 3.3333% |
| 6 | 5/36 | 1/10 (10.00%) | 4 to 1 | 50.000% | 50.000% | 1.3889% | 6.9444% |
| 7 | 1/6 | 3/20 (15.00%) | 4 to 1 | 75.000% | 25.000% | 2.5000% | 12.5000% |
| 8 | 5/36 | 21/100 (21.00%) | 4 to 1 | 105.000% | −5.000% | 2.9167% | 14.5833% |
| 9 | 1/9 | 7/25 (28.00%) | 4 to 1 | 140.000% | −40.000% | 3.1111% | 15.5556% |
| 10 | 1/12 | 9/25 (36.00%) | 4 to 1 | 180.000% | −80.000% | 3.0000% | 15.0000% |
| 11 | 1/18 | 9/20 (45.00%) | 4 to 1 | 225.000% | −125.000% | 2.5000% | 12.5000% |
| 12 | 1/36 | 11/20 (55.00%) | 4 to 1 | 275.000% | −175.000% | 1.5278% | 7.6389% |
| **All targets** |  |  |  |  |  |  | **89.5833%** |

As an outcome table:

| Outcome | Probability | Exactly | Pays | Returns per unit | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: |
| Three cards or more | 17.9167% | 43/240 | 4 to 1 | 5 | 43/48 |
| Any other outcome | 82.0833% | 197/240 | loses | 0 | 0 |

- **Total return (RTP):** 43/48 (89.5833%), the sum of the contributions.
- **House edge:** 5/48 (10.4167%).
- **Variance** of the net result per unit staked: 8471/2304 (3.6766); **standard deviation** 1.9175.
- **Hit frequency** (the wager wins): 43/240 (17.9167%).

_Reproduced by `packages/engine/src/games/moving-target/moving-target.test.ts` › Moving Target —
exact math › the real game over every roll and card sequence › breaks every bet down by target,
adding up to its declared figures, and finds the most a round can pay._

## 5. Progressive analysis

Not applicable: Moving Target has no progressive wager.

## 6. Finite-shoe effects

Two tests measure the 6-deck shoe against the declared, infinite-shoe figures. The first round after
a shuffle is computed exactly, by a recursion over the cards drawn without replacement from a full
shoe (24 cards of each value): a second card of a value already drawn is less likely, so totals
reached through pairs get rarer. The long run is simulated on the production game, with its cut card
after 180 cards and reshuffles: over whole shoes the rounds interact, since each round takes cards
whose mix depends on the target it chased, and the number of rounds a shoe deals depends on its
cards.

| Wager | House edge, declared | First round, exact | Long run, observed | Long-run shift | Standard error |
| :-- | --: | --: | --: | --: | --: |
| Exact Hit | 3.848% | 3.978% | 3.885% | +0.036 pp | 0.016 pp |
| First Card | 8.333% | 8.333% | 8.391% | +0.058 pp | 0.021 pp |
| 3+ Cards | 10.417% | 10.617% | 10.302% | −0.114 pp | 0.014 pp |

Exact Hit by target (house edge; a positive shift is dearer for the player):

| Target | Declared | First round, exact | Long run, observed | Long-run shift | Standard error |
| :-- | --: | --: | --: | --: | --: |
| 2 | 6.50% | 6.82% | 6.59% | +0.09 pp | 0.118 pp |
| 3 | 3.20% | 3.22% | 2.93% | −0.27 pp | 0.082 pp |
| 4 | 6.83% | 7.11% | 7.06% | +0.23 pp | 0.061 pp |
| 5 | 4.83% | 4.87% | 4.70% | −0.13 pp | 0.051 pp |
| 6 | 3.37% | 3.62% | 3.49% | +0.12 pp | 0.044 pp |
| 7 | 2.56% | 2.60% | 2.49% | −0.08 pp | 0.038 pp |
| 8 | 2.56% | 2.78% | 2.79% | +0.22 pp | 0.039 pp |
| 9 | 3.54% | 3.56% | 3.50% | −0.04 pp | 0.041 pp |
| 10 | 5.68% | 5.84% | 5.86% | +0.18 pp | 0.043 pp |
| 11 | 4.38% | 4.38% | 4.27% | −0.10 pp | 0.069 pp |
| 12 | 0.81% | 1.06% | 0.96% | +0.15 pp | 0.099 pp |

Which figures a table returns depends on how it deals: an RNG table that draws every card
independently returns the declared figures; one that reshuffles a virtual 6-deck shoe before every
round, as a continuous shuffler does, returns the first-round column; a shoe dealt down to the cut
card, as at a live table, returns the long-run column. No wager's edge moves by more than 0.25 pp
(the test's bound). _Reproduced by `packages/engine/src/games/moving-target/finite-shoe.test.ts` ›
Moving Target — the first round of a fresh six-deck shoe, exactly › measures every bet, and Exact
Hit by target, on the first round of a fresh shoe;
`packages/engine/src/games/moving-target/six-deck.math.test.ts` › Moving Target — the six-deck shoe
against the declared (infinite-shoe) figures › shifts no edge by more than a quarter of a point, and
reports each shift._

## 7. Simulation verification

**On the infinite shoe**, against the declared figures:

| Rounds | 40,055,852 |
| :-- | :-- |
| Generator | xoshiro128** 1.1 (Blackman & Vigna), its state expanded from the seed by SplitMix64; a string seed is first hashed with FNV-1a (64-bit) over its UTF-8 bytes |
| Seed | `moving-target/infinite-shoe` |
| Cards | an infinite shoe (every card drawn independently and uniformly from one deck of ranks 1 to 10 in 4 suits) |
| Stakes | every wager at its minimum each round: Exact Hit 0.50, First Card 0.50 and 3+ Cards 0.50 |
| Criterion | each RTP within ±0.15 pp of the declared figure and each hit frequency within 3.29 binomial standard errors; the round count makes ±0.15 pp equal to 3.29 standard errors for the most volatile wager |

| Figure | Observed | Expected | Difference | Standard error | 95% confidence interval | Allowed | Result |
| :-- | --: | --: | --: | --: | --: | --: | :-- |
| Exact Hit, RTP | 96.153% | 96.152% | +0.001 pp | 0.034 pp | 96.086% to 96.219% | ±0.150 pp | **pass** |
| Exact Hit, hit frequency | 17.300% | 17.301% | −0.001 pp | 0.006 pp | 17.289% to 17.312% | ±0.020 pp | **pass** |
| First Card, RTP | 91.668% | 91.667% | +0.001 pp | 0.046 pp | 91.578% to 91.757% | ±0.150 pp | **pass** |
| First Card, hit frequency | 9.167% | 9.167% | 0.000 pp | 0.005 pp | 9.158% to 9.176% | ±0.015 pp | **pass** |
| 3+ Cards, RTP | 89.578% | 89.583% | −0.006 pp | 0.030 pp | 89.518% to 89.637% | ±0.150 pp | **pass** |
| 3+ Cards, hit frequency | 17.916% | 17.917% | −0.001 pp | 0.006 pp | 17.904% to 17.927% | ±0.020 pp | **pass** |

_Reproduced by `packages/engine/src/games/moving-target/moving-target.math.test.ts` › Moving Target
— Monte Carlo against the declared figures (infinite shoe) › lands every bet within ±0.15 pp of its
declared RTP._

**On the 6-deck shoe**, measuring the shift of section six rather than checking a declared figure:

| Rounds | 183,929,931 |
| :-- | :-- |
| Generator | xoshiro128** 1.1 (Blackman & Vigna), its state expanded from the seed by SplitMix64; a string seed is first hashed with FNV-1a (64-bit) over its UTF-8 bytes |
| Seed | `moving-target/six-deck-shoe` |
| Cards | the 6-deck shoe of 240 cards, ranks 1 to 10, with its cut card after 180 cards (penetration 75%) and reshuffles, as the production game deals it |
| Stakes | every wager at its minimum each round: Exact Hit 0.50, First Card 0.50 and 3+ Cards 0.50 |
| Criterion | no wager's house edge shifted by more than 0.25 pp from the declared figure, and no target's by more than that plus 3.29 standard errors; the round count measures each wager's shift to ±0.07 pp at 3.29 standard errors |

| Figure | Observed | Expected | Difference | Standard error | 95% confidence interval | Allowed | Result |
| :-- | --: | --: | --: | --: | --: | --: | :-- |
| Exact Hit, house edge | 3.885% | 3.848% | +0.036 pp | 0.016 pp | 3.854% to 3.916% | ±0.250 pp | **pass** |
| First Card, house edge | 8.391% | 8.333% | +0.058 pp | 0.021 pp | 8.349% to 8.433% | ±0.250 pp | **pass** |
| 3+ Cards, house edge | 10.302% | 10.417% | −0.114 pp | 0.014 pp | 10.275% to 10.330% | ±0.250 pp | **pass** |

The 95% confidence interval is the observed value ± 1.96 standard errors, and at that level about
one figure in twenty falls outside its interval by chance. The tests' own criterion, "Allowed"
above, is wider: 3.29 standard errors, or a fixed tolerance. _Reproduced by
`packages/engine/src/games/moving-target/six-deck.math.test.ts` › Moving Target — the six-deck shoe
against the declared (infinite-shoe) figures › shifts no edge by more than a quarter of a point, and
reports each shift._

## 8. Assumptions and limitations

**Independence.** The dice and the cards are independent: the RNG draws each die and each card
separately (a live table uses separate devices), and nothing about the dice changes the shoe. Within
a round the cards are dealt from one shoe, which the finite-shoe figures account for.

**Card counting.** The cards are dealt face up, so a player who tracks them knows the shoe's
composition before every round. A seeded run of 5,000,000 rounds of the production game (seed
`moving-target/counting`, 50,291 shoes) computes each wager's exact expectation for the composition
before every round: the chance that some first k cards of the shoe add up to the target is a sum
over the multisets of values that do, each with its hypergeometric chance, which the test checks
against a direct recursion.

| Wager | Rounds favouring a perfect counter | Counter’s edge in them | Break-even bet spread |
| :-- | --: | --: | --: |
| Exact Hit | 11.07% | 2.8% | 1 to 13.6 |
| First Card | 0.85% | 1.7% | 1 to 580.0 |
| 3+ Cards | 11.55% | 7.4% | 1 to 13.0 |

The break-even spread is how much more a perfect counter must stake in the favourable rounds than in
the others (one unit) to break even. Exact Hit and 3+ Cards can be counted at the table's
penetration, First Card barely. A live table should use a continuous shuffling machine or shuffle
much earlier; an RNG table that reshuffles every round is immune. _Reproduced by
`packages/engine/src/games/moving-target/counting.math.test.ts` › Moving Target — card counting on
the six-deck shoe › measures how often the cards left favour each bet, and the spread a counter
needs._

**Rounding.** Winnings are paid to the cent, rounded down (the engine's `winnings()`); the declared
figures assume exact pays. Every odds in these games has a denominator of one or two, so a wager in
multiples of the minimum pays exactly and the rounding never applies at the table's stakes.

**No player or dealer error** is modelled, nor any irregularity: the figures are those of the rules
as the engine settles them.

**Randomness.** The analysis assumes a certified RNG: every die face and every card position equally
likely and independent. The engine draws integers by rejection sampling, without modulo bias, and
shuffles by Fisher–Yates in a specified order.

## 9. Appendix

The full enumeration of 71,469 outcomes does not fit a page; the tests hold it.
`moving-target.test.ts` runs the production game over every roll and card sequence and checks each
wager's RTP, hit frequency, lines and variance against the recursion, and its record holds the
per-target figures above as exact fractions. The number of card sequences by target:

| Target | Rolls | Card sequences |
| :-- | --: | --: |
| 2 | 1 | 19 |
| 3 | 2 | 37 |
| 4 | 3 | 73 |
| 5 | 4 | 145 |
| 6 | 5 | 289 |
| 7 | 6 | 577 |
| 8 | 5 | 1,153 |
| 9 | 4 | 2,305 |
| 10 | 3 | 4,609 |
| 11 | 2 | 9,217 |
| 12 | 1 | 18,424 |

**Records.** The tests recorded these figures (`packages/engine/src/games/moving-target/results/`):

| Record | Test |
| :-- | :-- |
| `counting.json` | `packages/engine/src/games/moving-target/counting.math.test.ts` › Moving Target — card counting on the six-deck shoe › measures how often the cards left favour each bet, and the spread a counter needs |
| `exact.json` | `packages/engine/src/games/moving-target/moving-target.test.ts` › Moving Target — exact math › the real game over every roll and card sequence › breaks every bet down by target, adding up to its declared figures, and finds the most a round can pay |
| `first-round.json` | `packages/engine/src/games/moving-target/finite-shoe.test.ts` › Moving Target — the first round of a fresh six-deck shoe, exactly › measures every bet, and Exact Hit by target, on the first round of a fresh shoe |
| `infinite-shoe.json` | `packages/engine/src/games/moving-target/moving-target.math.test.ts` › Moving Target — Monte Carlo against the declared figures (infinite shoe) › lands every bet within ±0.15 pp of its declared RTP |
| `six-deck-shoe.json` | `packages/engine/src/games/moving-target/six-deck.math.test.ts` › Moving Target — the six-deck shoe against the declared (infinite-shoe) figures › shifts no edge by more than a quarter of a point, and reports each shift |
