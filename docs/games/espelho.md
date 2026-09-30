# Espelho

_“Mirror”_ · original table game · **status: rules in design**

## Summary

The player rolls two dice; the dealer deals cards from a shoe. The rules, bets
and paytable of Espelho are being designed and will ship in a later iteration of
the demo, together with its math verification.

## Rules

Not published yet.

## Bets and paytable

<!-- math:start -->

<!-- prettier-ignore-start -->

<!-- Generated from mathSummary() of espelho by pnpm docs:sheets. Do not edit by hand. -->

| Bet | RTP | House edge | Hit frequency | Max exposure | Volatility index | Limits |
| :-- | --: | --: | --: | --: | --: | --: |
| Espelho (main) | 94.91% | 5.09% | 47.45% | 1× | 0.999 | 0.50 – 250.00 |
| Empate (side) | 91.67% | 8.33% | 5.09% | 17× | 3.957 | 0.50 – 25.00 |
| Somas Iguais (side) | 90.12% | 9.88% | 11.27% | 7× | 2.529 | 0.50 – 25.00 |
| Par vs Par (side) | 86.11% | 13.89% | 2.78% | 30× | 5.094 | 0.50 – 25.00 |
| Espelho Perfeito (side) | 93.06% | 6.94% | 0.46% | 200× | 13.645 | 0.50 – 25.00 |
| 6-6 vs 6-6 (side) | 87.24% | 12.76% | 0.08% | — | 33.348 | 0.50 – 25.00 |

RTP and house edge are per unit staked, pushes included. Hit frequency is the chance that a bet wins in a round. Max exposure is the largest net win per unit staked. The volatility index is the standard deviation of the net result per unit staked. A progressive bet's RTP excludes the seed of its meter, which the house funds, and its volatility index is taken with the meter at the seed; its terms follow its paytable.

On the table's 6-deck shoe, every round returns exactly:

| Bet | Hit frequency | RTP | House edge | Edge vs declared |
| :-- | --: | --: | --: | --: |
| Espelho | 47.74% | 95.47% | 4.53% | −0.57 pp |
| Empate | 5.11% | 91.96% | 8.04% | −0.29 pp |
| Somas Iguais | 11.29% | 90.29% | 9.71% | −0.16 pp |
| Par vs Par | 2.68% | 83.10% | 16.90% | +3.01 pp |
| Espelho Perfeito | 0.45% | 89.80% | 10.20% | +3.25 pp |
| 6-6 vs 6-6 | 0.07% | 84.54% | 15.46% | +2.70 pp |

### Espelho (main bet)

Wins when your dice outrank the dealer's two cards. A pair beats any non-pair and a higher pair a lower one; between non-pairs the higher sum wins, then the higher value. Ties lose.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| Dice outrank the dealer's cards | 1 to 1 | 47.454% |

### Empate (side bet)

Wins when the two hands rank exactly equal: the same pair, or the same two values.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| The hands rank equal | 17 to 1 | 5.093% |

### Somas Iguais (side bet)

Wins when the dice and the cards add up to the same total.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| Same sum | 7 to 1 | 11.265% |

### Par vs Par (side bet)

Wins when both hands are pairs.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| Both hands are pairs | 30 to 1 | 2.778% |

### Espelho Perfeito (side bet)

Wins when both hands are the same pair.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| Both hands are the same pair | 200 to 1 | 0.463% |

### 6-6 vs 6-6 (side bet)

Wins when both hands are 6-6: 1000 to 1, plus a share of the progressive meter in proportion to the stake (the whole meter at the 25.00 maximum). 10% of every stake on this bet goes to the meter.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| Both hands are 6-6 | 1000 to 1 + stake ÷ 25.00 of the meter | 0.077% |

| Meter | Value |
| :-- | :-- |
| Hit chance per round | 0.0772% (1 in 1,296); 6-deck shoe: 0.0745% (1 in 1,343) |
| Fixed pays alone | 1000 to 1: RTP 77.24%, house edge 22.76%; 6-deck shoe: RTP 74.54% |
| Contribution to the meter | 10% of every stake |
| RTP excluding the seed | 87.24% (house edge 12.76%): the fixed pays plus the contributions, which the meter pays out in the long run; 6-deck shoe: 84.54% |
| Meter share of a hit | stake ÷ 25.00 of the meter (the whole meter at 25.00) |
| RTP with the meter at M | 77.24% + M ÷ 32,400.00, for any stake |
| RTP with the meter at its seed (5,000.00) | 92.67%; 6-deck shoe: 89.43% |
| Break-even meter | 7,375.00; 6-deck shoe: 8,548.91 |
| Average cycle | 1,296 rounds from hit to hit; 6-deck shoe: 1,343 rounds |
| Meter at a hit, on average | 5,000.00 + 129.6 × the mean stake: 5,064.80 at 0.50, 5,129.60 at 1.00, 5,648.00 at 5.00, 8,240.00 at 25.00 |
| Seed cost to the house | 3.86 per round at 25.00 (15.43% of the stake): a cost, not part of the RTP |
| Max exposure per round | 1000 × 25.00 + the meter: 30,000.00 with the meter at its seed, unbounded as it grows |
| Volatility index at the seed | 33.348 |

The meter at a hit is exact on average when every cycle starts at the seed, as it does at 25.00, where each hit takes the whole meter; smaller stakes leave part of it behind, so their average is a little higher.

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
