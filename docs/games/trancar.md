# Trancar

_“Lock it in”_ · original table game · **status: playable**

## Summary

The player places one bet and rolls two dice. Then comes the one decision in the demo: stand on
the roll (**Ficar**), or lock one die and roll the other once more (**Trancar**) for a fee of 40%
of the bet, free on 1-1. The dealer then deals two cards from a shoe of aces to sixes, and the bet
wins even money when the dice add up to more than the cards. A tie goes to the house.

## Rules

### Equipment

- Two six-sided dice, rolled by the player.
- A shoe of six decks, each with the ace to the six in four suits (24 cards): 144 cards. The ace
  counts 1 and every other card its number; suits do not matter.
- The cut card sits with a quarter of the shoe left. When it comes out, the round finishes and the
  shoe is reshuffled before the next round. Every round deals two cards, so a shoe deals 54 rounds.

### A round

1. **Bet.** Place the Trancar bet: 0.50 to 250.00. There are no side bets.
2. **Roll.** Roll both dice.
3. **Decide, once.**
   - **Ficar** (stand): keep the roll.
   - **Trancar** (lock): lock one die and roll the other once more. The fee is 40% of the bet
     (0.40 on a 1.00 bet), taken at once and never returned, whatever the result. A roll of 1-1
     re-rolls for free. The re-rolled die is final.
4. **Deal.** The dealer deals two cards face up.
5. **Settle.** If the dice add up to more than the two cards, the bet wins 1 to 1. An equal or
   lower total loses. The fee is not part of the bet: nothing is paid on it.

The fee is rounded up to the cent, which only matters for bets that are not multiples of 0.05; the
table's chips (0.50 and up) always make it exact. If the table closes before you decide (you leave
the page, say), the round finishes as if you had chosen Ficar: no fee is taken without your
choice.

**Not offered in this version:** _Trancar e Dobrar_, locking a die, re-rolling and doubling the
bet. The engine keeps a place for it.

### Examples

- Bet 1.00, roll 6-1. Lock the 6 and re-roll the 1 for 0.40: it lands on 4, for 10. The dealer
  deals a 5 and a 3, for 8. The bet wins 1.00; with the fee spent, the round nets +0.60.
- Bet 1.00, roll 1-1. The re-roll is free: lock a 1, and the other lands on 5, for 6. The dealer
  deals two 3s, for 6. A tie goes to the house: −1.00.
- Bet 1.00, roll 6-2. Stand on 8, which beats the dealer 7 times in 12. The dealer deals a 6 and a
  5: −1.00. Standing was still right: a re-roll keeping the 6 is worth less, once the fee is paid.

### Strategy hint

The table can show the reference strategy's choice for your roll. The **Strategy hint** switch
beside the decision is off by default. It is a demonstration feature for evaluators, and it shows
exactly what the table's autoplay does.

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

The tables above are generated from the game's code, which the tests below verify. Method and
conventions: `docs/MATH.md`.

### The fee in the figures

A fee is not a stake: nothing pays on it, and it is never returned. The figures count it against
the return, per unit of the bet: RTP = (payouts − fees) ÷ bets. That gives the house edge of 4.07%.
The same loss divided by everything the player pays, the bet and the fees, is the element of risk,
3.45%. Counted that way, as if the fees were money wagered, the game returns 96.55%. The RTP
monitor at the table counts the fees against the return as well, so it converges on 95.93%.

### The strategy

After the roll the player knows their total and compares two numbers: the value of standing on it
(2 × the chance that the dealer's two cards total less, minus 1) and the value of a re-roll (the
same for each face of the re-rolled die, on average, minus the fee). The strategy card above
lists both for each of the 21 distinct rolls. The best play follows:

- A re-roll always keeps the higher die: the higher the die kept, the better the re-roll.
- It pays to re-roll when the lower die is a 1 or a 2 and the other is not too high: 2-1 to 6-1,
  3-2, 4-2 and 5-2.
- Never re-roll a double, except 1-1 when it is free: 2-2 stands on 4 (−0.833) rather than pay for
  a re-roll worth −0.881.
- 6-2 stands: 8 wins 7 times in 12 (+0.167), a re-roll keeping the 6 is worth +0.081 after the fee.
- The closest calls are 3-2 and 5-2: a re-roll is better by 1/60 of the bet.

The free 1-1 is worth 35/3888 of the bet to the player (0.90 points of house edge), and without
it, 1-1 stands: a sure loss beats paying 0.40 for a re-roll worth −0.676. The strategy re-rolls on
17 rolls in 36 (47.2%) with the free 1-1 and on 16 in 36 (44.4%) without it, and pays the fee on
16 rolls in 36 either way.

### Card source

The declared figures treat each card as equally likely to be any value, as an infinite shoe deals
them. The table deals from six decks, where a pair of cards is a little rarer: once the first card
is out, 23 of the 143 cards left share its value, not one in six. The dealer's totals move toward
the middle, which helps the dice a little: the house edge is 4.03% on the six-deck shoe, against
4.07% declared. The strategy is the same on both shoes.

Those six-deck figures are exact for every round, not only for the first after a shuffle. Trancar
deals two cards a round and 54 rounds a shoe, whatever the dice and the decisions, so the two cards
of any round sit at fixed positions of a uniformly shuffled shoe: a uniform draw of two cards from
the full 144.

### Exact tests

- `strategy.test.ts` derives the strategy from scratch. It values standing and both re-rolls on
  each of the 21 rolls by enumerating the dealer's two cards and the faces of the re-rolled die,
  with exact fractions, and picks the best. That is the declared strategy on every roll, and the
  engine's `strategy.ts` computes the same choices. The house edge follows exactly: 791/19440 with
  the free 1-1 and 161/3240 without it.
- `trancar.test.ts` runs the real game with the reference strategy over every roll, every
  re-rolled face and every pair of infinite-shoe cards (69,696 draws). The RTP, the fees, the win
  frequency and the volatility equal the declared figures exactly. The rules without the free 1-1
  return 3079/3240, and every other strategy returns less: always standing returns 575/648
  (88.73%).
- `finite-shoe.test.ts` runs the game over every roll, re-roll and pair of cards a full six-deck
  shoe can deal (103,818 draws) and checks the six-deck figures.

| Figure                   | These rules, exactly | Without the free 1-1 | Six decks, exactly |
| :----------------------- | :------------------- | :------------------- | :----------------- |
| RTP                      | 18649/19440          | 3079/3240            | 148219/154440      |
| House edge               | 791/19440            | 161/3240             | 6221/154440        |
| Win frequency            | 4421/7776            | 731/1296             | 35135/61776        |
| Re-rolls                 | 17/36                | 4/9                  | 17/36              |
| Fee paid                 | 4/9                  | 4/9                  | 4/9                |
| Average fee (of the bet) | 8/45                 | 8/45                 | 8/45               |
| Element of risk          | 791/22896            | 161/3816             | 6221/181896        |

### Monte Carlo tests

Both runs play the production game with the reference strategy deciding every round, the same bot
the table's autoplay uses. `trancar.math.test.ts` (run with `pnpm test:math`) plays 5,144,842
rounds on an infinite shoe (seed `trancar/infinite-shoe`): enough to make ±0.15 percentage points
3.29 standard errors at a volatility of 1.034. The frequencies must land within 3.29 binomial
standard errors.

| Figure             | Declared | Simulated | Difference |   Allowed |
| :----------------- | -------: | --------: | ---------: | --------: |
| RTP                |  95.931% |   95.941% |  +0.010 pp | ±0.150 pp |
| Win frequency      |  56.854% |   56.856% |  +0.001 pp | ±0.072 pp |
| Trancar (re-rolls) |  47.222% |   47.189% |  −0.033 pp | ±0.072 pp |
| Free 1-1 re-rolls  |   2.778% |    2.763% |  −0.014 pp | ±0.024 pp |
| Fee paid           |  44.444% |   44.426% |  −0.019 pp | ±0.072 pp |

`six-deck.math.test.ts` plays as many rounds on the real shoe, with its cut card and reshuffles
(seed `trancar/six-deck-shoe`, 95,275 shuffles). It returned 96.017% against the exact six-deck
95.972%: +0.045 pp, with a standard error of 0.046 pp.

### Card counting

The dealer's cards are dealt face up, so a player who tracks them knows the shoe's composition
before every round. The six-deck run computes the exact expectation for that composition, round by
round:

| Player                  | Rounds favouring the counter | Counter's edge in them | Break-even bet spread |
| :---------------------- | ---------------------------: | ---------------------: | --------------------: |
| The reference strategy  |                       20.95% |                   4.6% |              1 to 5.2 |
| Deciding with the count |                       20.97% |                   4.7% |              1 to 5.1 |

The break-even spread is how much more a perfect counter must stake in the favourable rounds than
in the others (one unit) to break even. Trancar is exposed: the dealer's total follows the cards
left, and a shoe short of high cards makes the dice favourites in about one round in five. Adjusting
the decisions to the count adds almost nothing. A table that reshuffles before every round, as a
continuous shuffler does, removes the exposure; its figures are the six-deck figures above.

## Change log

- 2026-09-30: first playable version, with rules, the decision and its fee, the strategy computed
  by expected value, exact and Monte Carlo tests on an infinite and on the six-deck shoe, card
  counting exposure and the table.
