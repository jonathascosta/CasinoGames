# Entre Dados

_“Between the dice”_ · original table game · **status: rules in design**

## Summary

The player rolls two dice; the dealer deals cards from a shoe. The rules, bets
and paytable of Entre Dados are being designed and will ship in a later iteration of
the demo, together with its math verification.

## Rules

Not published yet.

## Bets and paytable

<!-- math:start -->

<!-- prettier-ignore-start -->

<!-- Generated from mathSummary() of entre-dados by pnpm docs:sheets. Do not edit by hand. -->

| Bet | RTP | House edge | Hit frequency | Push | Max exposure | Volatility index | Limits |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| Entre (main) | 96.30% | 3.70% | 18.52% | 44.44% | 4× | 1.117 | 0.50 – 250.00 |
| Exato (side) | 91.67% | 8.33% | 30.56% | — | 2× | 1.382 | 0.50 – 25.00 |
| Olho de Boi (side) | 85.19% | 14.81% | 3.70% | — | 22× | 4.344 | 0.50 – 25.00 |
| Dobros (side) | 83.33% | 16.67% | 16.67% | — | 4× | 1.863 | 0.50 – 25.00 |
| Triplo (side) | 86.11% | 13.89% | 2.78% | — | 30× | 5.094 | 0.50 – 25.00 |

RTP and house edge are per unit staked, pushes included. Hit frequency is the chance that a bet wins in a round. Push is the chance that the stake is simply returned. Max exposure is the largest net win per unit staked. The volatility index is the standard deviation of the net result per unit staked.

### Entre (main bet)

Wins when the card falls strictly between the two dice, at odds set by the spread (high die minus low die). A pair or dice one apart push.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| Spread 2, card between | 4 to 1 | 3.704% |
| Spread 3, card between | 2 to 1 | 5.556% |
| Spread 4, card between | 1 to 1 | 5.556% |
| Spread 5, card between | 1 to 2 | 3.704% |
| Spread 1, or a pair | Push | 44.444% |

### Exato (side bet)

Wins when the card equals either die.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| Card matches a die | 2 to 1 | 30.556% |

### Olho de Boi (side bet)

Bull's eye: wins when the dice are two apart and the card is the value between.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| Spread 2, card is the middle value | 22 to 1 | 3.704% |

### Dobros (side bet)

Wins when the dice show a pair.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| The dice are a pair | 4 to 1 | 16.667% |

### Triplo (side bet)

Wins when the dice show a pair and the card matches it.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| A pair, and the card matches it | 30 to 1 | 2.778% |

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
