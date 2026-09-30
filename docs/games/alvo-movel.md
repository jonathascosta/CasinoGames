# Alvo Móvel

_“Moving target”_ · original table game · **status: playable**

## Summary

The player places bets and rolls two dice: their sum is the round's target. The dealer then deals
cards from a shoe of aces to tens, one at a time and face up, adding them up, and stops as soon as
the total reaches the target. The main bet, **Acerta**, wins when the total lands exactly on the
target, and pays more on the targets that are harder to hit. Two optional side bets settle on the
same deal. There are no decisions after the bets.

## Rules

### Equipment

- Two six-sided dice, rolled by the player.
- A shoe of six decks, each with the ace to the ten in four suits (40 cards, no picture cards):
  240 cards. The ace counts 1 and every other card its number; suits do not matter.
- The cut card sits with a quarter of the shoe left. When it comes out, the round finishes and the
  shoe is reshuffled before the next round. A round deals at most 12 cards, so it never runs out.

### A round

1. **Bet.** Place Acerta and, if you like, the side bets. Side bets need an Acerta bet. Limits:
   Acerta 0.50 to 250.00; each side bet 0.50 to 25.00.
2. **Roll.** Roll both dice. Their sum, from 2 to 12, is the target.
3. **Deal.** The dealer deals cards face up, one at a time, adding them up, and stops as soon as
   the total reaches or passes the target.
4. **Settle.** Every bet settles on that target and those cards.

### Acerta

Acerta wins when the dealer's total lands exactly on the target; a total that passes it loses. It
pays by target:

| Target | Pays     | Target | Pays     |
| :----- | :------- | :----- | :------- |
| 2      | 7.5 to 1 | 8      | 4 to 1   |
| 3      | 7 to 1   | 9      | 3.5 to 1 |
| 4      | 6 to 1   | 10     | 3 to 1   |
| 5      | 5.5 to 1 | 11     | 5 to 1   |
| 6      | 5 to 1   | 12     | 5 to 1   |
| 7      | 4.5 to 1 |        |          |

The generated tables below write the half-unit payouts as fractions: 15 to 2 is 7.5 to 1.

### Side bets

| Bet            | Wins when                                                   |   Pays |
| :------------- | :---------------------------------------------------------- | -----: |
| Primeira Carta | the first card alone is the target (impossible on 11 or 12) | 9 to 1 |
| Três ou Mais   | the dealer needs three cards or more                        | 4 to 1 |

### Examples

- Dice 3 and 4 (target 7), cards 3 and 4: the total lands on 7. Acerta wins 4.5 to 1; Três ou Mais
  loses, as two cards were enough.
- Dice 1 and 4 (target 5), card 5: Acerta wins 5.5 to 1 and Primeira Carta 9 to 1.
- Dice 6 and 6 (target 12), cards 10 and 5: the total, 15, passes the target, and every bet loses.
- Dice 5 and 6 (target 11), cards A, 2, 3 and 7: the total, 13, passes the target. Acerta loses;
  Três ou Mais wins.

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

The tables above are generated from the game's code, which the tests below verify. Method and
conventions: `docs/MATH.md`.

### Card source

The declared figures treat every card value from 1 to 10 as equally likely, as an infinite shoe
deals them. The table deals from six decks, which moves the long-run figures by up to a tenth of a
point per bet: see [The six-deck shoe](#the-six-deck-shoe).

### Landing on the target

The running total passes through a number n with chance h(n) = (h(n − 1) + … + h(n − 10)) / 10,
with h(0) = 1: it gets there from one of the ten totals below, by a card of the right value. Up to
10 every earlier total is in reach, so h(n) = 1.1 × h(n − 1) = 1.1^(n−1) / 10, rising from 11.00%
for a target of 2 to 23.58% for 10. From 11 the lowest totals drop out of reach and the chance
falls back, to 15.94% for 11 and 16.53% for 12. Acerta pays most on 2 and least on 10, and 11 and
12 pay 5 to 1 because they are harder to hit than 9 or 10.

### Exact test

`alvo-movel.test.ts` computes every figure three ways, which must agree exactly, as fractions:

1. a memoised recursion over the running total and the number of cards, written from the rules
   alone; it also reproduces the published table (chance to hit each target, house edge per target
   and overall, the side bets' chances and edges);
2. the closed forms declared in the code;
3. the real game, run over the 36 rolls and every card sequence each can deal: 71,469 outcomes.

| Bet            | RTP, exactly                  |     RTP | House edge | Hit frequency | Volatility index σ |
| :------------- | :---------------------------- | ------: | ---------: | ------------: | -----------------: |
| Acerta         | 17307296056493/18000000000000 | 96.152% |     3.848% |       17.301% |              2.148 |
| Primeira Carta | 11/12                         | 91.667% |     8.333% |        9.167% |              2.886 |
| Três ou Mais   | 43/48                         | 89.583% |    10.417% |       17.917% |              1.917 |

The volatility index is the standard deviation of the net result per unit staked; its square,
the variance, is 1199/144 for Primeira Carta and 8471/2304 for Três ou Mais, and for Acerta a
fraction of 28-digit terms worth 4.613.

### Monte Carlo test

`alvo-movel.math.test.ts` (run with `pnpm test:math`) plays 40,055,852 rounds of the full layout,
all three bets at 0.50, dealt from an infinite shoe through the production game, with the seeded
generator (seed `alvo-movel/infinite-shoe`). That count makes ±0.15 percentage points equal to
3.29 standard errors for the most volatile bet, Primeira Carta. Every RTP must land within
±0.15 pp of its declared value, and every hit frequency within 3.29 binomial standard errors.

| Bet            | Simulated RTP | Declared RTP | Difference | Standard error |
| :------------- | ------------: | -----------: | ---------: | -------------: |
| Acerta         |       96.170% |      96.152% |  +0.018 pp |       0.034 pp |
| Primeira Carta |       91.691% |      91.667% |  +0.025 pp |       0.046 pp |
| Três ou Mais   |       89.566% |      89.583% |  −0.017 pp |       0.030 pp |

### The six-deck shoe

A round deals several cards without replacement, so the real shoe does not return exactly the
declared figures. Two tests measure by how much:

- `finite-shoe.test.ts` computes, exactly, the first round after a shuffle. Once a card is out, a
  second card of the same value is less likely (23 in 239 instead of 1 in 10), so totals reached
  through pairs get rarer. Even targets are reached through pairs more often, so they get harder.
- `six-deck.math.test.ts` plays 183,929,931 seeded rounds of the full layout on the real shoe,
  with its cut card and reshuffles (seed `alvo-movel/six-deck-shoe`), enough to measure each bet's
  shift to ±0.07 pp. Over whole shoes the rounds interact: each round takes cards whose mix depends
  on the target it chased, the card that ends a round is more often a high one, and how many rounds
  a shoe deals depends on its cards. The test bounds every shift: 0.25 pp per bet, plus 3.29
  standard errors per target.

| House edge     | Infinite shoe (declared) | Six decks, first round (exact) | Six decks, long run | Shift (long run) |
| :------------- | -----------------------: | -----------------------------: | ------------------: | ---------------: |
| Acerta         |                    3.85% |                          3.98% |               3.88% |  +0.03 ± 0.02 pp |
| Primeira Carta |                    8.33% |                          8.33% |               8.42% |  +0.09 ± 0.02 pp |
| Três ou Mais   |                   10.42% |                         10.62% |              10.32% |  −0.09 ± 0.01 pp |

Acerta by target (house edge; the ± is one standard error):

| Target | Infinite shoe | First round | Long run | Shift (long run) |
| :----- | ------------: | ----------: | -------: | ---------------: |
| 2      |         6.50% |       6.82% |    6.41% |  −0.09 ± 0.12 pp |
| 3      |         3.20% |       3.22% |    3.14% |  −0.06 ± 0.08 pp |
| 4      |         6.83% |       7.11% |    6.99% |  +0.16 ± 0.06 pp |
| 5      |         4.83% |       4.87% |    4.73% |  −0.10 ± 0.05 pp |
| 6      |         3.37% |       3.62% |    3.49% |  +0.12 ± 0.04 pp |
| 7      |         2.56% |       2.60% |    2.48% |  −0.09 ± 0.04 pp |
| 8      |         2.56% |       2.78% |    2.80% |  +0.23 ± 0.04 pp |
| 9      |         3.54% |       3.56% |    3.53% |  −0.01 ± 0.04 pp |
| 10     |         5.68% |       5.84% |    5.78% |  +0.09 ± 0.04 pp |
| 11     |         4.38% |       4.38% |    4.24% |  −0.14 ± 0.07 pp |
| 12     |         0.81% |       1.06% |    0.82% |  +0.01 ± 0.10 pp |

In the long run the six-deck shoe makes the even targets a little harder and the odd ones a little
easier; on Acerta as a whole the two nearly cancel (+0.03 pp). Três ou Mais gets slightly cheaper
for the player (−0.09 pp) and Primeira Carta slightly dearer (+0.09 pp). No house edge moves by
more than a quarter of a point.

Which figures a table returns depends on how it deals. An RNG table that draws every card
independently (an infinite shoe) returns exactly the declared figures. One that reshuffles a
virtual six-deck shoe before every round, much as a continuous shuffler does, returns the first-round
column. A shoe dealt down to the cut card, as here and at a live table, returns the long-run
column.

## Change log

- 2026-09-30: first playable version, with rules, declared math, exact and Monte Carlo tests, the
  six-deck shoe's shift and the table.
