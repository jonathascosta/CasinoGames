# Lock & Roll — Rules of Play

_Lock a die, roll the other, beat the cards._

## 1. Game and document

| Game | Lock & Roll, an original table game of the Roll & Deal family |
| :-- | :-- |
| Version | 0.1.0 |
| Document | Rules of Play, revision 3 |
| Date | 2026-09-30 |
| Author | Jonathas Costa |
| Companion | Math Report (`docs/math/lock-and-roll.md`) |
| Demo table | [https://jonathascosta.github.io/CasinoGames/lock-and-roll](https://jonathascosta.github.io/CasinoGames/lock-and-roll) |

**Revision history**

| Revision | Date | Author | Change |
| :-- | :-- | :-- | :-- |
| 1 | 2026-09-30 | Jonathas Costa | First game sheet: rules, declared math, exact and Monte Carlo tests. The strategy computed by expected value; card counting measured. |
| 2 | 2026-09-30 | Jonathas Costa | Renamed from its working title, with English names for the game and its bets. The choices are Stand and Lock, and the re-roll costs the Lock fee. |
| 3 | 2026-09-30 | Jonathas Costa | Reformatted for submission as two documents, Rules of Play and Math Report, generated from the code with every figure traced to the engine or to a test; card counting measured on every game. |

Money is written in the table's currency with two decimals, as the demo shows it (the demo plays
with virtual chips).

<!-- player-rules:start -->

## 2. Objective

The player rolls two dice and may, once, lock one die and re-roll the other for a fee; the dealer
then deals two cards. The wager wins even money when the dice total more than the cards, and equal
totals go to the house.

## 3. Equipment

- **Dice.** Two standard six-sided dice, faces 1 to 6, thrown by the player (by the round's shooter
  at a live table: see section nine). Their **total** runs from 2 to 12.
- **Shoe.** 6 decks, each of the A to the 6 in 4 suits (24 cards): 144 cards in all, made from
  standard decks with every card above the 6 removed. The ace counts 1 and every other card its
  number. The dealer's two cards make the dealer's total.
- **Cut card.** It goes in with 36 cards behind it, a penetration of 75%: 108 cards are dealt before
  it comes out. When it comes out, the round in progress is completed, and the whole shoe is
  shuffled before the next round.
- **Lock marker.** A marker (a padlock puck, or a marked spot on the layout) set on the die the
  player locks.
- **Cosmetic.** Suits never count, only values, and the order of the dealer's two cards does not
  matter. Which die is which matters only for the decision: the player says which one to lock.
- **Also.** The layout (section four), chips, a discard rack and, at a live table, a dice cup or
  shaker.

## 4. Table layout

Each player position has a single spot, for the Lock & Roll wager, with the house rules printed
beside it: "Ties lose", "Lock fee: 40% of the bet", "1-1 re-rolls free". A fee area next to the spot
takes the Lock fee. The felt prints the one pay:

| Spot | Wins when | Pays | A 1.00 wager wins |
| :-- | :-- | --: | --: |
| Lock & Roll | the dice total more than the cards | 1 to 1 | 1.00 |

The demo shows this layout at
[https://jonathascosta.github.io/CasinoGames/lock-and-roll](https://jonathascosta.github.io/CasinoGames/lock-and-roll).
At the top are the dealer's cards, the two totals side by side (the dice's and the cards', the
higher one lit at the end) and the dice. Under the dice is the decision: Stand, and Lock with its
fee once a die is locked (the dice are the lock buttons: tapping one puts a padlock on it), with a
Strategy hint switch, off by default, which shows what the reference strategy would play. Below is
the felt with the one wager and its printed rules, then the chips, the balance, the total wagered
and the Clear, Roll and Autoplay buttons, with Rules and Paytable buttons beside the balance; an RTP
monitor below the table compares the rounds played with the declared figures.

## 5. Wagers

The game has one wager and no side or progressive wager. The Lock fee is not a wager: nothing is
paid on it.

### 5.1 Lock & Roll (main wager)

- **When.** Before the roll.
- **Limits.** 0.50 to 250.00.
- **Wins** when the dice's total, after the player's decision, is higher than the dealer's two
  cards.
- **Pays** 1 to 1.
- **Pushes** never: equal totals lose.
- **Loses** when the cards' total is equal or higher.

### 5.2 The Lock fee (not a wager)

- **What.** The price of locking one die and re-rolling the other: 40% of the wager (0.40 on a 1.00
  wager), rounded up to the cent. It is a whole number of cents on any wager that is a multiple of
  0.05.
- **Free on 1-1.** A roll of 1-1 re-rolls for free.
- **Never returned**, whatever the result, and nothing is paid on it: a winning wager is paid 1 to 1
  on the wager alone.

## 6. Sequence of play

1. **Wager.** The dealer invites wagers; each player places a Lock & Roll wager within the limits,
   and the dealer closes betting ("No more bets").
2. **Shuffle, if due.** If the cut card came out during the previous round, the dealer shuffles the
   whole shoe, has it cut and places the cut card with 36 cards behind it before the round begins.
3. **Roll.** The player rolls both dice. The dealer announces the roll and its total.
4. **Decision, once.** Before any card is dealt, the player chooses:

   - **Stand**: keep the roll; or
   - **Lock**: name one die to keep (the dealer sets the lock marker on it), place the Lock fee, 40%
     of the wager, in the fee area (nothing on 1-1), and re-roll the other die once. The re-rolled
     die is final.

   There is one decision per round. A player who has not decided when the dealer calls time stands:
   no fee is taken without the player's choice.
5. **Collect the fee.** The dealer takes each Lock fee as the lock is made, before the re-roll.
6. **Re-roll.** The locking player re-rolls the unlocked die; the dealer announces the new total.
7. **Deal.** The dealer deals two cards from the shoe, face up, and announces their total.
8. **Compare.** The dealer compares the dice's total with the cards' total (section seven).
9. **Settle.** The dealer settles the wager (section eight), clears the cards and returns the dice.

## 7. Comparing the totals

There are no hands to rank: the dice's total, after the decision, is compared with the dealer's two
cards.

- The dice's total is the sum of the two dice as they stand after the decision: the roll if the
  player stood, the locked die and the re-rolled die otherwise.
- The dealer's total is the sum of the two cards, the ace counting 1.
- A higher dice total wins; an equal or lower one loses. There is no push.

Worked examples:

- Wager 1.00, roll 6-1. The player locks the 6 and re-rolls the 1 for 0.40; it lands on 4, for 10;
  the dealer deals a 5 and a 3, for 8: the dice are higher and the wager wins 1.00. The round nets
  +0.60 for the player, the fee included.
- Wager 1.00, roll 1-1. The player locks the 1 and re-rolls the 1, free on 1-1; it lands on 5, for
  6; the dealer deals a 3 and a 3, for 6: a tie, which the house wins. The round nets −1.00 for the
  player.
- Wager 1.00, roll 6-2. The player stands on 8; the dealer deals a 6 and a 5, for 11: the cards are
  higher and the wager loses. The round nets −1.00 for the player.

## 8. Settlement procedure

- **The Lock fee** is collected when the player locks, before the re-roll, and is never returned: it
  is already the house's when the cards are dealt.
- **The wager** is settled once the cards are dealt: a losing wager is collected; a winning one is
  paid 1 to 1 and keeps its stake. Nothing is paid on the fee.
- With several players, the dealer collects every losing wager first, then pays the winners.
- There is no progressive meter.

<!-- player-rules:end -->

## 9. Physical and live-dealer adaptation

- **Dice.** The player throws from a dice cup or by hand, across the layout. At a table with several
  players, one roll (from a shooter in turn, or an automatic shaker) serves every seat; each seat
  then decides on its own. The re-roll becomes one more die, rolled once for every seat that locked:
  each of those seats keeps the die it locked and adds the new die.
- **Timing.** The dealer calls for decisions after the roll and closes them before the re-roll;
  seats that have not decided stand. The cards are dealt only after the re-roll.
- **Calls.** The dealer announces the roll, the decisions and fees taken, the re-rolled die, the
  cards' total and the result.
- **Shoe.** Prepare 6 decks of A to 6 (144 cards), shuffle, offer the cut and place the cut card
  with 36 cards behind it. With two cards a round, a shoe deals 54 rounds.
- **Card counting.** The cards are dealt face up, and the wager can be counted at this penetration:
  the Math Report measures by how much. A live table should use a continuous shuffling machine, or
  shuffle much earlier.
- **The RNG version** draws the dice, the re-roll and the cards from a certified random number
  generator, deals from a virtual shoe with the same cut card (or reshuffles it every round) and
  settles at once. The player taps a die to lock it; if the table closes before the player decides,
  the round finishes as a Stand. The optional Strategy hint and autoplay follow the reference
  strategy. It has no physical irregularities. Every rule, limit and pay is the same.

## 10. Irregularities

- **Die off the table.** A die that leaves the layout (off the table, into the chip rail or the
  dealer's bank) is no roll: the dealer calls it, checks the dice and the shooter rolls again (on
  the re-roll, only the re-rolled die: the locked die stays). Wagers stay as they are.
- **Cocked die.** A die that comes to rest tilted, against a chip, the rail, a card or the other
  die, so that no face is plainly uppermost, is no roll: the dice are rolled again (on the re-roll,
  only the re-rolled die: the locked die stays). A die lying flat on a chip is read as it lies.
- **Dice thrown too early.** Dice thrown before the dealer closes betting are no roll.
- **Misread result.** The dice and cards as they lie decide the round: a misread call is corrected
  before the round is settled, and a settlement error is corrected before the next round begins.
- **Exposed card.** A card exposed before the decisions are made would inform them: it is burned to
  the discards, the decisions go ahead, and the round is dealt from the next cards. A card exposed
  after the decisions is burned too.
- **Mis-deal.** Only the first two cards dealt after the re-roll count; a card dealt before the
  decisions or the re-roll, or any further card, is burned.
- **Wrong die re-rolled.** If the locked die is thrown instead of the other, both dice are set back
  as they were before the decision and the right die is re-rolled; the fee stands.
- **Cards short of the cut card.** It cannot happen as the shoe is prepared: a round uses at most
  two cards, and 36 cards sit behind the cut card. If the shoe were nonetheless to run out during a
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
- Undecided seats stand when the dealer calls time, and pay no fee.
- At a multi-seat table, one extra die, rolled once, serves every seat that locked.
- A card exposed before the decisions is burned and the decisions go ahead.
- A die thrown by mistake is set back and the right die re-rolled, the fee standing.
- Counting: a continuous shuffler, or a much earlier shuffle, at a live table.
