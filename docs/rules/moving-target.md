# Moving Target — Rules of Play

_Your dice set the target. Will the cards land on it?_

## 1. Game and document

| Game | Moving Target, an original table game of the Roll & Deal family |
| :-- | :-- |
| Version | 0.1.0 |
| Document | Rules of Play, revision 3 |
| Date | 2026-09-30 |
| Author | Jonathas Costa |
| Companion | Math Report (`docs/math/moving-target.md`) |
| Demo table | [https://jonathascosta.github.io/CasinoGames/moving-target](https://jonathascosta.github.io/CasinoGames/moving-target) |

**Revision history**

| Revision | Date | Author | Change |
| :-- | :-- | :-- | :-- |
| 1 | 2026-09-30 | Jonathas Costa | First game sheet: rules, declared math, exact and Monte Carlo tests. The six-deck shoe's shift measured. |
| 2 | 2026-09-30 | Jonathas Costa | Renamed from its working title, with English names for the game and its bets. |
| 3 | 2026-09-30 | Jonathas Costa | Reformatted for submission as two documents, Rules of Play and Math Report, generated from the code with every figure traced to the engine or to a test; card counting measured on every game. |

Money is written in the table's currency with two decimals, as the demo shows it (the demo plays
with virtual chips).

<!-- player-rules:start -->

## 2. Objective

The player rolls two dice, whose sum sets the round's target, and the dealer deals cards one at a
time, adding their values, until the total reaches or passes the target. The main wager, Exact Hit,
wins when the total lands exactly on the target and pays more on the targets that are harder to hit;
optional side wagers settle on the same deal.

## 3. Equipment

- **Dice.** Two standard six-sided dice, faces 1 to 6, thrown by the player (by the round's shooter
  at a live table: see section nine). Their **sum**, from 2 to 12, is the round's **target**.
- **Shoe.** 6 decks, each of the A to the 10 in 4 suits (40 cards): 240 cards in all, made from
  standard decks with every card above the 10 removed: no jacks, queens or kings. The ace counts 1
  and every other card its number, up to 10.
- **Cut card.** It goes in with 60 cards behind it, a penetration of 75%: 180 cards are dealt before
  it comes out. When it comes out, the round in progress is completed, and the whole shoe is
  shuffled before the next round.
- **Cosmetic.** Suits never count, only values. Which die is which does not matter: only their sum
  does. The order of the cards does matter, as it decides when the deal stops.
- **Also.** The layout (section four), chips, a discard rack and, at a live table, a dice cup or
  shaker and a marker for the target.

## 4. Table layout

Each player position has one spot for the main wager, Exact Hit, in the centre, and one on each side
for First Card and 3+ Cards. The felt prints Exact Hit's pays by target and the side wagers' pays:

| Target | Exact Hit pays | A 1.00 wager wins |
| :-- | --: | --: |
| 2 | 15 to 2 | 7.50 |
| 3 | 7 to 1 | 7.00 |
| 4 | 6 to 1 | 6.00 |
| 5 | 11 to 2 | 5.50 |
| 6 | 5 to 1 | 5.00 |
| 7 | 9 to 2 | 4.50 |
| 8 | 4 to 1 | 4.00 |
| 9 | 7 to 2 | 3.50 |
| 10 | 3 to 1 | 3.00 |
| 11 | 5 to 1 | 5.00 |
| 12 | 5 to 1 | 5.00 |

| Side wager | Wins when | Pays | A 1.00 wager wins |
| :-- | :-- | --: | --: |
| First Card | the first card alone is the target | 9 to 1 | 9.00 |
| 3+ Cards | the dealer needs 3 cards or more | 4 to 1 | 4.00 |

The demo shows this layout at
[https://jonathascosta.github.io/CasinoGames/moving-target](https://jonathascosta.github.io/CasinoGames/moving-target).
At the top are the dice and the target board: the target, locked in large after the roll with what
Exact Hit pays on it, Exact Hit's paytable with that target lit, the dealer's running total filling
up to the target, and the count of cards that 3+ Cards watches. The dealer's cards land beside it,
one at a time. Below is the felt, with Exact Hit in the centre and a side wager on each side, then
the chips, the balance, the total wagered and the Clear, Roll and Autoplay buttons, with Rules and
Paytable buttons beside the balance; an RTP monitor below the table compares the rounds played with
the declared figures.

## 5. Wagers

Every wager is placed before the roll and settled once the dealer stops. The main wager comes first;
the side wagers follow in the felt's order. The game has no progressive wager.

### 5.1 Exact Hit (main wager)

- **When.** Before the roll. It can be placed alone, and every side wager needs it.
- **Limits.** 0.50 to 250.00.
- **Wins** when the dealer's total lands exactly on the target.
- **Pays** by the target, as the felt prints it: 15 to 2 on 2, 7 to 1 on 3, 6 to 1 on 4, 11 to 2 on
  5, 5 to 1 on 6, 9 to 2 on 7, 4 to 1 on 8, 7 to 2 on 9, 3 to 1 on 10, 5 to 1 on 11 and 5 to 1 on 12.
  Half-unit odds pay exactly on the table's chips: a 1.00 wager on a target of 2 wins 7.50.
- **Pushes** never.
- **Loses** when the total passes the target.

### 5.2 First Card (side wager)

- **When.** Before the roll, only with an Exact Hit wager. The target is not known when it is
  placed.
- **Limits.** 0.50 to 25.00.
- **Wins** when the first card alone is the target. No card is worth more than 10, so it cannot win
  on a target above 10.
- **Pays** 9 to 1.
- **Pushes** never.
- **Loses** on any other deal.

### 5.3 3+ Cards (side wager)

- **When.** Before the roll, only with an Exact Hit wager.
- **Limits.** 0.50 to 25.00.
- **Wins** when the dealer needs 3 cards or more to reach or pass the target, whether the total then
  lands on it or passes it.
- **Pays** 4 to 1.
- **Pushes** never.
- **Loses** when one or two cards reach the target.

## 6. Sequence of play

1. **Wagers.** The dealer invites wagers. Each player places Exact Hit and any side wagers, within
   the limits. The dealer then closes betting ("No more bets").
2. **Shuffle, if due.** If the cut card came out during the previous round, the dealer shuffles the
   whole shoe, has it cut and places the cut card with 60 cards behind it before the round begins.
3. **Roll.** The player rolls both dice. The dealer announces their sum as the target, with what
   Exact Hit pays on it, and marks the target on the layout.
4. **Deal.** The dealer deals cards from the shoe face up, one at a time, announcing each card and
   the running total. The dealer stops as soon as the total equals or passes the target, and never
   deals a card once it has.
5. **Compare.** The dealer compares the final total with the target (section seven) and counts the
   cards dealt.
6. **Settle.** The dealer settles every wager (section eight), clears the cards to the discard rack
   and returns the dice for the next round.

## 7. Comparing the total with the target

There are no hands to rank: the dealer's total is compared with the target.

- The **total** is the sum of the cards dealt so far, the ace counting 1.
- The total **hits** when it equals the target, and goes **over** when it passes it; either way the
  deal stops.
- The **card count** is the number of cards the dealer needed to stop, from 1 to 12 (a target of 12
  reached by aces alone).

Worked examples:

- Dice 4-3 (target 7), cards 3 and 4 (running total 3, 7): the total lands on the target. Exact Hit
  wins 9 to 2; First Card and 3+ Cards lose.
- Dice 4-1 (target 5), one card, a 5: the total lands on the target. Exact Hit wins 11 to 2; First
  Card wins 9 to 1; 3+ Cards loses.
- Dice 6-6 (target 12), cards 10 and 5 (running total 10, 15): the total passes the target. Exact
  Hit, First Card and 3+ Cards lose.
- Dice 6-5 (target 11), cards 1, 2, 3 and 7 (running total 1, 3, 6, 13): the total passes the
  target. 3+ Cards wins 4 to 1; Exact Hit and First Card lose.

## 8. Settlement procedure

- The dealer settles once the deal stops: first collecting every losing wager, then paying the
  winners, Exact Hit first and then First Card and 3+ Cards.
- A winning wager is paid at its odds and keeps its stake. The tables above show what a 1.00 wager
  wins on each line.
- A pay that is not a whole number of cents (half-unit odds on an odd number of cents) is rounded
  down to the cent.
- There is no fee, commission or progressive meter.

<!-- player-rules:end -->

## 9. Physical and live-dealer adaptation

- **Dice.** The player throws from a dice cup or by hand, across the layout, so that both dice
  tumble and come to rest on the felt. At a table with several players, one shooter throws per
  round, in turn, and that one roll and one deal settle every seat; an automatic shaker, as used for
  Sic Bo, can replace the throw.
- **Calls and markers.** The dealer marks the target on the layout (a puck on a printed row of
  targets) and announces the running total after every card, then "hit" or "over" and the card
  count.
- **Shoe.** Prepare 6 decks of A to 10 (240 cards: every jack, queen and king removed), shuffle,
  offer the cut and place the cut card with 60 cards behind it. A round uses one to 12 cards, so the
  number of rounds a shoe deals varies.
- **Card counting.** The cards are dealt face up, and Exact Hit and 3+ Cards can be counted at this
  penetration: the Math Report measures by how much. A live table should use a continuous shuffling
  machine, or shuffle much earlier.
- **The RNG version** draws the dice and the cards from a certified random number generator, deals
  from a virtual shoe with the same cut card (or reshuffles it every round), and settles at once;
  the player's tap or throw only animates the dice, and the demo lands each card face down and turns
  it after a short pause, which is only presentation. It has no physical irregularities. Every rule,
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
- **Exposed card.** A card exposed out of turn (dropped, flashed, turned while the shoe is handled)
  is burned to the discards, and dealing continues with the next card.
- **Mis-deal.** A card dealt after the total reached the target does not count and is burned. A deal
  stopped too early continues until the total reaches the target; the round is not settled before it
  does. A card dealt before the roll is burned.
- **Cards short of the cut card.** It cannot happen as the shoe is prepared: a round uses at most 12
  cards, and 60 cards sit behind the cut card. If the shoe were nonetheless to run out during a
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
- An exposed card is burned and dealing continues with the next card; cards dealt past the target
  are burned.
- Counting: a continuous shuffler, or a much earlier shuffle, at a live table.
