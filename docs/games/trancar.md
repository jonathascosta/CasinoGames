# Trancar

_“Lock it in”_ · original table game · **status: rules in design**

## Summary

The player rolls two dice; the dealer deals cards from a shoe. The rules, bets
and paytable of Trancar are being designed and will ship in a later iteration of
the demo, together with its math verification.

## Rules

Not published yet.

## Bets and paytable

<!-- math:start -->

<!-- prettier-ignore-start -->

<!-- Generated from mathSummary() of trancar by pnpm docs:sheets. Do not edit by hand. -->

| Bet | RTP | House edge | Hit frequency | Max exposure | Volatility index | Limits |
| :-- | --: | --: | --: | --: | --: | --: |
| Trancar (main) | 95.93% | 4.07% | 56.85% | 1× | 1.034 | 0.50 – 250.00 |

RTP and house edge are per unit staked, pushes included. Hit frequency is the chance that a bet wins in a round. Max exposure is the largest net win per unit staked. The volatility index is the standard deviation of the net result per unit staked. The figures assume the strategy below, and count any fee paid for a choice against the return: a fee is never returned, and it is not a stake.

On the table's 6-deck shoe, every round returns exactly:

| Bet | Hit frequency | RTP | House edge | Edge vs declared |
| :-- | --: | --: | --: | --: |
| Trancar | 56.87% | 95.97% | 4.03% | −0.04 pp |

### Trancar (main bet)

Wins 1 to 1 when your dice add up to more than the dealer's two cards; a tie loses. After the roll you may lock one die and roll the other once more, for 40% of the bet, taken at once and never returned (a roll of 1-1 re-rolls for free).

| Outcome | Pays | Probability |
| :-- | --: | --: |
| Dice beat the dealer's cards | 1 to 1 | 56.854% |

### Strategy

After the roll: Ficar (stand), or Trancar (lock one die and roll the other once more) for 40% of the bet, taken at once and never returned; a roll of 1-1 re-rolls for free. A re-roll is always worth more with the higher die locked. The reference strategy re-rolls on 1-1, 2-1, 3-1, 4-1, 5-1, 6-1, 3-2, 4-2, 5-2 and stands on the other 12 rolls.

| Roll | Chance | Ficar | Trancar | Play |
| :-- | --: | --: | --: | :-- |
| 1-1 | 2.78% | −1.000 | **−0.676** | Lock a 1, re-roll the other (free) |
| 2-1 | 5.56% | −0.944 | **−0.881** | Lock the 2, re-roll the 1 |
| 3-1 | 5.56% | −0.833 | **−0.650** | Lock the 3, re-roll the 1 |
| 4-1 | 5.56% | −0.667 | **−0.400** | Lock the 4, re-roll the 1 |
| 5-1 | 5.56% | −0.444 | **−0.150** | Lock the 5, re-roll the 1 |
| 6-1 | 5.56% | −0.167 | **+0.081** | Lock the 6, re-roll the 1 |
| 2-2 | 2.78% | **−0.833** | −0.881 | Ficar |
| 3-2 | 5.56% | −0.667 | **−0.650** | Lock the 3, re-roll the 2 |
| 4-2 | 5.56% | −0.444 | **−0.400** | Lock the 4, re-roll the 2 |
| 5-2 | 5.56% | −0.167 | **−0.150** | Lock the 5, re-roll the 2 |
| 6-2 | 5.56% | **+0.167** | +0.081 | Ficar |
| 3-3 | 2.78% | **−0.444** | −0.650 | Ficar |
| 4-3 | 5.56% | **−0.167** | −0.400 | Ficar |
| 5-3 | 5.56% | **+0.167** | −0.150 | Ficar |
| 6-3 | 5.56% | **+0.444** | +0.081 | Ficar |
| 4-4 | 2.78% | **+0.167** | −0.400 | Ficar |
| 5-4 | 5.56% | **+0.444** | −0.150 | Ficar |
| 6-4 | 5.56% | **+0.667** | +0.081 | Ficar |
| 5-5 | 2.78% | **+0.667** | −0.150 | Ficar |
| 6-5 | 5.56% | **+0.833** | +0.081 | Ficar |
| 6-6 | 2.78% | **+0.944** | +0.081 | Ficar |

Each value is the expected net result per unit of the main bet, the fee included (Trancar locks the higher die). The best choice is in bold: it is the strategy the declared figures assume.

### What the strategy returns

| Figure | These rules | Without the free 1-1 | These rules, 6-deck shoe |
| :-- | --: | --: | --: |
| RTP | 95.93% | 95.03% | 95.97% |
| House edge | 4.07% | 4.97% | 4.03% |
| Element of risk | 3.45% | 4.22% | 3.42% |
| Win frequency | 56.85% | 56.40% | 56.87% |
| Trancar, share of rounds | 47.22% | 44.44% | 47.22% |
| Fee paid, share of rounds | 44.44% | 44.44% | 44.44% |
| Average fee per round | 17.78% of the bet | 17.78% of the bet | 17.78% of the bet |
| Volatility index | 1.034 | 1.034 | 1.034 |

The house edge is the loss per unit of the main bet, fees included. The element of risk divides the same loss by everything the player pays: the bet and the fees.

<!-- prettier-ignore-end -->

<!-- math:end -->

## Mathematics

Every declared RTP will be proven twice before release:

- **Exact**: the real game code is run over every possible draw of the dice and
  of an infinite shoe, and the declared RTP must equal the enumerated value
  exactly (as a fraction).
- **Monte Carlo**: a seeded simulation of at least 2,000,000 rounds (more for
  volatile bets) must land within ±0.15 percentage points of the declared RTP.

Method and conventions: `docs/MATH.md`.
