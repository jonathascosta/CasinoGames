# Mirror — Rules of Play

_Your dice against the dealer's cards, hand for hand._

## 1. Game and document

| Game | Mirror, an original table game of the Roll & Deal family |
| :-- | :-- |
| Version | 0.1.0 |
| Document | Rules of Play, revision 3 |
| Date | 2026-09-30 |
| Author | Jonathas Costa |
| Companion | Math Report (`docs/math/mirror.md`) |
| Demo table | [https://jonathascosta.github.io/CasinoGames/mirror](https://jonathascosta.github.io/CasinoGames/mirror) |

**Revision history**

| Revision | Date | Author | Change |
| :-- | :-- | :-- | :-- |
| 1 | 2026-09-30 | Jonathas Costa | First game sheet: rules, declared math, exact and Monte Carlo tests. The progressive meter's economics and card counting measured. |
| 2 | 2026-09-30 | Jonathas Costa | Renamed from its working title, with English names for the game and its bets. The progressive bet is Double Sixes. |
| 3 | 2026-09-30 | Jonathas Costa | Reformatted for submission as two documents, Rules of Play and Math Report, generated from the code with every figure traced to the engine or to a test; card counting measured on every game. |

Money is written in the table's currency with two decimals, as the demo shows it (the demo plays
with virtual chips).

<!-- player-rules:start -->

## 2. Objective

The player's two dice and the dealer's two cards are two hands, read the same way: a pair above any
non-pair, then by sum and by the higher value. The main wager, Mirror, wins when the dice outrank
the cards, and side wagers pay on the two hands mirroring each other, one of them with a progressive
meter.

## 3. Equipment

- **Dice.** Two standard six-sided dice, faces 1 to 6, thrown by the player (by the round's shooter
  at a live table: see section nine). The two dice are the player's **hand**.
- **Shoe.** 6 decks, each of the A to the 6 in 4 suits (24 cards): 144 cards in all, made from
  standard decks with every card above the 6 removed. The ace counts 1 and every other card its
  number. The dealer's two cards are the dealer's hand.
- **Cut card.** It goes in with 36 cards behind it, a penetration of 75%: 108 cards are dealt before
  it comes out. When it comes out, the round in progress is completed, and the whole shoe is
  shuffled before the next round.
- **Progressive meter.** A display, visible to every seat, of the Double Sixes meter (section
  eight).
- **Cosmetic.** Suits never count, only values. Which die is which, and the order of the two cards,
  do not matter: a hand is read by its two values.
- **Also.** The layout (section four), chips, a discard rack and, at a live table, a dice cup or
  shaker.

## 4. Table layout

Each player position has one spot for the main wager, Mirror, in the centre, one for each fixed-odds
side wager (Tie, Equal Sums, Pair vs Pair and Perfect Mirror) and one for the progressive wager,
Double Sixes. The progressive meter hangs across the top of the layout. The felt prints:

| Spot | Wins when | Pays | A 1.00 wager wins |
| :-- | :-- | --: | --: |
| Mirror | the dice outrank the cards (a tie loses) | 1 to 1 | 1.00 |
| Tie | the two hands rank exactly equal: the same pair, or the same two values | 17 to 1 | 17.00 |
| Equal Sums | the dice and the cards add up to the same total | 7 to 1 | 7.00 |
| Pair vs Pair | both hands are pairs | 30 to 1 | 30.00 |
| Perfect Mirror | both hands are the same pair | 200 to 1 | 200.00 |
| Double Sixes | both hands are 6-6 | 1000 to 1 plus a share of the meter | 1,000.00 plus stake ÷ 25.00 of the meter |

The demo shows this layout at
[https://jonathascosta.github.io/CasinoGames/mirror](https://jonathascosta.github.io/CasinoGames/mirror).
At the top is the mirror: the dealer's cards above the glass, the dice below it, each hand labelled
as the table reads it (PAIR 4s, SUM 9 HIGH 6), and the glass tilting toward the winner. Below is the
felt, with the meter across its top, Mirror in the centre, Double Sixes under it and two side wagers
on each side, then the chips, the balance, the total wagered and the Clear, Roll and Autoplay
buttons, with Rules and Paytable buttons beside the balance; an RTP monitor below the table compares
the rounds played with the declared figures. The lobby shows the live meter on the table's card.

## 5. Wagers

Every wager is placed before the roll and settled once both hands are known. The main wager comes
first, the fixed-odds side wagers next and the progressive wager last.

### 5.1 Mirror (main wager)

- **When.** Before the roll. It can be placed alone, and every side wager needs it.
- **Limits.** 0.50 to 250.00.
- **Wins** when the dice outrank the cards (section seven).
- **Pays** 1 to 1.
- **Pushes** never: a tie loses.
- **Loses** when the cards outrank the dice or the hands tie.

### 5.2 Tie (side wager)

- **When.** Before the roll, only with a Mirror wager.
- **Limits.** 0.50 to 25.00.
- **Wins** when the two hands rank exactly equal: the same pair, or the same two values.
- **Pays** 17 to 1.
- **Pushes** never.
- **Loses** otherwise.

### 5.3 Equal Sums (side wager)

- **When.** Before the roll, only with a Mirror wager.
- **Limits.** 0.50 to 25.00.
- **Wins** when the dice and the cards add up to the same total.
- **Pays** 7 to 1.
- **Pushes** never.
- **Loses** otherwise.

### 5.4 Pair vs Pair (side wager)

- **When.** Before the roll, only with a Mirror wager.
- **Limits.** 0.50 to 25.00.
- **Wins** when both hands are pairs.
- **Pays** 30 to 1.
- **Pushes** never.
- **Loses** otherwise.

### 5.5 Perfect Mirror (side wager)

- **When.** Before the roll, only with a Mirror wager.
- **Limits.** 0.50 to 25.00.
- **Wins** when both hands are the same pair.
- **Pays** 200 to 1.
- **Pushes** never.
- **Loses** otherwise.

### 5.6 Double Sixes (progressive side wager)

- **When.** Before the roll, only with a Mirror wager. 10% of the stake goes into the meter as the
  wager is accepted, win or lose.
- **Limits.** 0.50 to 25.00.
- **Wins** when both hands are 6-6: the dice a pair of 6s and the dealer's two cards both 6s.
- **Pays** 1000 to 1 on the stake, plus the stake's share of the meter: stake ÷ 25.00 of it, so the
  whole meter at the 25.00 maximum and 2% of it at the 0.50 minimum.
- **Pushes** never.
- **Loses** otherwise; its contribution to the meter stays in the meter.

## 6. Sequence of play

1. **Wagers.** The dealer invites wagers. Each player places Mirror and any side wagers, within the
   limits, and the dealer closes betting ("No more bets"). The meter is raised by 10% of every
   Double Sixes stake.
2. **Shuffle, if due.** If the cut card came out during the previous round, the dealer shuffles the
   whole shoe, has it cut and places the cut card with 36 cards behind it before the round begins.
3. **Roll.** The player rolls both dice. The dealer announces the player's hand ("PAIR 4s", "SUM 9
   HIGH 6").
4. **Deal.** The dealer deals two cards from the shoe, face down, then turns them over one at a time
   and announces the dealer's hand.
5. **Compare.** The dealer compares the two hands (section seven) and announces the winner, or a
   tie, and the side wagers that win.
6. **Settle.** The dealer settles every wager (section eight), pays any Double Sixes win from the
   meter, clears the cards and returns the dice.

## 7. Hand ranking

A hand is two values from 1 to 6, and the dice and the cards are ranked the same way:

1. A **pair** beats any non-pair, and a higher pair beats a lower one: from PAIR 6s down to PAIR 1s.
2. Between two non-pairs, the higher **sum** wins; on equal sums, the higher of the two values wins.
   The table calls such a hand by its sum and its higher value: SUM 11 HIGH 6 is a 6 and a 5.
3. Two hands still level hold the same two values: a **tie**, which the house wins on the main
   wager.

From the strongest down: PAIR 6s, PAIR 5s, PAIR 4s, PAIR 3s, PAIR 2s, PAIR 1s, SUM 11 HIGH 6, SUM 10
HIGH 6, SUM 9 HIGH 6, SUM 9 HIGH 5, SUM 8 HIGH 6, SUM 8 HIGH 5, SUM 7 HIGH 6, SUM 7 HIGH 5, SUM 7
HIGH 4, SUM 6 HIGH 5, SUM 6 HIGH 4, SUM 5 HIGH 4, SUM 5 HIGH 3, SUM 4 HIGH 3, SUM 3 HIGH 2. Even
PAIR 1s beats SUM 11 HIGH 6.

Worked examples:

- Dice 6-3 (SUM 9 HIGH 6) against cards 5-4 (SUM 9 HIGH 5): equal sums, and the dice's higher value
  is higher. The dice win: Mirror wins 1 to 1; Equal Sums wins 7 to 1; Tie, Pair vs Pair, Perfect
  Mirror and Double Sixes lose.
- Dice 1-1 (PAIR 1s) against cards 6-5 (SUM 11 HIGH 6): a pair beats any non-pair. The dice win:
  Mirror wins 1 to 1; Tie, Equal Sums, Pair vs Pair, Perfect Mirror and Double Sixes lose.
- Dice 5-2 (SUM 7 HIGH 5) against cards 5-2 (SUM 7 HIGH 5): the same two values, a tie. Tie wins 17
  to 1; Equal Sums wins 7 to 1; Mirror, Pair vs Pair, Perfect Mirror and Double Sixes lose.
- Dice 4-4 (PAIR 4s) against cards 4-4 (PAIR 4s): the same pair, a tie. Tie wins 17 to 1; Equal Sums
  wins 7 to 1; Pair vs Pair wins 30 to 1; Perfect Mirror wins 200 to 1; Mirror and Double Sixes
  lose.

## 8. Settlement procedure

- The dealer settles once both hands are known: first collecting every losing wager, then paying the
  winners in the felt's order, Mirror first, the fixed-odds side wagers next and Double Sixes last.
  A winning wager is paid at its odds and keeps its stake.
- **The meter.** It starts at its seed, 5,000.00, and grows by 10% of every Double Sixes stake,
  credited as the wager is accepted: the house funds it out of the stakes it holds, and a winning
  wager is still paid on its whole stake.
- **A hit** pays 1000 to 1 on the stake from the table's bank, plus the stake ÷ 25.00 share of the
  meter, rounded down to the cent, from the meter. The round's own contribution is already in the
  meter when the share is taken.
- **After a hit** the meter is decreased by the share paid and keeps the rest, down to the fraction
  of a cent. If it falls below the seed, the house tops it back up to 5,000.00.
- **Example.** 5.00 on Double Sixes with the meter at 6,000.00: the stake takes it to 6,000.50. Both
  hands are 6-6: the wager wins 5,000.00 at 1000 to 1 plus 1,200.10 from the meter, and keeps its
  stake. The meter keeps 4,800.40, which the house tops up to 5,000.00.
- A fixed pay that is not a whole number of cents is rounded down to the cent; with these odds it
  never is.

<!-- player-rules:end -->

## 9. Physical and live-dealer adaptation

- **Dice.** The player throws from a dice cup or by hand, across the layout, so that both dice
  tumble and come to rest on the felt. At a table with several players, one shooter throws per
  round, in turn, and that one roll and one pair of cards settle every seat; an automatic shaker, as
  used for Sic Bo, can replace the throw.
- **Calls.** The dealer announces both hands by the table's names ("SUM 9 HIGH 6 against SUM 9 HIGH
  5: the dice win").
- **Shoe.** Prepare 6 decks of A to 6 (144 cards), shuffle, offer the cut and place the cut card
  with 36 cards behind it. With two cards a round, a shoe deals 54 rounds.
- **Meter.** A meter display driven by the table's controller (or a network of tables sharing one
  meter), credited with every Double Sixes contribution as betting closes. A hit is verified by a
  supervisor before the meter is paid, as for any progressive.
- **Several winners.** When several seats win Double Sixes in the same round, each seat is due stake
  ÷ 25.00 of the meter as it stood before the round's payments; if those shares add up to more than
  the whole meter, the meter is divided among the seats in proportion to their stakes.
- **Card counting.** The cards are dealt openly, and Mirror and Double Sixes can be counted at this
  penetration: the Math Report measures by how much. A live table should use a continuous shuffling
  machine, or shuffle much earlier.
- **The RNG version** draws the dice and the cards from a certified random number generator, deals
  from a virtual shoe with the same cut card (or reshuffles it every round), keeps the meter to a
  millionth of a cent and settles at once; the player's tap or throw only animates the dice. It has
  no physical irregularities. Every rule, limit and pay is the same.

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
- **Exposed card.** A card exposed before the roll is burned to the discards, and the round proceeds
  with the next cards. One of the round's two cards dealt face up instead of face down stands:
  facing them down is only presentation.
- **Mis-deal.** Only the first two cards dealt after the roll count; any further card, or a card
  dealt before the roll, is burned.
- **Meter fault.** If the meter display fails, the controller's record of the meter decides the
  share paid.
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
- Several Double Sixes winners in one round share the meter in proportion to their stakes when their
  shares exceed it.
- A supervisor verifies every Double Sixes hit before the meter is paid.
- An exposed card is burned; the round's card dealt face up in error stands; extra cards are burned.
- Counting: a continuous shuffler, or a much earlier shuffle, at a live table.
