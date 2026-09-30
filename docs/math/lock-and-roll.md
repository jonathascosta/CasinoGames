# Lock & Roll — Math Report

_Lock a die, roll the other, beat the cards._

## 1. Cover

| Game | Lock & Roll, an original table game of the Roll & Deal family |
| :-- | :-- |
| Version | 0.1.0 |
| Document | Math Report, revision 3 |
| Date | 2026-09-30 |
| Author | Jonathas Costa |
| Code | commit `47bab22a941c983cd3e18fd6989ebb7a1e6479b5` (2026-09-30): the last change to the engine, its tests or their recorded results |
| Figures | `docs/results.json`, written with this report by `tools/generate-docs.ts` |
| Companion | Rules of Play (`docs/rules/lock-and-roll.md`) |

**Revision history**

| Revision | Date | Author | Change |
| :-- | :-- | :-- | :-- |
| 1 | 2026-09-30 | Jonathas Costa | First game sheet: rules, declared math, exact and Monte Carlo tests. The strategy computed by expected value; card counting measured. |
| 2 | 2026-09-30 | Jonathas Costa | Renamed from its working title, with English names for the game and its bets. The choices are Stand and Lock, and the re-roll costs the Lock fee. |
| 3 | 2026-09-30 | Jonathas Costa | Reformatted for submission as two documents, Rules of Play and Math Report, generated from the code with every figure traced to the engine or to a test; card counting measured on every game. |

**How to read this report.** Every figure is read from `docs/results.json`, which the generator
builds from the game's `mathSummary()` (the declared figures) and from the figures its tests record
(`packages/engine/src/games/lock-and-roll/results/`); the generator fails if a document holds a
number that is not in it. Each table names the test that reproduces it, as file › suite › test:
`pnpm test` runs the exact tests and `pnpm test:math` the simulations, and each fails if it no
longer reproduces its recorded figures. Returns are per unit staked, the stake included; exact
figures are fractions, rounded percentages beside them.

## 2. Summary

| Wager | RTP | House edge | Hit frequency | SD per unit | Max payout | Max exposure at max bet |
| :-- | --: | --: | --: | --: | --: | --: |
| Lock & Roll (main) | 95.9311% | 4.0689% | 56.8544% | 1.0341 | 1× | 250.00 (on 250.00) |

- **RTP** and **house edge** are per unit staked, pushes included. **Hit frequency** is the chance
  that the wager wins in a round. **SD per unit** is the standard deviation of the net result per
  unit staked.
- **Max payout** is the largest net win per unit staked, the stake being returned on top. **Max
  exposure at max bet** is the most a single wager at its maximum can win in a round, found by
  running the real game over every outcome at the table maximums; all the wagers of one position
  together can win at most 250.00 in a round.
- The figures assume the **optimal strategy** of section four, and count the Lock fee against the
  return: a fee is never returned and is not a stake, so RTP = (payouts − fees) ÷ stakes. Measured
  instead against everything the player pays, the wager and the fees, the loss is the element of
  risk, 791/22896 (3.45%).
- The most a round can cost the player is 350.00 at the maximum wager: the wager and the Lock fee.

_Reproduced by `packages/engine/src/games/lock-and-roll/lock-and-roll.test.ts` › Lock & Roll — the
declared figures, exactly, on the game › breaks the return down by decision and result, and prices
the strategies a player might follow._ The declared figures are `mathSummary()` (bets.ts); the test
holds them equal to the enumeration.

## 3. Game model

- **Sample space.** The dice (d₁, d₂) are uniform on 1 to 6: 36 rolls. The player then stands, or
  locks one die and re-rolls the other once: a face r uniform on 1 to 6 (6 outcomes). The dealer's
  two cards (c₁, c₂) follow. The wager wins when the dice's final total exceeds c₁ + c₂. The exact
  test enumerates the production game with the reference strategy over every roll, re-roll and
  ordered pair of cards from one deck's 24 cards: 69,696 outcomes.
- **Card supply.** The declared figures take the two cards independent and uniform over the values:
  an infinite shoe, as an RNG game that draws each card independently deals them. On the table's
  6-deck shoe the two cards of any round are a uniform draw of two cards from the full shoe (two
  cards a round and 54 rounds a shoe, whatever the dice and the decisions); section six gives those
  figures exactly.
- **Decision model.** After the roll the player knows the dice and chooses Stand, or Lock one die
  for the fee of 2/5 (40%) of the wager (free on 1-1). Each choice is valued by its expected net
  result per unit: standing on a total s is worth P(c₁ + c₂ < s) − P(c₁ + c₂ ≥ s), and locking a die
  of value k is worth the average over the re-rolled face of standing on k + r, less the fee. The
  **optimal strategy** takes the choice of highest value on each roll, standing when no lock is
  strictly better. The declared figures assume it; section four prices other strategies.

## 4. Per-wager analysis

### 4.1 Lock & Roll (main)

**Wins** when the final dice total exceeds c₁ + c₂; a tie loses. **Method:** exact enumeration of
the production game with the reference strategy over Ω; the strategy itself is derived by a second
test from scratch, by expected value.

The return by what the player did and how the wager ended (the fee counted in the net):

| Decision | Result | Probability | Exactly | Net per unit | Contribution to the net |
| :-- | :-- | --: | --: | --: | --: |
| Stand | wins | 34.1821% | 443/1296 | +1.00 | 443/1296 |
| Stand | loses | 18.5957% | 241/1296 | −1.00 | −241/1296 |
| Lock (fee paid) | wins | 22.2222% | 2/9 | +0.60 | 2/15 |
| Lock (fee paid) | loses | 22.2222% | 2/9 | −1.40 | −14/45 |
| Lock (free on 1-1) | wins | 0.4501% | 35/7776 | +1.00 | 35/7776 |
| Lock (free on 1-1) | loses | 2.3277% | 181/7776 | −1.00 | −181/7776 |

- **Total return (RTP):** 18649/19440 (95.9311%), the sum of the contributions.
- **House edge:** 791/19440 (4.0689%).
- **Variance** of the net result per unit staked: 16166471/15116544 (1.0695); **standard deviation**
  1.0341.
- **Hit frequency** (the wager wins): 4421/7776 (56.8544%).
- **Lock:** in 17/36 (47.22%) of rounds; the fee is paid in 4/9 (44.44%) of rounds, 8/45 (17.78%) of
  the wager on average.

_Reproduced by `packages/engine/src/games/lock-and-roll/lock-and-roll.test.ts` › Lock & Roll — the
declared figures, exactly, on the game › breaks the return down by decision and result, and prices
the strategies a player might follow._

**The decision table.** Each value is the expected net result per unit of the wager, the fee
included; the dice are listed higher first, and on a double both locks are worth the same.

| Roll | Chance | Stand | Lock the higher die | Lock the lower die | Best play | Margin |
| :-- | --: | --: | --: | --: | :-- | --: |
| 1-1 | 1/36 | −1.0000 | −0.6759 | −0.6759 | Lock either die (free) | +0.3241 |
| 2-1 | 1/18 | −0.9444 | −0.8815 | −1.0759 | Lock the higher die | +0.0630 |
| 3-1 | 1/18 | −0.8333 | −0.6500 | −1.0759 | Lock the higher die | +0.1833 |
| 4-1 | 1/18 | −0.6667 | −0.4000 | −1.0759 | Lock the higher die | +0.2667 |
| 5-1 | 1/18 | −0.4444 | −0.1500 | −1.0759 | Lock the higher die | +0.2944 |
| 6-1 | 1/18 | −0.1667 | +0.0815 | −1.0759 | Lock the higher die | +0.2481 |
| 2-2 | 1/36 | −0.8333 | −0.8815 | −0.8815 | Stand | +0.0481 |
| 3-2 | 1/18 | −0.6667 | −0.6500 | −0.8815 | Lock the higher die | +0.0167 |
| 4-2 | 1/18 | −0.4444 | −0.4000 | −0.8815 | Lock the higher die | +0.0444 |
| 5-2 | 1/18 | −0.1667 | −0.1500 | −0.8815 | Lock the higher die | +0.0167 |
| 6-2 | 1/18 | +0.1667 | +0.0815 | −0.8815 | Stand | +0.0852 |
| 3-3 | 1/36 | −0.4444 | −0.6500 | −0.6500 | Stand | +0.2056 |
| 4-3 | 1/18 | −0.1667 | −0.4000 | −0.6500 | Stand | +0.2333 |
| 5-3 | 1/18 | +0.1667 | −0.1500 | −0.6500 | Stand | +0.3167 |
| 6-3 | 1/18 | +0.4444 | +0.0815 | −0.6500 | Stand | +0.3630 |
| 4-4 | 1/36 | +0.1667 | −0.4000 | −0.4000 | Stand | +0.5667 |
| 5-4 | 1/18 | +0.4444 | −0.1500 | −0.4000 | Stand | +0.5944 |
| 6-4 | 1/18 | +0.6667 | +0.0815 | −0.4000 | Stand | +0.5852 |
| 5-5 | 1/36 | +0.6667 | −0.1500 | −0.1500 | Stand | +0.8167 |
| 6-5 | 1/18 | +0.8333 | +0.0815 | −0.1500 | Stand | +0.7519 |
| 6-6 | 1/36 | +0.9444 | +0.0815 | +0.0815 | Stand | +0.8630 |

**The optimal strategy.** Lock the higher die and re-roll the lower on 1-1, 2-1, 3-1, 4-1, 5-1, 6-1,
3-2, 4-2 and 5-2; stand on the other rolls. Locking the lower die is never best: the higher the die
kept, the better the re-roll. The closest calls are decided by 1/60 of the wager. The strategy locks
in 17/36 (47.22%) of rounds.

**With and without the free 1-1.** The free re-roll is worth 35/3888 (0.90%) of the wager to the
player. Without it, 1-1 stands (a sure loss beats paying the fee for the re-roll), the strategy
locks in 4/9 (44.44%) of rounds, and:

| Rules | RTP | House edge | Hit frequency | SD per unit |
| :-- | --: | --: | --: | --: |
| As played, 1-1 free | 18649/19440 (95.9311%) | 791/19440 (4.0689%) | 56.854% | 1.0341 |
| Without the free 1-1 | 3079/3240 (95.0309%) | 161/3240 (4.9691%) | 56.404% | 1.0338 |

**Other strategies.** The declared edge assumes optimal play; a player who plays otherwise gives the
house more:

| Strategy | RTP | House edge | Hit frequency | Average fee |
| :-- | --: | --: | --: | --: |
| Optimal (the reference strategy, declared) | 18649/19440 (95.93%) | 791/19440 (4.07%) | 56.85% | 17.78% |
| Never lock | 575/648 (88.73%) | 73/648 (11.27%) | 44.37% | 0.00% |
| Always lock the lower die (re-roll the higher every round) | 1049/3888 (26.98%) | 2839/3888 (73.02%) | 32.93% | 38.89% |
| Always lock the higher die (re-roll the lower every round) | 2827/3888 (72.71%) | 1061/3888 (27.29%) | 55.80% | 38.89% |
| Lock when the strategy does, but the lower die | 13439/19440 (69.13%) | 6001/19440 (30.87%) | 43.45% | 17.78% |

_Reproduced by `packages/engine/src/games/lock-and-roll/strategy.test.ts` › Lock & Roll — the best
choice on each of the 21 rolls, by expected value › values standing and locking either die on each
of the 21 rolls, as strategy.ts does;
`packages/engine/src/games/lock-and-roll/lock-and-roll.test.ts` › Lock & Roll — the declared
figures, exactly, on the game › breaks the return down by decision and result, and prices the
strategies a player might follow._

## 5. Progressive analysis

Not applicable: Lock & Roll has no progressive wager.

## 6. Finite-shoe effects

On the table's 6-deck shoe the second card matches the first less often, which moves the dealer's
totals toward the middle and helps the dice a little. The exact figures come from running the
production game with the reference strategy over every roll, re-roll and ordered pair of cards from
a full shoe (103,818 outcomes); the strategy is the same on both shoes, and the simulation confirms
the figure on the real shoe, with its cut card and reshuffles.

| Figure | Declared (infinite shoe) | Six-deck shoe, exact | Six-deck shoe, observed |
| :-- | --: | --: | --: |
| RTP | 18649/19440 (95.931%) | 148219/154440 (95.972%) | 95.861% ± 0.046 pp |
| House edge | 791/19440 (4.069%) | 6221/154440 (4.028%) |  |
| Hit frequency | 4421/7776 (56.854%) | 35135/61776 (56.875%) | 56.823% |
| Element of risk | 791/22896 (3.455%) | 6221/181896 (3.420%) |  |

The six-deck shoe returns +0.041 pp more than declared. _Reproduced by
`packages/engine/src/games/lock-and-roll/finite-shoe.test.ts` › Lock & Roll — every round of the
six-deck shoe, exactly › records the six-deck figures of the reference strategy;
`packages/engine/src/games/lock-and-roll/six-deck.math.test.ts` › Lock & Roll — the six-deck shoe in
the long run › returns the exact six-deck figures, and reports the counting exposure._

## 7. Simulation verification

Both runs play the production game with the reference strategy deciding every round, the same bot
the demo's autoplay uses.

**On the infinite shoe**, against the declared figures:

| Rounds | 5,144,842 |
| :-- | :-- |
| Generator | xoshiro128** 1.1 (Blackman & Vigna), its state expanded from the seed by SplitMix64; a string seed is first hashed with FNV-1a (64-bit) over its UTF-8 bytes |
| Seed | `lock-and-roll/infinite-shoe` |
| Cards | an infinite shoe (every card drawn independently and uniformly from one deck of ranks 1 to 6 in 4 suits) |
| Stakes | 1.00 a round |
| Criterion | the RTP within ±0.15 pp of the declared figure (3.29 standard errors at this round count), and each frequency within 3.29 binomial standard errors |

| Figure | Observed | Expected | Difference | Standard error | 95% confidence interval | Allowed | Result |
| :-- | --: | --: | --: | --: | --: | --: | :-- |
| RTP | 95.874% | 95.931% | −0.057 pp | 0.046 pp | 95.785% to 95.963% | ±0.150 pp | **pass** |
| Win frequency | 56.835% | 56.854% | −0.019 pp | 0.022 pp | 56.792% to 56.878% | ±0.072 pp | **pass** |
| Lock (re-rolls) | 47.270% | 47.222% | +0.048 pp | 0.022 pp | 47.227% to 47.314% | ±0.072 pp | **pass** |
| Free 1-1 re-rolls | 2.779% | 2.778% | +0.002 pp | 0.007 pp | 2.765% to 2.794% | ±0.024 pp | **pass** |
| Fee paid | 44.491% | 44.444% | +0.047 pp | 0.022 pp | 44.448% to 44.534% | ±0.072 pp | **pass** |

_Reproduced by `packages/engine/src/games/lock-and-roll/lock-and-roll.math.test.ts` › Lock & Roll —
Monte Carlo on an infinite shoe against the declared figures › lands on the declared RTP, win
frequency, re-roll and fee frequencies._

**On the 6-deck shoe**, against the exact six-deck figures:

| Rounds | 5,144,842 |
| :-- | :-- |
| Generator | xoshiro128** 1.1 (Blackman & Vigna), its state expanded from the seed by SplitMix64; a string seed is first hashed with FNV-1a (64-bit) over its UTF-8 bytes |
| Seed | `lock-and-roll/six-deck-shoe` |
| Cards | the 6-deck shoe of 144 cards, ranks 1 to 6, with its cut card after 108 cards (penetration 75%) and reshuffles, as the production game deals it |
| Stakes | 1.00 a round; 95,275 shuffles |
| Criterion | the RTP within ±0.15 pp and 3.29 standard errors of the exact six-deck figure, the win frequency within 3.29 binomial standard errors |

| Figure | Observed | Expected | Difference | Standard error | 95% confidence interval | Allowed | Result |
| :-- | --: | --: | --: | --: | --: | --: | :-- |
| RTP | 95.861% | 95.972% | −0.111 pp | 0.046 pp | 95.771% to 95.950% | ±0.150 pp | **pass** |
| Win frequency | 56.823% | 56.875% | −0.051 pp | 0.022 pp | 56.781% to 56.866% | ±0.072 pp | **pass** |

The 95% confidence interval is the observed value ± 1.96 standard errors, and at that level about
one figure in twenty falls outside its interval by chance. The tests' own criterion, "Allowed"
above, is wider: 3.29 standard errors, or a fixed tolerance. The six-deck RTP lies 2.4 standard
errors from its exact figure: outside the 95% interval, inside the test's 3.29. _Reproduced by
`packages/engine/src/games/lock-and-roll/six-deck.math.test.ts` › Lock & Roll — the six-deck shoe in
the long run › returns the exact six-deck figures, and reports the counting exposure._

## 8. Assumptions and limitations

**Independence.** The dice and the cards are independent: the RNG draws each die and each card
separately (a live table uses separate devices), and nothing about the dice changes the shoe. Within
a round the cards are dealt from one shoe, which the finite-shoe figures account for.

**Optimal play.** The declared figures assume the optimal strategy; section four gives the return of
other strategies. A player who never locks gives the house 73/648 (11.27%) instead of 791/19440
(4.07%).

**Card counting.** The cards are dealt face up, so a player who tracks them knows the shoe's
composition before every round. The 6-deck simulation computes the exact expectation for that
composition, round by round, playing the reference strategy and deciding with the count:

| Wager | Rounds favouring a perfect counter | Counter’s edge in them | Break-even bet spread |
| :-- | --: | --: | --: |
| The reference strategy | 21.07% | 4.6% | 1 to 5.1 |
| Deciding with the count | 21.09% | 4.7% | 1 to 5.0 |

The break-even spread is how much more a perfect counter must stake in the favourable rounds than in
the others (one unit) to break even. The wager is exposed at the table's penetration; adjusting the
decisions to the count adds almost nothing. A table that reshuffles before every round, as a
continuous shuffler does, removes the exposure; its figures are the six-deck figures of section six.
_Reproduced by `packages/engine/src/games/lock-and-roll/six-deck.math.test.ts` › Lock & Roll — the
six-deck shoe in the long run › returns the exact six-deck figures, and reports the counting
exposure._

**Rounding.** The wager pays even money, exactly. The Lock fee is rounded up to the cent, which only
matters on wagers that are not a multiple of 0.05; the figures assume the exact fee.

**Timing.** A player who does not decide stands (the RTP of standing on every roll is in section
four's table of strategies); no fee is taken without a decision.

**Randomness.** The analysis assumes a certified RNG: every die face and every card position equally
likely and independent. The engine draws integers by rejection sampling, without modulo bias, and
shuffles by Fisher–Yates in a specified order.

## 9. Appendix

The full enumeration of 69,696 outcomes does not fit a page; the tests hold it. The decision table
of section four, exactly:

| Roll | Stand | Lock the higher die | Lock the lower die | Margin |
| :-- | --: | --: | --: | --: |
| 1-1 | −1 | −73/108 | −73/108 | 35/108 |
| 2-1 | −17/18 | −119/135 | −581/540 | 17/270 |
| 3-1 | −5/6 | −13/20 | −581/540 | 11/60 |
| 4-1 | −2/3 | −2/5 | −581/540 | 4/15 |
| 5-1 | −4/9 | −3/20 | −581/540 | 53/180 |
| 6-1 | −1/6 | 11/135 | −581/540 | 67/270 |
| 2-2 | −5/6 | −119/135 | −119/135 | 13/270 |
| 3-2 | −2/3 | −13/20 | −119/135 | 1/60 |
| 4-2 | −4/9 | −2/5 | −119/135 | 2/45 |
| 5-2 | −1/6 | −3/20 | −119/135 | 1/60 |
| 6-2 | 1/6 | 11/135 | −119/135 | 23/270 |
| 3-3 | −4/9 | −13/20 | −13/20 | 37/180 |
| 4-3 | −1/6 | −2/5 | −13/20 | 7/30 |
| 5-3 | 1/6 | −3/20 | −13/20 | 19/60 |
| 6-3 | 4/9 | 11/135 | −13/20 | 49/135 |
| 4-4 | 1/6 | −2/5 | −2/5 | 17/30 |
| 5-4 | 4/9 | −3/20 | −2/5 | 107/180 |
| 6-4 | 2/3 | 11/135 | −2/5 | 79/135 |
| 5-5 | 2/3 | −3/20 | −3/20 | 49/60 |
| 6-5 | 5/6 | 11/135 | −3/20 | 203/270 |
| 6-6 | 17/18 | 11/135 | 11/135 | 233/270 |

_Reproduced by `packages/engine/src/games/lock-and-roll/strategy.test.ts` › Lock & Roll — the best
choice on each of the 21 rolls, by expected value › values standing and locking either die on each
of the 21 rolls, as strategy.ts does._

**Records.** The tests recorded these figures (`packages/engine/src/games/lock-and-roll/results/`):

| Record | Test |
| :-- | :-- |
| `exact.json` | `packages/engine/src/games/lock-and-roll/lock-and-roll.test.ts` › Lock & Roll — the declared figures, exactly, on the game › breaks the return down by decision and result, and prices the strategies a player might follow |
| `infinite-shoe.json` | `packages/engine/src/games/lock-and-roll/lock-and-roll.math.test.ts` › Lock & Roll — Monte Carlo on an infinite shoe against the declared figures › lands on the declared RTP, win frequency, re-roll and fee frequencies |
| `six-deck-exact.json` | `packages/engine/src/games/lock-and-roll/finite-shoe.test.ts` › Lock & Roll — every round of the six-deck shoe, exactly › records the six-deck figures of the reference strategy |
| `six-deck-shoe.json` | `packages/engine/src/games/lock-and-roll/six-deck.math.test.ts` › Lock & Roll — the six-deck shoe in the long run › returns the exact six-deck figures, and reports the counting exposure |
| `strategy.json` | `packages/engine/src/games/lock-and-roll/strategy.test.ts` › Lock & Roll — the best choice on each of the 21 rolls, by expected value › values standing and locking either die on each of the 21 rolls, as strategy.ts does |
