# Dice Spread

_Will the card land between your dice?_ · original table game · **status: playable**

## Summary

The player places bets and rolls two dice; the dealer deals one card from a shoe of aces to sixes.
The main bet, **Between**, wins when the card falls strictly between the two dice, and pays more the
closer together they are. Four optional side bets settle on the same roll and card. There are no
decisions after the bets.

## Rules

### Equipment

- Two six-sided dice, rolled by the player.
- A shoe of six decks, each with the ace to six in four suits: 144 cards. The ace counts as 1 and
  suits do not matter.
- The cut card sits with a quarter of the shoe left. When it comes out, the round finishes and the
  shoe is reshuffled before the next round.

### A round

1. **Bet.** Place Between and, if you like, any of the side bets. Side bets need a Between bet.
   Limits: Between 0.50 to 250.00; each side bet 0.50 to 25.00.
2. **Roll.** Roll both dice. The _spread_ is the high die minus the low die: 0 for a pair, 5 for a
   one and a six.
3. **Card.** The dealer deals one card face down, then turns it over.
4. **Settle.** Every bet settles on that roll and card.

### Between

Between wins when the card is strictly between the two dice. The payout depends on the spread:

| Spread       | Cards that win |   Pays |
| :----------- | :------------- | -----: |
| 2            | 1 value        | 4 to 1 |
| 3            | 2 values       | 2 to 1 |
| 4            | 3 values       | 1 to 1 |
| 5            | 4 values       | 1 to 2 |
| 1, or a pair | none           |   push |

A card equal to either die, or outside the dice, loses. On a push the stake is returned.

### Side bets

| Bet      | Wins when                                                |    Pays |
| :------- | :------------------------------------------------------- | ------: |
| Match    | the card equals either die                               |  2 to 1 |
| Bullseye | the spread is exactly 2 and the card is the middle value | 22 to 1 |
| Doubles  | the dice are a pair                                      |  4 to 1 |
| Triple   | the dice are a pair and the card matches it              | 30 to 1 |

### Examples

- Dice 2 and 5 (spread 3), card 3: Between wins 2 to 1; Match loses.
- Dice 4 and 6 (spread 2), card 5: Between wins 4 to 1 and Bullseye wins 22 to 1.
- Dice 3 and 3, card 3: Between pushes; Match, Doubles and Triple win 2, 4 and 30 to 1.
- Dice 1 and 6 (spread 5), card 6: Between loses; Match wins 2 to 1.

## Bets and paytable

<!-- math:start -->

<!-- prettier-ignore-start -->

<!-- Generated from mathSummary() of dice-spread by pnpm docs:sheets. Do not edit by hand. -->

| Bet | RTP | House edge | Hit frequency | Push | Max exposure | Volatility index | Limits |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| Between (main) | 96.30% | 3.70% | 18.52% | 44.44% | 4× | 1.117 | 0.50 – 250.00 |
| Match (side) | 91.67% | 8.33% | 30.56% | — | 2× | 1.382 | 0.50 – 25.00 |
| Bullseye (side) | 85.19% | 14.81% | 3.70% | — | 22× | 4.344 | 0.50 – 25.00 |
| Doubles (side) | 83.33% | 16.67% | 16.67% | — | 4× | 1.863 | 0.50 – 25.00 |
| Triple (side) | 86.11% | 13.89% | 2.78% | — | 30× | 5.094 | 0.50 – 25.00 |

RTP and house edge are per unit staked, pushes included. Hit frequency is the chance that a bet wins in a round. Push is the chance that the stake is simply returned. Max exposure is the largest net win per unit staked. The volatility index is the standard deviation of the net result per unit staked.

### Between (main bet)

Wins when the card falls strictly between the two dice, at odds set by the spread (high die minus low die). A pair or dice one apart push.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| Spread 2, card between | 4 to 1 | 3.704% |
| Spread 3, card between | 2 to 1 | 5.556% |
| Spread 4, card between | 1 to 1 | 5.556% |
| Spread 5, card between | 1 to 2 | 3.704% |
| Spread 1, or a pair | Push | 44.444% |

### Match (side bet)

Wins when the card equals either die.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| Card matches a die | 2 to 1 | 30.556% |

### Bullseye (side bet)

Bull's eye: wins when the dice are two apart and the card is the value between.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| Spread 2, card is the middle value | 22 to 1 | 3.704% |

### Doubles (side bet)

Wins when the dice show a pair.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| The dice are a pair | 4 to 1 | 16.667% |

### Triple (side bet)

Wins when the dice show a pair and the card matches it.

| Outcome | Pays | Probability |
| :-- | --: | --: |
| A pair, and the card matches it | 30 to 1 | 2.778% |

<!-- prettier-ignore-end -->

<!-- math:end -->

## Mathematics

The tables above are generated from the game's code, which the tests below verify. Method and
conventions: `docs/MATH.md`.

### Card source

The declared figures treat the card as uniform over ace to six, as an infinite shoe would deal it.
The six-deck shoe returns exactly the same in the long run to a player who bets the same way every
round. Each round deals one card and the cut card always comes out after 108 rounds, so the rounds
a shoe deals never depend on the cards. Over all shuffles, the card of any given round is therefore
equally likely to be each value.

### Exact test

`dice-spread.test.ts` runs the game over all 36 rolls × 6 card values (216 outcomes). Every figure
must equal the enumerated fraction:

| Bet      |   RTP | House edge | Hit frequency  | Variance σ² | Volatility index σ |
| :------- | ----: | ---------: | :------------- | ----------: | -----------------: |
| Between  | 26/27 |       1/27 | 5/27, push 4/9 |   3641/2916 |              1.117 |
| Match    | 11/12 |       1/12 | 11/36          |     275/144 |              1.382 |
| Bullseye | 23/27 |       4/27 | 1/27           |   13754/729 |              4.344 |
| Doubles  |   5/6 |        1/6 | 1/6            |      125/36 |              1.863 |
| Triple   | 31/36 |       5/36 | 1/36           |  33635/1296 |              5.094 |

The volatility index is the standard deviation of the net result per unit staked. The test
repeats the enumeration with an infinite shoe, suits included (36 × 24 = 864 draws), and gets the
same fractions.

All of Between's house edge comes from its spread-2 line. With one winning value in six, true odds
are 5 to 1 and the line pays 4 to 1. The spread 3, 4 and 5 lines pay exactly true odds.

### Monte Carlo test

`dice-spread.math.test.ts` (run with `pnpm test:math`) plays 124,852,059 rounds of the full
layout, all five bets at 0.50, dealt from the real six-deck shoe with the seeded generator (seed
`dice-spread/monte-carlo`). That count makes ±0.15 percentage points equal to 3.29 standard errors
for the most volatile bet, Triple. Every RTP must land within ±0.15 pp of its declared value, and
every hit and push frequency within 3.29 binomial standard errors.

| Bet      | Simulated RTP | Declared RTP | Difference | Standard error |
| :------- | ------------: | -----------: | ---------: | -------------: |
| Between  |       96.289% |      96.296% |  −0.007 pp |       0.010 pp |
| Match    |       91.676% |      91.667% |  +0.009 pp |       0.012 pp |
| Bullseye |       85.205% |      85.185% |  +0.020 pp |       0.039 pp |
| Doubles  |       83.376% |      83.333% |  +0.043 pp |       0.017 pp |
| Triple   |       86.125% |      86.111% |  +0.014 pp |       0.046 pp |

### Card counting

A player who bets the same way every round cannot beat the shoe, but one who tracks the cards
dealt can choose when to bet big. Between's value depends on what is left in the shoe: an ace or a
six can never fall between the dice, while a three or a four often does. Over the 36 rolls, one
unit on Between is worth −5/9 when the card is an ace or a six, +1/12 for a two or a five, and
+13/36 for a three or a four. Once many aces and sixes have gone, the rest of the shoe can favour
the player.

`counting.test.ts` computes the exposure exactly, for a player who knows the composition of the
shoe before every round:

| Penetration   | Rounds per shoe | Rounds favouring the player | Player edge in them | Break-even bet spread |
| :------------ | --------------: | --------------------------: | ------------------: | --------------------: |
| 75% (default) |             108 |                       8.57% |              +2.05% |                22 : 1 |
| 50%           |              72 |                       3.66% |              +1.18% |                87 : 1 |
| 25%           |              36 |                       0.47% |              +0.59% |        over 1,000 : 1 |

The table limits (0.50 to 250.00) allow a 500 : 1 spread, so at the default penetration a skilled
counter could beat Between wherever the cards dealt are visible, as at a live table. A live table
should shuffle after every round, use a continuous shuffler, or cut the penetration well below
50%. An RNG table that reshuffles every round returns exactly the declared figures.

Bullseye also depends on the composition, but favours the player in only 0.47% of rounds at
the default penetration. Match, Doubles and Triple cannot be counted: every card value is worth the
same to them.

## Change log

- 2026-09-30: first playable version, with rules, declared math, exact and Monte Carlo tests, a
  counting analysis and the table.
- 2026-09-30: renamed from its working title, with English names for the game and its bets.
