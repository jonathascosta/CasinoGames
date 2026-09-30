# Alvo Móvel

_“Moving target”_ · original table game · **status: rules in design**

## Summary

The player rolls two dice; the dealer deals cards from a shoe. The rules, bets
and paytable of Alvo Móvel are being designed and will ship in a later iteration of
the demo, together with its math verification.

## Rules

Not published yet.

## Bets and paytable

<!-- math:start -->

<!-- prettier-ignore-start -->

<!-- Generated from mathSummary() of alvo-movel by pnpm docs:sheets. Do not edit by hand. -->

| Bet | RTP | House edge | Hit frequency | Max exposure | Volatility index | Limits |
| :-- | --: | --: | --: | --: | --: | --: |
| Acerta (main) | 96.15% | 3.85% | 17.30% | 7.5× | 2.148 | 0.50 – 250.00 |
| Primeira Carta (side) | 91.67% | 8.33% | 9.17% | 9× | 2.886 | 0.50 – 25.00 |
| Três ou Mais (side) | 89.58% | 10.42% | 17.92% | 4× | 1.917 | 0.50 – 25.00 |

RTP and house edge are per unit staked, pushes included. Hit frequency is the chance that a bet wins in a round. Max exposure is the largest net win per unit staked. The volatility index is the standard deviation of the net result per unit staked.

### Acerta (main bet)

Wins when the dealer's total lands exactly on the target (the sum of the dice), at odds set by the target.

| Target | Chance | Pays | Hit frequency | House edge |
| :-- | --: | --: | --: | --: |
| 2 | 2.78% | 15 to 2 | 11.00% | 6.50% |
| 3 | 5.56% | 7 to 1 | 12.10% | 3.20% |
| 4 | 8.33% | 6 to 1 | 13.31% | 6.83% |
| 5 | 11.11% | 11 to 2 | 14.64% | 4.83% |
| 6 | 13.89% | 5 to 1 | 16.11% | 3.37% |
| 7 | 16.67% | 9 to 2 | 17.72% | 2.56% |
| 8 | 13.89% | 4 to 1 | 19.49% | 2.56% |
| 9 | 11.11% | 7 to 2 | 21.44% | 3.54% |
| 10 | 8.33% | 3 to 1 | 23.58% | 5.68% |
| 11 | 5.56% | 5 to 1 | 15.94% | 4.38% |
| 12 | 2.78% | 5 to 1 | 16.53% | 0.81% |

Chance is the share of rounds with each target; the hit frequency and house edge are for the rounds with that target.

### Primeira Carta (side bet)

Wins when the first card alone is the target. A target of 11 or 12 cannot win.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| The first card is the target | 9 to 1 | 9.167% |

### Três ou Mais (side bet)

Wins when the dealer needs three cards or more to reach the target.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| Three cards or more | 4 to 1 | 17.917% |

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
