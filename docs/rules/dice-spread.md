# Dice Spread — Rules of Play

_Will the card land between your dice?_

## 1. Game and document

| Game | Dice Spread, an original table game of the Roll & Deal family |
| :-- | :-- |
| Version | 0.1.0 |
| Document | Rules of Play, revision 3 |
| Date | 2026-09-30 |
| Author | Jonathas Costa |
| Companion | Math Report (`docs/math/dice-spread.md`) |
| Demo table | [https://jonathascosta.github.io/CasinoGames/dice-spread](https://jonathascosta.github.io/CasinoGames/dice-spread) |

**Revision history**

| Revision | Date | Author | Change |
| :-- | :-- | :-- | :-- |
| 1 | 2026-09-30 | Jonathas Costa | First game sheet: rules, declared math, exact and Monte Carlo tests. Card counting exposure measured. |
| 2 | 2026-09-30 | Jonathas Costa | Renamed from its working title, with English names for the game and its bets. |
| 3 | 2026-09-30 | Jonathas Costa | Reformatted for submission as two documents, Rules of Play and Math Report, generated from the code with every figure traced to the engine or to a test; card counting measured on every game. |

Money is written in the table's currency with two decimals, as the demo shows it (the demo plays
with virtual chips).

<!-- player-rules:start -->

## 2. Objective

The player rolls two dice and the dealer deals one card from a shoe of cards ace to 6. The main
wager, Between, wins when the card falls strictly between the two dice and pays more the closer
together they are; optional side wagers settle on the same roll and card.

## 3. Equipment

- **Dice.** Two standard six-sided dice, faces 1 to 6, thrown by the player (by the round's shooter
  at a live table: see section nine). The **spread** of a roll is the higher die minus the lower
  one: 0 for a pair, 5 for a 1 and a 6.
- **Shoe.** 6 decks, each of the A to the 6 in 4 suits (24 cards): 144 cards in all, made from
  standard decks with every card above the 6 removed. The ace counts 1 and every other card its
  number.
- **Cut card.** It goes in with 36 cards behind it, a penetration of 75%: 108 cards are dealt before
  it comes out. When it comes out, the round in progress is completed, and the whole shoe is
  shuffled before the next round.
- **Cosmetic.** Suits never count: no wager looks at a card's suit, only at its value. Which die is
  which, and the order in which they stop, do not matter either: a roll is read by its two values.
- **Also.** The layout (section four), chips, a discard rack and, at a live table, a dice cup or
  shaker.

## 4. Table layout

Each player position has one spot for the main wager, Between, in front, and one for each side wager
around it: Match, Bullseye, Doubles and Triple. The felt prints what each spot pays:

| Spot | Wins when | Pays | A 1.00 wager wins |
| :-- | :-- | --: | --: |
| Between, spread 2 | the card strictly between the dice (1 value) | 4 to 1 | 4.00 |
| Between, spread 3 | the card strictly between the dice (2 values) | 2 to 1 | 2.00 |
| Between, spread 4 | the card strictly between the dice (3 values) | 1 to 1 | 1.00 |
| Between, spread 5 | the card strictly between the dice (4 values) | 1 to 2 | 0.50 |
| Between, spread 0 or 1 | no card can fall between the dice | push | stake returned |
| Match | the card equals either die | 2 to 1 | 2.00 |
| Bullseye | the dice are 2 apart and the card is the value between them | 22 to 1 | 22.00 |
| Doubles | the dice are a pair | 4 to 1 | 4.00 |
| Triple | the dice are a pair and the card has their value | 30 to 1 | 30.00 |

The demo shows this layout at
[https://jonathascosta.github.io/CasinoGames/dice-spread](https://jonathascosta.github.io/CasinoGames/dice-spread).
At the top are the dice and the dealer's card, then a strip of the values 1 to 6 that marks the dice
and lights the values between them. Below it is the felt: Between in the centre with the side wagers
around it, and Between's pays by spread printed along the bottom, the spread in force lit. Under the
felt sit the chips, the balance, the total wagered and the Clear, Roll and Autoplay buttons, with
Rules and Paytable buttons beside the balance; an RTP monitor below the table compares the rounds
played with the declared figures.

## 5. Wagers

Every wager is placed before the roll and settled once the card is turned. The main wager comes
first; the side wagers follow in the felt's order. The game has no progressive wager.

### 5.1 Between (main wager)

- **When.** Before the roll. It can be placed alone, and every side wager needs it.
- **Limits.** 0.50 to 250.00.
- **Wins** when the card's value lies strictly between the two dice: higher than the lower die and
  lower than the higher one.
- **Pays** by the spread: 4 to 1 on a spread of 2, 2 to 1 on a spread of 3, 1 to 1 on a spread of 4
  and 1 to 2 on a spread of 5.
- **Pushes** when the dice are a pair or one apart (spread 0 or 1): no card can fall between them,
  so the wager is returned whatever the card.
- **Loses** when the spread is 2 or more and the card equals either die or lies outside them.

### 5.2 Match (side wager)

- **When.** Before the roll, only with a Between wager.
- **Limits.** 0.50 to 25.00.
- **Wins** when the card equals either die(it pays once, even when both dice show the card's value).
- **Pays** 2 to 1.
- **Pushes** never.
- **Loses** on any other roll and card.

### 5.3 Bullseye (side wager)

- **When.** Before the roll, only with a Between wager.
- **Limits.** 0.50 to 25.00.
- **Wins** when the dice are 2 apart and the card is the value between them (dice 6-4 and a 5, say).
- **Pays** 22 to 1.
- **Pushes** never.
- **Loses** on any other roll and card.

### 5.4 Doubles (side wager)

- **When.** Before the roll, only with a Between wager.
- **Limits.** 0.50 to 25.00.
- **Wins** when the dice are a pair, whatever the card; it is settled with the other wagers once the
  card is turned.
- **Pays** 4 to 1.
- **Pushes** never.
- **Loses** on any other roll and card.

### 5.5 Triple (side wager)

- **When.** Before the roll, only with a Between wager.
- **Limits.** 0.50 to 25.00.
- **Wins** when the dice are a pair and the card has their value.
- **Pays** 30 to 1.
- **Pushes** never.
- **Loses** on any other roll and card.

## 6. Sequence of play

1. **Wagers.** The dealer invites wagers. Each player places Between and any side wagers, within the
   limits. The dealer then closes betting ("No more bets").
2. **Shuffle, if due.** If the cut card came out during the previous round, the dealer shuffles the
   whole shoe, has it cut and places the cut card with 36 cards behind it before the round begins.
3. **Roll.** The player rolls both dice. The dealer reads the roll aloud with its spread and the
   Between pay in force: "5 and 2, spread 3, Between pays 2 to 1".
4. **Card.** The dealer deals one card from the shoe, face down, then turns it face up. No other
   card is dealt.
5. **Compare.** The dealer compares the card with the dice (section seven) and announces each
   wager's result.
6. **Settle.** The dealer settles every wager (section eight), clears the card to the discard rack
   and returns the dice for the next round.

## 7. Comparing the card with the dice

There are no hands to rank: the one card is compared with the two dice.

- A card is **between** the dice when its value is higher than the lower die and lower than the
  higher die. A card equal to either die is not between them.
- The **spread** is the higher die minus the lower die; a pair has a spread of 0.
- A card **matches** a die when it has the same value.

Worked examples:

- Dice 5-2 (spread 3), card 3: Between wins 2 to 1; Match, Bullseye, Doubles and Triple lose.
- Dice 6-4 (spread 2), card 5: Between wins 4 to 1; Bullseye wins 22 to 1; Match, Doubles and Triple
  lose.
- Dice 3-3 (spread 0), card 3: Match wins 2 to 1; Doubles wins 4 to 1; Triple wins 30 to 1; Between
  pushes; Bullseye loses.
- Dice 6-1 (spread 5), card 6: Match wins 2 to 1; Between, Bullseye, Doubles and Triple lose.

## 8. Settlement procedure

- The dealer settles once the card is turned: first collecting every losing wager, then paying the
  winners, Between first and the side wagers in the felt's order (Match, Bullseye, Doubles and
  Triple), and leaving pushed wagers in place.
- A winning wager is paid at its odds and keeps its stake. The table above shows what a 1.00 wager
  wins on each line.
- A pay that is not a whole number of cents (1 to 2 on an odd number of cents) is rounded down to
  the cent.
- There is no fee, commission or progressive meter.

<!-- player-rules:end -->

## 9. Physical and live-dealer adaptation

- **Dice.** The player throws from a dice cup or by hand, across the layout, so that both dice
  tumble and come to rest on the felt. At a table with several players, one shooter throws per
  round, in turn, and that one roll and one card settle every seat; an automatic shaker, as used for
  Sic Bo, can replace the throw.
- **Calls.** The dealer announces the roll, its spread and the Between pay in force before the card,
  then the card and the winning wagers.
- **Shoe.** Prepare 6 decks of A to 6 (144 cards), shuffle, offer the cut and place the cut card
  with 36 cards behind it. A standard dealing shoe holds them. With one card a round, a shoe deals
  108 rounds.
- **Card counting.** The cards dealt are visible, and Between can be counted at this penetration:
  the Math Report measures by how much. A live table should shuffle after every round, use a
  continuous shuffling machine, or place the cut card much nearer the front.
- **The RNG version** draws the dice and the cards from a certified random number generator, deals
  from a virtual shoe with the same cut card (or reshuffles it every round), and settles at once;
  the player's tap or throw only animates the dice. It has no physical irregularities. Every rule,
  limit and pay is the same.

## 10. Irregularities

- **Die off the table.** A die that leaves the layout (off the table, into the chip rail or the
  dealer's bank) is no roll: the dealer calls it, checks the dice and the shooter rolls again.
  Wagers stay as they are.
- **Cocked die.** A die that comes to rest tilted, against a chip, the rail, a card or the other
  die, so that no face is plainly uppermost, is no roll: the dice are rolled again. A die lying flat
  on a chip is read as it lies.
- **Dice thrown too early.** Dice thrown before the dealer closes betting are no roll.
- **Misread result.** The dice and cards as they lie decide the round: a misread call is corrected
  before the round is settled, and a settlement error is corrected before the next round begins.
- **Exposed card.** A card exposed before the roll (dropped, flashed, turned while the shoe is
  handled) is burned to the discards, and the round proceeds with the next card. The round's card
  dealt face up instead of face down stands: facing it down is only presentation.
- **Mis-deal.** Only the first card dealt after the roll counts. A card dealt before the roll, or
  any card after the first, is burned.
- **Cards short of the cut card.** It cannot happen as the shoe is prepared: a round uses at most
  one card, and 36 cards sit behind the cut card. If the shoe were nonetheless to run out during a
  round (a cut card placed too deep, cards missing), the dealer shuffles the discards of earlier
  rounds, never the cards of the round in progress, and completes the round from them; the whole
  shoe is then shuffled before the next round. This is what the RNG version does.

## To confirm

These rulings are standard casino practice, not rules the game's code decides. Confirm each one, or
replace it with the house's own, before a live table opens.

- Settlement order: losing wagers collected first, then the winners paid, main wager first.
- Dice off the table and cocked dice are no roll, rather than read where they lie.
- At a table with several players, one shooter per round, in turn (or an automatic shaker), whose
  roll settles every seat.
- No card is burned after the shuffle, as in the RNG version; a burn card would not change the
  rules.
- An exposed card is burned; the round's card dealt face up in error stands.
- Extra cards, and a card dealt before the roll, are burned.
- Between counting: shuffle after every round or use a continuous shuffler at a live table.
