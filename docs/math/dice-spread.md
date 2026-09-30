# Dice Spread — Math Report

_Will the card land between your dice?_

## 1. Cover

| Game | Dice Spread, an original table game of the Roll & Deal family |
| :-- | :-- |
| Version | 0.1.0 |
| Document | Math Report, revision 3 |
| Date | 2026-09-30 |
| Author | Jonathas Costa |
| Code | commit `47bab22a941c983cd3e18fd6989ebb7a1e6479b5` (2026-09-30): the last change to the engine, its tests or their recorded results |
| Figures | `docs/results.json`, written with this report by `tools/generate-docs.ts` |
| Companion | Rules of Play (`docs/rules/dice-spread.md`) |

**Revision history**

| Revision | Date | Author | Change |
| :-- | :-- | :-- | :-- |
| 1 | 2026-09-30 | Jonathas Costa | First game sheet: rules, declared math, exact and Monte Carlo tests. Card counting exposure measured. |
| 2 | 2026-09-30 | Jonathas Costa | Renamed from its working title, with English names for the game and its bets. |
| 3 | 2026-09-30 | Jonathas Costa | Reformatted for submission as two documents, Rules of Play and Math Report, generated from the code with every figure traced to the engine or to a test; card counting measured on every game. |

**How to read this report.** Every figure is read from `docs/results.json`, which the generator
builds from the game's `mathSummary()` (the declared figures) and from the figures its tests record
(`packages/engine/src/games/dice-spread/results/`); the generator fails if a document holds a number
that is not in it. Each table names the test that reproduces it, as file › suite › test: `pnpm test`
runs the exact tests and `pnpm test:math` the simulations, and each fails if it no longer reproduces
its recorded figures. Returns are per unit staked, the stake included; exact figures are fractions,
rounded percentages beside them.

## 2. Summary

| Wager | RTP | House edge | Hit frequency | Push frequency | SD per unit | Max payout | Max exposure at max bet |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| Between (main) | 96.2963% | 3.7037% | 18.5185% | 44.4444% | 1.1174 | 4× | 1,000.00 (on 250.00) |
| Match (side) | 91.6667% | 8.3333% | 30.5556% | — | 1.3819 | 2× | 50.00 (on 25.00) |
| Bullseye (side) | 85.1852% | 14.8148% | 3.7037% | — | 4.3436 | 22× | 550.00 (on 25.00) |
| Doubles (side) | 83.3333% | 16.6667% | 16.6667% | — | 1.8634 | 4× | 100.00 (on 25.00) |
| Triple (side) | 86.1111% | 13.8889% | 2.7778% | — | 5.0944 | 30× | 750.00 (on 25.00) |

- **RTP** and **house edge** are per unit staked, pushes included. **Hit frequency** is the chance
  that the wager wins in a round; **push frequency**, that the stake is simply returned. **SD per
  unit** is the standard deviation of the net result per unit staked.
- **Max payout** is the largest net win per unit staked, the stake being returned on top. **Max
  exposure at max bet** is the most a single wager at its maximum can win in a round, found by
  running the real game over every outcome at the table maximums; all the wagers of one position
  together can win at most 1,475.00 in a round.

_Reproduced by `packages/engine/src/games/dice-spread/dice-spread.test.ts` › Dice Spread — the
figures of the Math Report › adds up each bet's outcomes to its declared figures, and finds the most
a round can pay._ The declared figures are `mathSummary()` (bets.ts); the test holds them equal to
the enumeration.

## 3. Game model

- **Sample space.** Ω = D × C. D is the ordered pair of dice (d₁, d₂), each uniform on 1 to 6: 36
  equally likely rolls. C is the value c of the one card, uniform on 1 to 6. |Ω| = 216 equally
  likely outcomes; with the card's suit as well, 864, which the exact test also enumerates and which
  gives the same fractions. Write L and H for the lower and higher die and S = H − L for the spread.
- **Card supply.** The declared figures take the card uniform over its 6 values, independent of the
  dice: an infinite shoe. That is also exactly what the table's 6-deck shoe returns in the long run
  to a player who bets the same way every round: each round deals one card and the cut card always
  comes out after 108 cards, so the rounds a shoe deals never depend on the cards, and over all
  shuffles the card of any given round is uniform over the values (section six confirms it by
  simulation).
- **Decisions.** None: every wager is settled by the roll and the card.

## 4. Per-wager analysis

### 4.1 Between (main)

**Wins** when S ≥ 2 and L < c < H, paid by S; a push when S < 2. **Method:** exact enumeration of
the production game over Ω.

| Outcome | Probability | Exactly | Pays | Returns per unit | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: |
| Spread 2, card between | 3.7037% | 1/27 | 4 to 1 | 5 | 5/27 |
| Spread 3, card between | 5.5556% | 1/18 | 2 to 1 | 3 | 1/6 |
| Spread 4, card between | 5.5556% | 1/18 | 1 to 1 | 2 | 1/9 |
| Spread 5, card between | 3.7037% | 1/27 | 1 to 2 | 3/2 | 1/18 |
| Spread 1, or a pair | 44.4444% | 4/9 | push | 1 | 4/9 |
| Any other outcome | 37.0370% | 10/27 | loses | 0 | 0 |

- **Total return (RTP):** 26/27 (96.2963%), the sum of the contributions.
- **House edge:** 1/27 (3.7037%).
- **Variance** of the net result per unit staked: 3641/2916 (1.2486); **standard deviation** 1.1174.
- **Hit frequency** (the wager wins): 5/27 (18.5185%); **push frequency** 4/9 (44.4444%).

_Reproduced by `packages/engine/src/games/dice-spread/dice-spread.test.ts` › Dice Spread — the
figures of the Math Report › adds up each bet's outcomes to its declared figures, and finds the most
a round can pay._

### 4.2 Match (side)

**Wins** when c = d₁ or c = d₂. **Method:** exact enumeration of the production game over Ω.

| Outcome | Probability | Exactly | Pays | Returns per unit | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: |
| Card matches a die | 30.5556% | 11/36 | 2 to 1 | 3 | 11/12 |
| Any other outcome | 69.4444% | 25/36 | loses | 0 | 0 |

- **Total return (RTP):** 11/12 (91.6667%), the sum of the contributions.
- **House edge:** 1/12 (8.3333%).
- **Variance** of the net result per unit staked: 275/144 (1.9097); **standard deviation** 1.3819.
- **Hit frequency** (the wager wins): 11/36 (30.5556%).

_Reproduced by `packages/engine/src/games/dice-spread/dice-spread.test.ts` › Dice Spread — the
figures of the Math Report › adds up each bet's outcomes to its declared figures, and finds the most
a round can pay._

### 4.3 Bullseye (side)

**Wins** when S = 2 and c is the value midway between L and H. **Method:** exact enumeration of the
production game over Ω.

| Outcome | Probability | Exactly | Pays | Returns per unit | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: |
| Spread 2, card is the middle value | 3.7037% | 1/27 | 22 to 1 | 23 | 23/27 |
| Any other outcome | 96.2963% | 26/27 | loses | 0 | 0 |

- **Total return (RTP):** 23/27 (85.1852%), the sum of the contributions.
- **House edge:** 4/27 (14.8148%).
- **Variance** of the net result per unit staked: 13754/729 (18.8669); **standard deviation**
  4.3436.
- **Hit frequency** (the wager wins): 1/27 (3.7037%).

_Reproduced by `packages/engine/src/games/dice-spread/dice-spread.test.ts` › Dice Spread — the
figures of the Math Report › adds up each bet's outcomes to its declared figures, and finds the most
a round can pay._

### 4.4 Doubles (side)

**Wins** when d₁ = d₂. **Method:** exact enumeration of the production game over Ω.

| Outcome | Probability | Exactly | Pays | Returns per unit | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: |
| The dice are a pair | 16.6667% | 1/6 | 4 to 1 | 5 | 5/6 |
| Any other outcome | 83.3333% | 5/6 | loses | 0 | 0 |

- **Total return (RTP):** 5/6 (83.3333%), the sum of the contributions.
- **House edge:** 1/6 (16.6667%).
- **Variance** of the net result per unit staked: 125/36 (3.4722); **standard deviation** 1.8634.
- **Hit frequency** (the wager wins): 1/6 (16.6667%).

_Reproduced by `packages/engine/src/games/dice-spread/dice-spread.test.ts` › Dice Spread — the
figures of the Math Report › adds up each bet's outcomes to its declared figures, and finds the most
a round can pay._

### 4.5 Triple (side)

**Wins** when d₁ = d₂ = c. **Method:** exact enumeration of the production game over Ω.

| Outcome | Probability | Exactly | Pays | Returns per unit | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: |
| A pair, and the card matches it | 2.7778% | 1/36 | 30 to 1 | 31 | 31/36 |
| Any other outcome | 97.2222% | 35/36 | loses | 0 | 0 |

- **Total return (RTP):** 31/36 (86.1111%), the sum of the contributions.
- **House edge:** 5/36 (13.8889%).
- **Variance** of the net result per unit staked: 33635/1296 (25.9529); **standard deviation**
  5.0944.
- **Hit frequency** (the wager wins): 1/36 (2.7778%).

_Reproduced by `packages/engine/src/games/dice-spread/dice-spread.test.ts` › Dice Spread — the
figures of the Math Report › adds up each bet's outcomes to its declared figures, and finds the most
a round can pay._

## 5. Progressive analysis

Not applicable: Dice Spread has no progressive wager.

## 6. Finite-shoe effects

As section three shows, the 6-deck shoe at 75% penetration returns exactly the declared figures to a
flat bettor: there is no finite-shoe shift to measure, only its absence to confirm. The simulation
of section seven deals from that shoe, with its cut card and reshuffles:

| Wager | RTP, declared | RTP, six-deck shoe (observed) | Difference | Standard error |
| :-- | --: | --: | --: | --: |
| Between | 96.296% | 96.289% | −0.007 pp | 0.010 pp |
| Match | 91.667% | 91.676% | +0.009 pp | 0.012 pp |
| Bullseye | 85.185% | 85.205% | +0.020 pp | 0.039 pp |
| Doubles | 83.333% | 83.376% | +0.043 pp | 0.017 pp |
| Triple | 86.111% | 86.125% | +0.014 pp | 0.046 pp |

Every difference lies within the run's noise. _Reproduced by
`packages/engine/src/games/dice-spread/dice-spread.math.test.ts` › Dice Spread — Monte Carlo against
the real six-deck shoe › lands every bet within ±0.15 pp of its declared RTP._

## 7. Simulation verification

| Rounds | 124,852,059 |
| :-- | :-- |
| Generator | xoshiro128** 1.1 (Blackman & Vigna), its state expanded from the seed by SplitMix64; a string seed is first hashed with FNV-1a (64-bit) over its UTF-8 bytes |
| Seed | `dice-spread/monte-carlo` |
| Cards | the 6-deck shoe of 144 cards, ranks 1 to 6, with its cut card after 108 cards (penetration 75%) and reshuffles, as the production game deals it |
| Stakes | every wager at its minimum each round: Between 0.50, Match 0.50, Bullseye 0.50, Doubles 0.50 and Triple 0.50 |
| Criterion | each RTP within ±0.15 pp of the declared figure, and each hit and push frequency within 3.29 binomial standard errors; the round count makes ±0.15 pp equal to 3.29 standard errors for the most volatile wager |

| Figure | Observed | Expected | Difference | Standard error | 95% confidence interval | Allowed | Result |
| :-- | --: | --: | --: | --: | --: | --: | :-- |
| Between, RTP | 96.289% | 96.296% | −0.007 pp | 0.010 pp | 96.270% to 96.309% | ±0.150 pp | **pass** |
| Between, hit frequency | 18.515% | 18.519% | −0.004 pp | 0.003 pp | 18.508% to 18.522% | ±0.011 pp | **pass** |
| Between, push frequency | 44.446% | 44.444% | +0.002 pp | 0.004 pp | 44.437% to 44.455% | ±0.015 pp | **pass** |
| Match, RTP | 91.676% | 91.667% | +0.009 pp | 0.012 pp | 91.652% to 91.700% | ±0.150 pp | **pass** |
| Match, hit frequency | 30.559% | 30.556% | +0.003 pp | 0.004 pp | 30.551% to 30.567% | ±0.014 pp | **pass** |
| Bullseye, RTP | 85.205% | 85.185% | +0.020 pp | 0.039 pp | 85.129% to 85.281% | ±0.150 pp | **pass** |
| Bullseye, hit frequency | 3.705% | 3.704% | +0.001 pp | 0.002 pp | 3.701% to 3.708% | ±0.006 pp | **pass** |
| Doubles, RTP | 83.376% | 83.333% | +0.043 pp | 0.017 pp | 83.344% to 83.409% | ±0.150 pp | **pass** |
| Doubles, hit frequency | 16.675% | 16.667% | +0.009 pp | 0.003 pp | 16.669% to 16.682% | ±0.011 pp | **pass** |
| Triple, RTP | 86.125% | 86.111% | +0.014 pp | 0.046 pp | 86.035% to 86.214% | ±0.150 pp | **pass** |
| Triple, hit frequency | 2.778% | 2.778% | 0.000 pp | 0.001 pp | 2.775% to 2.781% | ±0.005 pp | **pass** |

The 95% confidence interval is the observed value ± 1.96 standard errors, and at that level about
one figure in twenty falls outside its interval by chance. The tests' own criterion, "Allowed"
above, is wider: 3.29 standard errors, or a fixed tolerance. _Reproduced by
`packages/engine/src/games/dice-spread/dice-spread.math.test.ts` › Dice Spread — Monte Carlo against
the real six-deck shoe › lands every bet within ±0.15 pp of its declared RTP._

## 8. Assumptions and limitations

**Independence.** The dice and the cards are independent: the RNG draws each die and each card
separately (a live table uses separate devices), and nothing about the dice changes the shoe. Within
a round the cards are dealt from one shoe, which the finite-shoe figures account for.

**Card counting.** A player who tracks the cards dealt knows the shoe's composition before every
round. Between's value depends on it: over the 36 rolls, one unit is worth, by the card's value:

| Card value | Between, expected net | Bullseye, expected net |
| :-- | --: | --: |
| 1 | −0.5556 | −1.0000 |
| 2 | +0.0833 | +0.2778 |
| 3 | +0.3611 | +0.2778 |
| 4 | +0.3611 | +0.2778 |
| 5 | +0.0833 | +0.2778 |
| 6 | −0.5556 | −1.0000 |

The other wagers are worth the same whatever the card, so they cannot be counted. The exposure,
computed exactly for a player who knows the composition before every round (a hypergeometric model
of the shoe, no simulation):

| Penetration | Rounds per shoe | Between: rounds favouring the counter | Counter’s edge in them | Break-even bet spread | Bullseye: rounds favouring the counter |
| :-- | --: | --: | --: | --: | --: |
| 75% (the table) | 108 | 8.57% | 2.05% | 1 to 22.1 | 0.47% |
| 50% | 72 | 3.66% | 1.18% | 1 to 86.7 | 0.01% |
| 25% | 36 | 0.47% | 0.59% | 1 to 1,329.0 | 0.00% |

The table's limits allow a spread of 1 to 500 on Between, so at the table's penetration a skilled
counter could beat it wherever the cards are visible. A live table should shuffle after every round,
use a continuous shuffling machine, or cut the penetration well below the table's; an RNG table that
reshuffles every round returns exactly the declared figures. _Reproduced by
`packages/engine/src/games/dice-spread/counting.test.ts` › Dice Spread — card counting exposure ›
measures the countable bets at 75%, 50% and 25% penetration, against the spread the limits allow._

**Rounding.** Winnings are paid to the cent, rounded down (the engine's `winnings()`); the declared
figures assume exact pays. Every odds in these games has a denominator of one or two, so a wager in
multiples of the minimum pays exactly and the rounding never applies at the table's stakes.

**No player or dealer error** is modelled, nor any irregularity: the figures are those of the rules
as the engine settles them.

**Randomness.** The analysis assumes a certified RNG: every die face and every card position equally
likely and independent. The engine draws integers by rejection sampling, without modulo bias, and
shuffles by Fisher–Yates in a specified order.

## 9. Appendix

**Full enumeration.** Every distinct roll (the higher die first; "ways" counts the ordered rolls
that show it) against every card value, with its probability and each wager's net result per unit
staked (Between's push is 0). Each column, weighted by the probabilities, adds up to the wager's
RTP; the test checks it.

| Dice | Ways | Card | Probability | Between | Match | Bullseye | Doubles | Triple |
| :-- | --: | --: | --: | --: | --: | --: | --: | --: |
| 1-1 | 1 | 1 | 1/216 | 0 | 2 | −1 | 4 | 30 |
| 1-1 | 1 | 2 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 1-1 | 1 | 3 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 1-1 | 1 | 4 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 1-1 | 1 | 5 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 1-1 | 1 | 6 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 2-1 | 2 | 1 | 1/108 | 0 | 2 | −1 | −1 | −1 |
| 2-1 | 2 | 2 | 1/108 | 0 | 2 | −1 | −1 | −1 |
| 2-1 | 2 | 3 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 2-1 | 2 | 4 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 2-1 | 2 | 5 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 2-1 | 2 | 6 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 3-1 | 2 | 1 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 3-1 | 2 | 2 | 1/108 | 4 | −1 | 22 | −1 | −1 |
| 3-1 | 2 | 3 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 3-1 | 2 | 4 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 3-1 | 2 | 5 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 3-1 | 2 | 6 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 4-1 | 2 | 1 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 4-1 | 2 | 2 | 1/108 | 2 | −1 | −1 | −1 | −1 |
| 4-1 | 2 | 3 | 1/108 | 2 | −1 | −1 | −1 | −1 |
| 4-1 | 2 | 4 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 4-1 | 2 | 5 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 4-1 | 2 | 6 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 5-1 | 2 | 1 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 5-1 | 2 | 2 | 1/108 | 1 | −1 | −1 | −1 | −1 |
| 5-1 | 2 | 3 | 1/108 | 1 | −1 | −1 | −1 | −1 |
| 5-1 | 2 | 4 | 1/108 | 1 | −1 | −1 | −1 | −1 |
| 5-1 | 2 | 5 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 5-1 | 2 | 6 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 6-1 | 2 | 1 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 6-1 | 2 | 2 | 1/108 | 1/2 | −1 | −1 | −1 | −1 |
| 6-1 | 2 | 3 | 1/108 | 1/2 | −1 | −1 | −1 | −1 |
| 6-1 | 2 | 4 | 1/108 | 1/2 | −1 | −1 | −1 | −1 |
| 6-1 | 2 | 5 | 1/108 | 1/2 | −1 | −1 | −1 | −1 |
| 6-1 | 2 | 6 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 2-2 | 1 | 1 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 2-2 | 1 | 2 | 1/216 | 0 | 2 | −1 | 4 | 30 |
| 2-2 | 1 | 3 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 2-2 | 1 | 4 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 2-2 | 1 | 5 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 2-2 | 1 | 6 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 3-2 | 2 | 1 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 3-2 | 2 | 2 | 1/108 | 0 | 2 | −1 | −1 | −1 |
| 3-2 | 2 | 3 | 1/108 | 0 | 2 | −1 | −1 | −1 |
| 3-2 | 2 | 4 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 3-2 | 2 | 5 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 3-2 | 2 | 6 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 4-2 | 2 | 1 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 4-2 | 2 | 2 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 4-2 | 2 | 3 | 1/108 | 4 | −1 | 22 | −1 | −1 |
| 4-2 | 2 | 4 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 4-2 | 2 | 5 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 4-2 | 2 | 6 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 5-2 | 2 | 1 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 5-2 | 2 | 2 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 5-2 | 2 | 3 | 1/108 | 2 | −1 | −1 | −1 | −1 |
| 5-2 | 2 | 4 | 1/108 | 2 | −1 | −1 | −1 | −1 |
| 5-2 | 2 | 5 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 5-2 | 2 | 6 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 6-2 | 2 | 1 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 6-2 | 2 | 2 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 6-2 | 2 | 3 | 1/108 | 1 | −1 | −1 | −1 | −1 |
| 6-2 | 2 | 4 | 1/108 | 1 | −1 | −1 | −1 | −1 |
| 6-2 | 2 | 5 | 1/108 | 1 | −1 | −1 | −1 | −1 |
| 6-2 | 2 | 6 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 3-3 | 1 | 1 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 3-3 | 1 | 2 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 3-3 | 1 | 3 | 1/216 | 0 | 2 | −1 | 4 | 30 |
| 3-3 | 1 | 4 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 3-3 | 1 | 5 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 3-3 | 1 | 6 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 4-3 | 2 | 1 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 4-3 | 2 | 2 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 4-3 | 2 | 3 | 1/108 | 0 | 2 | −1 | −1 | −1 |
| 4-3 | 2 | 4 | 1/108 | 0 | 2 | −1 | −1 | −1 |
| 4-3 | 2 | 5 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 4-3 | 2 | 6 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 5-3 | 2 | 1 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 5-3 | 2 | 2 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 5-3 | 2 | 3 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 5-3 | 2 | 4 | 1/108 | 4 | −1 | 22 | −1 | −1 |
| 5-3 | 2 | 5 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 5-3 | 2 | 6 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 6-3 | 2 | 1 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 6-3 | 2 | 2 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 6-3 | 2 | 3 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 6-3 | 2 | 4 | 1/108 | 2 | −1 | −1 | −1 | −1 |
| 6-3 | 2 | 5 | 1/108 | 2 | −1 | −1 | −1 | −1 |
| 6-3 | 2 | 6 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 4-4 | 1 | 1 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 4-4 | 1 | 2 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 4-4 | 1 | 3 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 4-4 | 1 | 4 | 1/216 | 0 | 2 | −1 | 4 | 30 |
| 4-4 | 1 | 5 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 4-4 | 1 | 6 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 5-4 | 2 | 1 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 5-4 | 2 | 2 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 5-4 | 2 | 3 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 5-4 | 2 | 4 | 1/108 | 0 | 2 | −1 | −1 | −1 |
| 5-4 | 2 | 5 | 1/108 | 0 | 2 | −1 | −1 | −1 |
| 5-4 | 2 | 6 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 6-4 | 2 | 1 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 6-4 | 2 | 2 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 6-4 | 2 | 3 | 1/108 | −1 | −1 | −1 | −1 | −1 |
| 6-4 | 2 | 4 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 6-4 | 2 | 5 | 1/108 | 4 | −1 | 22 | −1 | −1 |
| 6-4 | 2 | 6 | 1/108 | −1 | 2 | −1 | −1 | −1 |
| 5-5 | 1 | 1 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 5-5 | 1 | 2 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 5-5 | 1 | 3 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 5-5 | 1 | 4 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 5-5 | 1 | 5 | 1/216 | 0 | 2 | −1 | 4 | 30 |
| 5-5 | 1 | 6 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 6-5 | 2 | 1 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 6-5 | 2 | 2 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 6-5 | 2 | 3 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 6-5 | 2 | 4 | 1/108 | 0 | −1 | −1 | −1 | −1 |
| 6-5 | 2 | 5 | 1/108 | 0 | 2 | −1 | −1 | −1 |
| 6-5 | 2 | 6 | 1/108 | 0 | 2 | −1 | −1 | −1 |
| 6-6 | 1 | 1 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 6-6 | 1 | 2 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 6-6 | 1 | 3 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 6-6 | 1 | 4 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 6-6 | 1 | 5 | 1/216 | 0 | −1 | −1 | 4 | −1 |
| 6-6 | 1 | 6 | 1/216 | 0 | 2 | −1 | 4 | 30 |

_Reproduced by `packages/engine/src/games/dice-spread/dice-spread.test.ts` › Dice Spread — the
figures of the Math Report › settles every roll and card as the rules state: the enumeration adds up
to every RTP._

**Records.** The tests recorded these figures (`packages/engine/src/games/dice-spread/results/`):

| Record | Test |
| :-- | :-- |
| `counting.json` | `packages/engine/src/games/dice-spread/counting.test.ts` › Dice Spread — card counting exposure › measures the countable bets at 75%, 50% and 25% penetration, against the spread the limits allow |
| `enumeration.json` | `packages/engine/src/games/dice-spread/dice-spread.test.ts` › Dice Spread — the figures of the Math Report › settles every roll and card as the rules state: the enumeration adds up to every RTP |
| `exact.json` | `packages/engine/src/games/dice-spread/dice-spread.test.ts` › Dice Spread — the figures of the Math Report › adds up each bet's outcomes to its declared figures, and finds the most a round can pay |
| `monte-carlo.json` | `packages/engine/src/games/dice-spread/dice-spread.math.test.ts` › Dice Spread — Monte Carlo against the real six-deck shoe › lands every bet within ±0.15 pp of its declared RTP |
