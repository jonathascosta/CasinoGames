# Mirror — Math Report

_Your dice against the dealer's cards, hand for hand._

## 1. Cover

| Game | Mirror, an original table game of the Roll & Deal family |
| :-- | :-- |
| Version | 0.1.0 |
| Document | Math Report, revision 3 |
| Date | 2026-09-30 |
| Author | Jonathas Costa |
| Code | commit `47bab22a941c983cd3e18fd6989ebb7a1e6479b5` (2026-09-30): the last change to the engine, its tests or their recorded results |
| Figures | `docs/results.json`, written with this report by `tools/generate-docs.ts` |
| Companion | Rules of Play (`docs/rules/mirror.md`) |

**Revision history**

| Revision | Date | Author | Change |
| :-- | :-- | :-- | :-- |
| 1 | 2026-09-30 | Jonathas Costa | First game sheet: rules, declared math, exact and Monte Carlo tests. The progressive meter's economics and card counting measured. |
| 2 | 2026-09-30 | Jonathas Costa | Renamed from its working title, with English names for the game and its bets. The progressive bet is Double Sixes. |
| 3 | 2026-09-30 | Jonathas Costa | Reformatted for submission as two documents, Rules of Play and Math Report, generated from the code with every figure traced to the engine or to a test; card counting measured on every game. |

**How to read this report.** Every figure is read from `docs/results.json`, which the generator
builds from the game's `mathSummary()` (the declared figures) and from the figures its tests record
(`packages/engine/src/games/mirror/results/`); the generator fails if a document holds a number that
is not in it. Each table names the test that reproduces it, as file › suite › test: `pnpm test` runs
the exact tests and `pnpm test:math` the simulations, and each fails if it no longer reproduces its
recorded figures. Returns are per unit staked, the stake included; exact figures are fractions,
rounded percentages beside them.

## 2. Summary

| Wager | RTP | House edge | Hit frequency | SD per unit | Max payout | Max exposure at max bet |
| :-- | --: | --: | --: | --: | --: | --: |
| Mirror (main) | 94.9074% | 5.0926% | 47.4537% | 0.9987 | 1× | 250.00 (on 250.00) |
| Tie (side) | 91.6667% | 8.3333% | 5.0926% | 3.9572 | 17× | 425.00 (on 25.00) |
| Equal Sums (side) | 90.1235% | 9.8765% | 11.2654% | 2.5294 | 7× | 175.00 (on 25.00) |
| Pair vs Pair (side) | 86.1111% | 13.8889% | 2.7778% | 5.0944 | 30× | 750.00 (on 25.00) |
| Perfect Mirror (side) | 93.0556% | 6.9444% | 0.4630% | 13.6446 | 200× | 5,000.00 (on 25.00) |
| Double Sixes (side) | 87.2377% | 12.7623% | 0.0772% | 33.3482 | 1,200× at the seed | 30,000.00 (on 25.00) |

- **RTP** and **house edge** are per unit staked, pushes included. **Hit frequency** is the chance
  that the wager wins in a round. **SD per unit** is the standard deviation of the net result per
  unit staked.
- **Max payout** is the largest net win per unit staked, the stake being returned on top. **Max
  exposure at max bet** is the most a single wager at its maximum can win in a round, found by
  running the real game over every outcome at the table maximums; all the wagers of one position
  together can win at most 36,100.00 in a round.
- **Double Sixes** pays a share of the progressive meter on top of its fixed odds. Its RTP excludes
  the meter's seed, which the house funds: the fixed pays plus the contributions. Its SD per unit,
  max payout and max exposure are taken with the meter at its seed; above it they grow with the
  meter.

_Reproduced by `packages/engine/src/games/mirror/mirror.test.ts` › Mirror — the game over every draw
of the dice and an infinite shoe › adds up each bet's outcomes to its declared figures, and finds
the most a round can pay._ The declared figures are `mathSummary()` (bets.ts); the test holds them
equal to the enumeration.

## 3. Game model

- **Sample space.** Ω = D × C². D is the ordered pair of dice (d₁, d₂), uniform on 1 to 6; C² the
  ordered pair of card values (c₁, c₂). Each hand is read by its two values: a pair ranks above
  every non-pair, by its value; non-pairs rank by sum, then by the higher value, so only identical
  hands tie. The exact test enumerates 36 rolls × 576 ordered pairs of cards from one deck's 24
  cards: 20,736 outcomes.
- **Card supply.** The declared figures take the two cards independent and uniform over the values:
  an infinite shoe, as an RNG game that draws each card independently deals them. On the table's
  6-deck shoe a pair of cards is rarer (once a card is out, fewer of its value are left), and
  section six gives those figures exactly: with two cards a round and 54 rounds a shoe whatever the
  cards, the two cards of any round are a uniform draw of two cards from the full shoe.
- **Decisions.** None: every wager is settled by the two hands.

## 4. Per-wager analysis

### 4.1 Mirror (main)

**Wins** when rank(dice) > rank(cards). **Method:** exact enumeration of the production game over Ω.
The ranking is enumerated in the appendix: the dice outrank the cards with chance 205/432
(47.4537%), tie with chance 11/216 (5.0926%) and lose with chance 205/432 (47.4537%).

| Outcome | Probability | Exactly | Pays | Returns per unit | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: |
| Dice outrank the dealer's cards | 47.4537% | 205/432 | 1 to 1 | 2 | 205/216 |
| Any other outcome | 52.5463% | 227/432 | loses | 0 | 0 |

- **Total return (RTP):** 205/216 (94.9074%), the sum of the contributions.
- **House edge:** 11/216 (5.0926%).
- **Variance** of the net result per unit staked: 46535/46656 (0.9974); **standard deviation**
  0.9987.
- **Hit frequency** (the wager wins): 205/432 (47.4537%).

_Reproduced by `packages/engine/src/games/mirror/mirror.test.ts` › Mirror — the game over every draw
of the dice and an infinite shoe › adds up each bet's outcomes to its declared figures, and finds
the most a round can pay._

### 4.2 Tie (side)

**Wins** when rank(dice) = rank(cards), that is the two hands hold the same two values. **Method:**
exact enumeration of the production game over Ω.

| Outcome | Probability | Exactly | Pays | Returns per unit | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: |
| The hands rank equal | 5.0926% | 11/216 | 17 to 1 | 18 | 11/12 |
| Any other outcome | 94.9074% | 205/216 | loses | 0 | 0 |

- **Total return (RTP):** 11/12 (91.6667%), the sum of the contributions.
- **House edge:** 1/12 (8.3333%).
- **Variance** of the net result per unit staked: 2255/144 (15.6597); **standard deviation** 3.9572.
- **Hit frequency** (the wager wins): 11/216 (5.0926%).

_Reproduced by `packages/engine/src/games/mirror/mirror.test.ts` › Mirror — the game over every draw
of the dice and an infinite shoe › adds up each bet's outcomes to its declared figures, and finds
the most a round can pay._

### 4.3 Equal Sums (side)

**Wins** when d₁ + d₂ = c₁ + c₂. **Method:** exact enumeration of the production game over Ω.

| Outcome | Probability | Exactly | Pays | Returns per unit | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: |
| Same sum | 11.2654% | 73/648 | 7 to 1 | 8 | 73/81 |
| Any other outcome | 88.7346% | 575/648 | loses | 0 | 0 |

- **Total return (RTP):** 73/81 (90.1235%), the sum of the contributions.
- **House edge:** 8/81 (9.8765%).
- **Variance** of the net result per unit staked: 41975/6561 (6.3977); **standard deviation**
  2.5294.
- **Hit frequency** (the wager wins): 73/648 (11.2654%).

_Reproduced by `packages/engine/src/games/mirror/mirror.test.ts` › Mirror — the game over every draw
of the dice and an infinite shoe › adds up each bet's outcomes to its declared figures, and finds
the most a round can pay._

### 4.4 Pair vs Pair (side)

**Wins** when d₁ = d₂ and c₁ = c₂. **Method:** exact enumeration of the production game over Ω.

| Outcome | Probability | Exactly | Pays | Returns per unit | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: |
| Both hands are pairs | 2.7778% | 1/36 | 30 to 1 | 31 | 31/36 |
| Any other outcome | 97.2222% | 35/36 | loses | 0 | 0 |

- **Total return (RTP):** 31/36 (86.1111%), the sum of the contributions.
- **House edge:** 5/36 (13.8889%).
- **Variance** of the net result per unit staked: 33635/1296 (25.9529); **standard deviation**
  5.0944.
- **Hit frequency** (the wager wins): 1/36 (2.7778%).

_Reproduced by `packages/engine/src/games/mirror/mirror.test.ts` › Mirror — the game over every draw
of the dice and an infinite shoe › adds up each bet's outcomes to its declared figures, and finds
the most a round can pay._

### 4.5 Perfect Mirror (side)

**Wins** when d₁ = d₂ = c₁ = c₂. **Method:** exact enumeration of the production game over Ω.

| Outcome | Probability | Exactly | Pays | Returns per unit | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: |
| Both hands are the same pair | 0.4630% | 1/216 | 200 to 1 | 201 | 67/72 |
| Any other outcome | 99.5370% | 215/216 | loses | 0 | 0 |

- **Total return (RTP):** 67/72 (93.0556%), the sum of the contributions.
- **House edge:** 5/72 (6.9444%).
- **Variance** of the net result per unit staked: 965135/5184 (186.1757); **standard deviation**
  13.6446.
- **Hit frequency** (the wager wins): 1/216 (0.4630%).

_Reproduced by `packages/engine/src/games/mirror/mirror.test.ts` › Mirror — the game over every draw
of the dice and an infinite shoe › adds up each bet's outcomes to its declared figures, and finds
the most a round can pay._

### 4.6 Double Sixes (side, progressive)

**Wins** when d₁ = d₂ = c₁ = c₂ = 6. **Method:** exact enumeration of the production game over Ω,
with the meter at zero: the fixed pay alone.

| Outcome | Probability | Exactly | Pays | Returns per unit | Contribution to RTP |
| :-- | --: | --: | --: | --: | --: |
| Both hands are 6-6 | 0.0772% | 1/1296 | 1000 to 1 | 1001 | 1001/1296 |
| Any other outcome | 99.9228% | 1295/1296 | loses | 0 | 0 |

- **Total return (RTP):** 1001/1296 (77.2377%), the sum of the contributions.
- **House edge:** 295/1296 (22.7623%).
- **Variance** of the net result per unit staked: 1297591295/1679616 (772.5524); **standard
  deviation** 27.7948.
- **Hit frequency** (the wager wins): 1/1296 (0.0772%).

With the meter at its seed, 5,000.00, a hit pays 1,200× plus the stake per unit, and one round
returns 1201/1296 (92.6698%) with a standard deviation of 33.3482: the volatility the summary
declares. The declared RTP, 87.2377%, counts the fixed pays and the 10% of every stake the meter
pays back in the long run, the seed excluded; section five gives the meter's economics.

_Reproduced by `packages/engine/src/games/mirror/mirror.test.ts` › Mirror — the game over every draw
of the dice and an infinite shoe › adds up each bet's outcomes to its declared figures, and finds
the most a round can pay._

## 5. Progressive analysis

| Term | Value |
| :-- | :-- |
| Seed (the meter starts at it and never drops below it) | 5,000.00 |
| Contribution rate (of every stake, into the meter) | 1/10 (10%) |
| Full-share stake (a hit takes stake ÷ it of the meter) | 25.00 |
| Hit chance per round | 1/1296 (0.0772%) |
| Rounds per hit, on average | 1296 |
| Fixed-pay RTP | 1001/1296 (77.2377%) |
| Contribution RTP (paid back through the meter) | 1/10 (10%) |
| RTP excluding the seed (declared) | 5653/6480 (87.2377%) |
| RTP of one round at the seed | 1201/1296 (92.6698%) |
| RTP added per cent of meter | 1/3240000 |
| Break-even meter (one round returns all that is staked) | 7,375.00 |
| Seed cost per round, at the full-share stake | 3.86 (15.43% of the stake) |

- **The meter's rule.** Every stake on Double Sixes adds 10% of itself to the meter as the wager is
  accepted, kept to a millionth of a cent. A hit pays 1000 to 1 from the table's bank plus stake ÷
  25.00 of the meter, rounded down to the cent; the meter is decreased by the share paid and keeps
  the rest, and the house tops it back up to the seed if it fell below.
- **Return at a given meter.** A hit pays meter ÷ 25.00 per unit staked, whatever the stake, so with
  the meter at M cents one round returns 77.24% + M × 1/3240000: 92.67% at the seed, and all that is
  staked at 7,375.00, the break-even meter (8,548.91 on the 6-deck shoe).
- **The meter at a hit.** If every cycle starts at the seed, the meter at a hit averages the seed
  plus a cycle's contributions, seed + rate × mean stake ÷ hit chance: 5,064.80 at a mean stake of
  0.50, 5,129.60 at a mean stake of 1.00, 5,648.00 at a mean stake of 5.00, 6,020.60 at a mean stake
  of 7.875 and 8,240.00 at a mean stake of 25.00. With stakes below the full share a hit takes only
  part of the meter and the rest carries over, so the meter settles higher: in the simulations of
  section seven, with stakes of 0.50, 1.00, 5.00 and 25.00 in turn, it averaged 7,392.57 at a hit on
  the infinite shoe and 7,497.68 on the 6-deck shoe.
- **The seed's cost.** At the full-share stake every hit takes the whole meter and the house
  re-seeds it: 3.86 a round, 15.43% of the stake. In the mixed-stake simulations the top-ups came to
  1.00 and 0.97 a round, and the wager returned 99.69% and 96.57% with them.

_Reproduced by `packages/engine/src/games/mirror/mirror.test.ts` › Mirror — the progressive meter ›
prices the meter, and pays the worked example of the rules;
`packages/engine/src/games/mirror/mirror.math.test.ts` › Mirror — Monte Carlo on an infinite shoe
against the declared figures › lands every bet on its declared RTP and hit frequency;
`packages/engine/src/games/mirror/six-deck.math.test.ts` › Mirror — the six-deck shoe in the long
run › returns the exact six-deck figures, and reports the meter and the counting exposure._

## 6. Finite-shoe effects

On the table's 6-deck shoe the second card matches the first less often than on an infinite shoe (a
pair of cards is 23/143 as likely), which moves every wager. The exact figures come from running the
production game over every roll and every ordered pair of cards from a full shoe (30,888 outcomes);
the simulation confirms them on the real shoe, with its cut card and reshuffles.

| Wager | RTP, declared | RTP, six-deck shoe (exact) | RTP, six-deck shoe (observed) | Standard error |
| :-- | --: | --: | --: | --: |
| Mirror | 94.907% | 95.474% | 95.485% | 0.018 pp |
| Tie | 91.667% | 91.958% | 91.819% | 0.071 pp |
| Equal Sums | 90.123% | 90.287% | 90.192% | 0.045 pp |
| Pair vs Pair | 86.111% | 83.100% | 82.967% | 0.090 pp |
| Perfect Mirror | 93.056% | 89.802% | 89.287% | 0.239 pp |
| Double Sixes, fixed pays | 77.238% | 74.537% | 74.309% | 0.791 pp |
| Double Sixes, excluding the seed | 87.238% | 84.537% | 84.307% | 0.878 pp |

These six-deck figures are exact for every round, not only the first after a shuffle, and a table
that reshuffles before every round returns them too. _Reproduced by
`packages/engine/src/games/mirror/finite-shoe.test.ts` › Mirror — every round of the six-deck shoe,
exactly › records every bet on the six-deck shoe, and where the meter breaks even there;
`packages/engine/src/games/mirror/six-deck.math.test.ts` › Mirror — the six-deck shoe in the long
run › returns the exact six-deck figures, and reports the meter and the counting exposure._

## 7. Simulation verification

Both runs play every wager in every round, with Double Sixes staked at 0.50, 1.00, 5.00 and 25.00 in
turn and its meter live.

**On the infinite shoe**, against the declared figures:

| Rounds | 124,852,059 |
| :-- | :-- |
| Generator | xoshiro128** 1.1 (Blackman & Vigna), its state expanded from the seed by SplitMix64; a string seed is first hashed with FNV-1a (64-bit) over its UTF-8 bytes |
| Seed | `mirror/infinite-shoe` |
| Cards | an infinite shoe (every card drawn independently and uniformly from one deck of ranks 1 to 6 in 4 suits) |
| Stakes | Mirror 1.00, Tie 0.50, Equal Sums 0.50, Pair vs Pair 0.50 and Perfect Mirror 0.50, and Double Sixes as above |
| Criterion | each RTP within ±0.15 pp of the declared figure, or 3.29 of its own standard errors for the wagers too volatile for that within 200,000,000 rounds; each hit frequency within 3.29 binomial standard errors |

| Figure | Observed | Expected | Difference | Standard error | 95% confidence interval | Allowed | Result |
| :-- | --: | --: | --: | --: | --: | --: | :-- |
| Mirror, RTP | 94.917% | 94.907% | +0.009 pp | 0.009 pp | 94.899% to 94.934% | ±0.150 pp | **pass** |
| Tie, RTP | 91.642% | 91.667% | −0.025 pp | 0.035 pp | 91.573% to 91.712% | ±0.150 pp | **pass** |
| Equal Sums, RTP | 90.136% | 90.123% | +0.012 pp | 0.023 pp | 90.092% to 90.180% | ±0.150 pp | **pass** |
| Pair vs Pair, RTP | 86.085% | 86.111% | −0.026 pp | 0.046 pp | 85.996% to 86.175% | ±0.150 pp | **pass** |
| Perfect Mirror, RTP | 92.917% | 93.056% | −0.138 pp | 0.122 pp | 92.678% to 93.156% | ±0.402 pp | **pass** |
| Double Sixes, fixed pays | 76.984% | 77.238% | −0.253 pp | 0.402 pp | 76.196% to 77.773% | ±1.323 pp | **pass** |
| Double Sixes, excluding the seed | 86.984% | 87.238% | −0.253 pp | 0.445 pp | 86.113% to 87.856% | ±1.463 pp | **pass** |
| Mirror, hit frequency | 47.4584% | 47.4537% | +0.0047 pp | 0.0045 pp | 47.4496% to 47.4671% | ±0.0147 pp | **pass** |
| Tie, hit frequency | 5.0912% | 5.0926% | −0.0014 pp | 0.0020 pp | 5.0874% to 5.0951% | ±0.0065 pp | **pass** |
| Equal Sums, hit frequency | 11.2670% | 11.2654% | +0.0016 pp | 0.0028 pp | 11.2614% to 11.2725% | ±0.0093 pp | **pass** |
| Pair vs Pair, hit frequency | 2.7769% | 2.7778% | −0.0008 pp | 0.0015 pp | 2.7741% to 2.7798% | ±0.0048 pp | **pass** |
| Perfect Mirror, hit frequency | 0.4623% | 0.4630% | −0.0007 pp | 0.0006 pp | 0.4611% to 0.4635% | ±0.0020 pp | **pass** |
| Double Sixes, hit frequency | 0.0773% | 0.0772% | +0.0002 pp | 0.0002 pp | 0.0768% to 0.0778% | ±0.0008 pp | **pass** |

_Reproduced by `packages/engine/src/games/mirror/mirror.math.test.ts` › Mirror — Monte Carlo on an
infinite shoe against the declared figures › lands every bet on its declared RTP and hit frequency._

**On the 6-deck shoe**, against the exact six-deck figures:

| Rounds | 31,213,015 |
| :-- | :-- |
| Generator | xoshiro128** 1.1 (Blackman & Vigna), its state expanded from the seed by SplitMix64; a string seed is first hashed with FNV-1a (64-bit) over its UTF-8 bytes |
| Seed | `mirror/six-deck-shoe` |
| Cards | the 6-deck shoe of 144 cards, ranks 1 to 6, with its cut card after 108 cards (penetration 75%) and reshuffles, as the production game deals it |
| Stakes | as on the infinite shoe |
| Criterion | each figure within 3.29 of its own standard errors of the exact six-deck figure; the round count holds Pair vs Pair to ±0.3 pp |

| Figure | Observed | Expected | Difference | Standard error | 95% confidence interval | Allowed | Result |
| :-- | --: | --: | --: | --: | --: | --: | :-- |
| Mirror, RTP | 95.485% | 95.474% | +0.011 pp | 0.018 pp | 95.450% to 95.520% | ±0.059 pp | **pass** |
| Tie, RTP | 91.819% | 91.958% | −0.139 pp | 0.071 pp | 91.680% to 91.958% | ±0.233 pp | **pass** |
| Equal Sums, RTP | 90.192% | 90.287% | −0.095 pp | 0.045 pp | 90.103% to 90.281% | ±0.149 pp | **pass** |
| Pair vs Pair, RTP | 82.967% | 83.100% | −0.133 pp | 0.090 pp | 82.792% to 83.143% | ±0.295 pp | **pass** |
| Perfect Mirror, RTP | 89.287% | 89.802% | −0.515 pp | 0.239 pp | 88.818% to 89.756% | ±0.787 pp | **pass** |
| Double Sixes, fixed pays | 74.309% | 74.537% | −0.228 pp | 0.791 pp | 72.758% to 75.859% | ±2.602 pp | **pass** |
| Double Sixes, excluding the seed | 84.307% | 84.537% | −0.230 pp | 0.878 pp | 82.586% to 86.029% | ±2.890 pp | **pass** |
| Mirror, hit frequency | 47.7423% | 47.7370% | +0.0054 pp | 0.0089 pp | 47.7248% to 47.7599% | ±0.0294 pp | **pass** |
| Tie, hit frequency | 5.1011% | 5.1088% | −0.0077 pp | 0.0039 pp | 5.0933% to 5.1088% | ±0.0130 pp | **pass** |
| Equal Sums, hit frequency | 11.2740% | 11.2859% | −0.0119 pp | 0.0057 pp | 11.2629% to 11.2851% | ±0.0186 pp | **pass** |
| Pair vs Pair, hit frequency | 2.6764% | 2.6807% | −0.0043 pp | 0.0029 pp | 2.6707% to 2.6820% | ±0.0095 pp | **pass** |
| Perfect Mirror, hit frequency | 0.4442% | 0.4468% | −0.0026 pp | 0.0012 pp | 0.4419% to 0.4466% | ±0.0039 pp | **pass** |
| Double Sixes, hit frequency | 0.0740% | 0.0745% | −0.0004 pp | 0.0005 pp | 0.0731% to 0.0750% | ±0.0016 pp | **pass** |

The 95% confidence interval is the observed value ± 1.96 standard errors, and at that level about
one figure in twenty falls outside its interval by chance. The tests' own criterion, "Allowed"
above, is wider: 3.29 standard errors, or a fixed tolerance. _Reproduced by
`packages/engine/src/games/mirror/six-deck.math.test.ts` › Mirror — the six-deck shoe in the long
run › returns the exact six-deck figures, and reports the meter and the counting exposure._

## 8. Assumptions and limitations

**Independence.** The dice and the cards are independent: the RNG draws each die and each card
separately (a live table uses separate devices), and nothing about the dice changes the shoe. Within
a round the cards are dealt from one shoe, which the finite-shoe figures account for.

**Card counting.** A player who tracks the cards dealt knows the shoe's composition before every
round. The 6-deck simulation computes each wager's exact expectation for that composition, round by
round (for Double Sixes also with the meter as it stood):

| Wager | Rounds favouring a perfect counter | Counter's edge in them | Break-even bet spread |
| :-- | --: | --: | --: |
| Mirror | 10.80% | 2.8% | 1 to 16.2 |
| Tie | 0.00% | — | — |
| Equal Sums | 0.00% | 0.7% | 1 to 591,198.1 |
| Pair vs Pair | 0.06% | 3.4% | 1 to 8,457.7 |
| Perfect Mirror | 0.61% | 3.5% | 1 to 485.5 |
| Double Sixes | 11.77% | 22.8% | 1 to 10.5 |
| Double Sixes, with the meter | 41.11% | 26.3% | 1 to 1.3 |

The break-even spread is how much more a perfect counter must stake in the favourable rounds than in
the others (one unit) to break even. The main wager and Double Sixes are exposed; with the meter
above break-even much of the time, a counter needs almost no spread on Double Sixes. A table that
reshuffles before every round, as a continuous shuffler does, removes the exposure and changes no
figure of this report. _Reproduced by `packages/engine/src/games/mirror/six-deck.math.test.ts` ›
Mirror — the six-deck shoe in the long run › returns the exact six-deck figures, and reports the
meter and the counting exposure._

**Rounding.** Fixed pays are whole units per unit staked, so they are exact. A meter share is
rounded down to the cent and the rest stays in the meter, to a millionth of a cent: nothing is lost,
and the long-run return is unchanged.

**The meter** is modelled for one table with its own meter, as the demo runs it; a meter shared
across tables changes the contributions per hit, not the rules. The seed and top-ups are the
operator's cost and are excluded from the declared RTP.

**No player or dealer error** is modelled, nor any irregularity: the figures are those of the rules
as the engine settles them.

**Randomness.** The analysis assumes a certified RNG: every die face and every card position equally
likely and independent. The engine draws integers by rejection sampling, without modulo bias, and
shuffles by Fisher–Yates in a specified order.

## 9. Appendix

**The kinds of hand**, strongest first, with their chance for the dice (and for two cards from an
infinite shoe):

| Rank | Hand | Values | Chance |
| --: | :-- | :-- | --: |
| 1 | PAIR 6s | 6-6 | 1/36 |
| 2 | PAIR 5s | 5-5 | 1/36 |
| 3 | PAIR 4s | 4-4 | 1/36 |
| 4 | PAIR 3s | 3-3 | 1/36 |
| 5 | PAIR 2s | 2-2 | 1/36 |
| 6 | PAIR 1s | 1-1 | 1/36 |
| 7 | SUM 11 HIGH 6 | 6-5 | 1/18 |
| 8 | SUM 10 HIGH 6 | 6-4 | 1/18 |
| 9 | SUM 9 HIGH 6 | 6-3 | 1/18 |
| 10 | SUM 9 HIGH 5 | 5-4 | 1/18 |
| 11 | SUM 8 HIGH 6 | 6-2 | 1/18 |
| 12 | SUM 8 HIGH 5 | 5-3 | 1/18 |
| 13 | SUM 7 HIGH 6 | 6-1 | 1/18 |
| 14 | SUM 7 HIGH 5 | 5-2 | 1/18 |
| 15 | SUM 7 HIGH 4 | 4-3 | 1/18 |
| 16 | SUM 6 HIGH 5 | 5-1 | 1/18 |
| 17 | SUM 6 HIGH 4 | 4-2 | 1/18 |
| 18 | SUM 5 HIGH 4 | 4-1 | 1/18 |
| 19 | SUM 5 HIGH 3 | 3-2 | 1/18 |
| 20 | SUM 4 HIGH 3 | 3-1 | 1/18 |
| 21 | SUM 3 HIGH 2 | 2-1 | 1/18 |

**Every dice hand against every card hand.** Rows are the dice's hand and columns the cards', both
by the rank above; W marks a win for the dice (the Mirror wager wins), T a tie and a blank a loss.
The cells, weighted by the two hands' chances, give the chances of section four.

| Dice \ cards | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 |
| :-- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 1 | T | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W |
| 2 |  | T | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W |
| 3 |  |  | T | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W |
| 4 |  |  |  | T | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W |
| 5 |  |  |  |  | T | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W |
| 6 |  |  |  |  |  | T | W | W | W | W | W | W | W | W | W | W | W | W | W | W | W |
| 7 |  |  |  |  |  |  | T | W | W | W | W | W | W | W | W | W | W | W | W | W | W |
| 8 |  |  |  |  |  |  |  | T | W | W | W | W | W | W | W | W | W | W | W | W | W |
| 9 |  |  |  |  |  |  |  |  | T | W | W | W | W | W | W | W | W | W | W | W | W |
| 10 |  |  |  |  |  |  |  |  |  | T | W | W | W | W | W | W | W | W | W | W | W |
| 11 |  |  |  |  |  |  |  |  |  |  | T | W | W | W | W | W | W | W | W | W | W |
| 12 |  |  |  |  |  |  |  |  |  |  |  | T | W | W | W | W | W | W | W | W | W |
| 13 |  |  |  |  |  |  |  |  |  |  |  |  | T | W | W | W | W | W | W | W | W |
| 14 |  |  |  |  |  |  |  |  |  |  |  |  |  | T | W | W | W | W | W | W | W |
| 15 |  |  |  |  |  |  |  |  |  |  |  |  |  |  | T | W | W | W | W | W | W |
| 16 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | T | W | W | W | W | W |
| 17 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | T | W | W | W | W |
| 18 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | T | W | W | W |
| 19 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | T | W | W |
| 20 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | T | W |
| 21 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | T |

_Reproduced by `packages/engine/src/games/mirror/mirror.test.ts` › Mirror — the declared table, from
36 × 24 × 24 draws › ranks the 21 kinds of hand as the rules state, and every dice hand against
every card hand._

**Records.** The tests recorded these figures (`packages/engine/src/games/mirror/results/`):

| Record | Test |
| :-- | :-- |
| `exact.json` | `packages/engine/src/games/mirror/mirror.test.ts` › Mirror — the game over every draw of the dice and an infinite shoe › adds up each bet's outcomes to its declared figures, and finds the most a round can pay |
| `hands.json` | `packages/engine/src/games/mirror/mirror.test.ts` › Mirror — the declared table, from 36 × 24 × 24 draws › ranks the 21 kinds of hand as the rules state, and every dice hand against every card hand |
| `infinite-shoe.json` | `packages/engine/src/games/mirror/mirror.math.test.ts` › Mirror — Monte Carlo on an infinite shoe against the declared figures › lands every bet on its declared RTP and hit frequency |
| `meter.json` | `packages/engine/src/games/mirror/mirror.test.ts` › Mirror — the progressive meter › prices the meter, and pays the worked example of the rules |
| `six-deck-exact.json` | `packages/engine/src/games/mirror/finite-shoe.test.ts` › Mirror — every round of the six-deck shoe, exactly › records every bet on the six-deck shoe, and where the meter breaks even there |
| `six-deck-shoe.json` | `packages/engine/src/games/mirror/six-deck.math.test.ts` › Mirror — the six-deck shoe in the long run › returns the exact six-deck figures, and reports the meter and the counting exposure |
