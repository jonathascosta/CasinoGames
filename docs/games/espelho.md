# Espelho

_“Mirror”_ · original table game · **status: playable**

## Summary

The player places bets and rolls two dice: that is the player's hand. The dealer deals two cards
from a shoe of aces to sixes: that is the dealer's hand. Both hands are read the same way, as a
pair or as a sum, and compared. The main bet, **Espelho**, wins when the dice outrank the cards.
Five side bets settle on the same two hands, one of them with a progressive meter. There are no
decisions after the bets.

## Rules

### Equipment

- Two six-sided dice, rolled by the player.
- A shoe of six decks, each with the ace to the six in four suits (24 cards): 144 cards. The ace
  counts 1 and every other card its number; suits do not matter.
- The cut card sits with a quarter of the shoe left. When it comes out, the round finishes and the
  shoe is reshuffled before the next round. Every round deals two cards, so a shoe deals 54 rounds.

### A round

1. **Bet.** Place Espelho and, if you like, the side bets. Side bets need an Espelho bet. Limits:
   Espelho 0.50 to 250.00; each side bet 0.50 to 25.00.
2. **Roll.** Roll both dice: your hand.
3. **Deal.** The dealer deals two cards face down and turns them over: the dealer's hand.
4. **Settle.** Every bet settles on the two hands.

### Hands

A hand is two values from 1 to 6, and the dice and the cards are read the same way:

1. A **pair** beats any non-pair, and a higher pair beats a lower one. The table labels it
   `PAIR 4s`.
2. Between two non-pairs the higher **sum** wins; on equal sums, the higher single value wins. The
   table labels it `SUM 9 HIGH 6`.
3. Two hands that are still level hold the same two values: a tie.

From the strongest down: PAIR 6s to PAIR 1s, then SUM 11 HIGH 6 (6 and 5), SUM 10 HIGH 6, SUM 9
HIGH 6, SUM 9 HIGH 5, and so on down to SUM 3 HIGH 2 (2 and 1). Even PAIR 1s beats 6 and 5.

### Espelho

Espelho pays 1 to 1 when your dice outrank the dealer's cards. A tie loses.

### Side bets

| Bet              | Wins when                                                   |                    Pays |
| :--------------- | :---------------------------------------------------------- | ----------------------: |
| Empate           | the hands rank exactly equal: the same pair, or same values |                 17 to 1 |
| Somas Iguais     | the dice and the cards add up to the same total             |                  7 to 1 |
| Par vs Par       | both hands are pairs                                        |                 30 to 1 |
| Espelho Perfeito | both hands are the same pair                                |                200 to 1 |
| 6-6 vs 6-6       | both hands are 6-6                                          | 1000 to 1 + meter share |

### The progressive meter

6-6 vs 6-6 pays from a progressive meter on top of its fixed 1000 to 1.

- The meter starts at 5,000.00, its seed. 10% of every stake on 6-6 vs 6-6 goes into it as the bet
  is accepted, win or lose; the other 90% goes to the house. The main bet does not feed it.
- A hit pays 1000 to 1 on the stake plus the stake's share of the meter: stake ÷ 25.00 of it, so
  the whole meter at the 25.00 maximum and 2% of it at 0.50. The share is rounded down to the cent,
  and the round's own contribution is already in the meter.
- The meter keeps what the share leaves. If that is below the seed, the house tops it back up to
  5,000.00.
- The demo keeps the meter in the browser between visits, and the lobby shows it on the table's
  card.

### Examples

- Dice 3 and 6 (SUM 9 HIGH 6), cards 4 and 5 (SUM 9 HIGH 5): the high 6 wins. Espelho pays 1 to 1,
  and Somas Iguais 7 to 1.
- Dice 2 and 5, cards 5 and 2: a tie. Espelho loses; Empate pays 17 to 1 and Somas Iguais 7 to 1.
- Dice 1 and 1 (PAIR 1s), cards 6 and 5 (SUM 11 HIGH 6): the pair wins. Espelho pays 1 to 1.
- Dice 4 and 4, cards 4 and 4: a tie, so Espelho loses; Empate, Somas Iguais, Par vs Par and
  Espelho Perfeito all win.
- 5.00 on 6-6 vs 6-6 with the meter at 6,000.00: the stake takes it to 6,000.50. Dice 6 and 6,
  cards 6 and 6: the bet pays 5,000.00 at 1000 to 1 plus a fifth of the meter, 1,200.10, and
  returns the stake. The meter keeps 4,800.40, which the house tops up to 5,000.00.

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

The tables above are generated from the game's code, which the tests below verify. Method and
conventions: `docs/MATH.md`.

### Card source

The declared figures treat each card as equally likely to be any value, as an infinite shoe deals
them: 36 rolls against 24 × 24 cards. The table deals from six decks, and there a pair of cards is
rarer: once the first card is out, 23 of the 143 cards left share its value, not one in six. That
moves every bet, as the six-deck table above shows: the pair bets lose about three points (Par vs
Par returns 83.10%, Espelho Perfeito 89.80%, 6-6 vs 6-6's fixed pays 74.54%), and the main bet
gains half a point (95.47%), because the dealer pairs less often.

Those six-deck figures are exact for every round, not only for the first after a shuffle. Espelho
deals two cards a round and 54 rounds a shoe, whatever the cards, so the two cards of any round sit
at fixed positions of a uniformly shuffled shoe: a uniform draw of two cards from the full 144. A
table that reshuffles before every round would return the same figures.

### One published figure corrected

The brief published Somas Iguais with P = 11.27% and a house edge of 9.85%. The chance is right,
146/1296; at 7 to 1 the house edge is 1 − 8 × 146/1296 = 8/81 = 9.88%. The tests assert 9.88%.
Every other published figure is reproduced exactly.

### Exact tests

`espelho.test.ts` checks the declared figures three ways, which must agree exactly, as fractions:

1. it enumerates the 36 × 24 × 24 draws of the dice and two infinite-shoe cards with the ranking
   written from the rules, and reproduces the published table;
2. it checks that those are the fractions the bets declare (`bets.ts` computes them from the
   configuration, so retuning a payout keeps them right);
3. it runs the real game over all 20,736 draws: every RTP, hit frequency and volatility index
   equals its declared value.

For 6-6 vs 6-6 the game runs with the meter at zero for the fixed pays (exactly 1001/1296) and
frozen at its seed for the volatility index (1201/1296 per unit staked on average: 1 + 1000 +
5,000.00 ÷ 25.00 on a hit). The suite also checks that a hit pays every stake the same per unit
(1000 to 1 plus the meter ÷ 25.00, at 0.50, 1.00, 5.00 and 25.00), that the share is rounded down
and the rest stays in the meter, and that the meter breaks even at 7,375.00.

`finite-shoe.test.ts` runs the game over every roll and every pair of cards a full six-deck shoe can
deal (30,888 draws: the first card as a value, the second among the 143 left) and checks the
six-deck figures. `game.test.ts` checks the meter's accounts over 200,000 rounds of mixed stakes:
what it holds equals the seed plus the contributions and top-ups less the shares paid, to the
millionth of a cent.

| Bet                        | RTP, exactly | Hit frequency, exactly | Six decks, RTP exactly | Six decks, hit frequency |
| :------------------------- | :----------- | :--------------------- | :--------------------- | :----------------------- |
| Espelho                    | 205/216      | 205/432                | 4915/5148              | 4915/10296               |
| Empate                     | 11/12        | 11/216                 | 263/286                | 263/5148                 |
| Somas Iguais               | 73/81        | 73/648                 | 1162/1287              | 581/5148                 |
| Par vs Par                 | 31/36        | 1/36                   | 713/858                | 23/858                   |
| Espelho Perfeito           | 67/72        | 1/216                  | 1541/1716              | 23/5148                  |
| 6-6 vs 6-6, fixed pays     | 1001/1296    | 1/1296                 | 161/216                | 23/30888                 |
| 6-6 vs 6-6, excluding seed | 5653/6480    |                        | 161/216 + 1/10         |                          |

### The meter's economics

- **Where its money comes from.** Every stake on 6-6 vs 6-6 puts 10% in the meter; the house puts
  in the seed and every top-up.
- **Return excluding the seed.** The fixed pays return 77.24% and the meter pays back every
  contribution in the long run: 87.24% (84.54% on the six-deck shoe). This is the declared RTP.
- **Return at a given meter.** A hit pays meter ÷ 25.00 per unit staked, whatever the stake, so one
  round returns 77.24% + M ÷ 32,400.00 with the meter at M: 92.67% at the seed, 100% at 7,375.00
  (8,548.91 on the six-deck shoe).
- **The meter at a hit.** A hit comes every 1,296 rounds on average (1,343 on the six-deck shoe). If
  every cycle starts at the seed, the meter at a hit averages the seed plus a cycle's
  contributions: 5,000.00 + 129.6 × the mean stake, 8,240.00 at a constant 25.00. With smaller
  stakes a hit takes only part of the meter and the rest carries over, so the meter settles higher:
  with 0.50, 1.00, 5.00 and 25.00 in turn (a mean of 7.875, for which the formula gives 6,020.60),
  it averaged 7,378.16 at a hit on the infinite shoe and 7,486.82 on the six-deck shoe.
- **The seed's cost to the house.** At a constant 25.00 every hit takes the whole meter, and the
  house re-seeds 5,000.00: 3.86 per round, 15.43% of the stake. That is more than the bet's 12.76%
  hold excluding the seed, so at a constant 25.00 the bet returns 102.67% with the seed counted. In
  the mixed-stake runs the top-ups came to 1.01 and 0.97 per round, and the bet returned 100.11%
  and 96.73% with them.

### Monte Carlo tests

Both runs play every bet in every round, with 6-6 vs 6-6 staked at 0.50, 1.00, 5.00 and 25.00 in
turn and its meter live.

`espelho.math.test.ts` (run with `pnpm test:math`) plays 124,852,059 rounds on an infinite shoe,
the source the declared figures assume, through the production game (seed `espelho/infinite-shoe`).
That count makes ±0.15 percentage points 3.29 standard errors for Par vs Par, and the four bets up
to its volatility must land within ±0.15 pp. Espelho Perfeito and 6-6 vs 6-6 would need about 0.9 and
5.4 billion rounds for that; they are held to 3.29 of their own standard errors, and their exact
tests are the proof. Every hit frequency must land within 3.29 binomial standard errors.

| Bet                        | Simulated RTP | Declared RTP | Difference | Standard error |   Allowed |
| :------------------------- | ------------: | -----------: | ---------: | -------------: | --------: |
| Espelho                    |       94.909% |      94.907% |  +0.002 pp |       0.009 pp | ±0.150 pp |
| Empate                     |       91.634% |      91.667% |  −0.033 pp |       0.035 pp | ±0.150 pp |
| Somas Iguais               |       90.112% |      90.123% |  −0.012 pp |       0.023 pp | ±0.150 pp |
| Par vs Par                 |       86.109% |      86.111% |  −0.002 pp |       0.046 pp | ±0.150 pp |
| Espelho Perfeito           |       93.039% |      93.056% |  −0.016 pp |       0.122 pp | ±0.402 pp |
| 6-6 vs 6-6, fixed pays     |       77.331% |      77.238% |  +0.093 pp |       0.403 pp | ±1.327 pp |
| 6-6 vs 6-6, excluding seed |       87.331% |      87.238% |  +0.093 pp |       0.446 pp | ±1.466 pp |

The RTP excluding the seed takes each round's payout less any top-up that round needed. The brief
asked for it within ±0.3 pp after 5,000,000 rounds on the real shoe. The real shoe returns 84.54%,
not 87.24%, so that run checks the six-deck figure; and with a volatility index near 33, a
±0.3 pp check at 3.29 standard errors would take over a billion rounds. The exact tests pin both
parts instead: the fixed pays exactly, and the contributions through the meter's accounts.

`six-deck.math.test.ts` plays 31,213,015 rounds on the real shoe with its cut card and reshuffles
(seed `espelho/six-deck-shoe`), enough to hold Par vs Par to ±0.3 pp, and every bet to 3.29 of its
standard errors around its exact six-deck figure.

| Bet                        | Declared | Six decks, exact | Simulated | Difference | Standard error |
| :------------------------- | -------: | ---------------: | --------: | ---------: | -------------: |
| Espelho                    |  94.907% |          95.474% |   95.461% |  −0.013 pp |       0.018 pp |
| Empate                     |  91.667% |          91.958% |   91.960% |  +0.002 pp |       0.071 pp |
| Somas Iguais               |  90.123% |          90.287% |   90.277% |  −0.011 pp |       0.045 pp |
| Par vs Par                 |  86.111% |          83.100% |   82.996% |  −0.104 pp |       0.090 pp |
| Espelho Perfeito           |  93.056% |          89.802% |   89.505% |  −0.297 pp |       0.240 pp |
| 6-6 vs 6-6, fixed pays     |  77.238% |          74.537% |   74.426% |  −0.112 pp |       0.792 pp |
| 6-6 vs 6-6, excluding seed |  87.238% |          84.537% |   84.425% |  −0.112 pp |       0.880 pp |

### Card counting

A player who tracks the cards dealt knows the shoe's composition before every round. The six-deck
run computes each bet's exact expectation for that composition, round by round:

| Bet                        | Rounds favouring the counter | Counter's edge in them | Break-even bet spread |
| :------------------------- | ---------------------------: | ---------------------: | --------------------: |
| Espelho                    |                       10.86% |                   2.8% |               1 to 16 |
| Empate                     |                         none |                      — |                     — |
| Somas Iguais               |            under 1 in 10,000 |                   0.8% |                     — |
| Par vs Par                 |                        0.06% |                   3.4% |            1 to 8,404 |
| Espelho Perfeito           |                        0.61% |                   3.5% |              1 to 483 |
| 6-6 vs 6-6, fixed pays     |                       11.73% |                  22.8% |             1 to 10.5 |
| 6-6 vs 6-6, with the meter |                       40.90% |                  26.2% |              1 to 1.3 |

The break-even spread is how much more a perfect counter must stake in the favourable rounds than
in the others (one unit) to break even. The main bet is exposed: some compositions leave the
dealer's hand weak enough that the dice are more likely than not to win. 6-6 vs 6-6 is the most exposed, since its chance
follows the sixes left; with the meter as it stood in this run (above break-even much of the
time), a counter needs almost no spread. A table that reshuffles before every round, as a
continuous shuffler does, removes the exposure and changes no figure on this sheet.

## Change log

- 2026-09-30: first playable version, with rules, declared math, exact and Monte Carlo tests on an
  infinite and on the six-deck shoe, the progressive meter's economics, card counting exposure and
  the table.
