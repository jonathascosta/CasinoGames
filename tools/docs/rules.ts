/**
 * The Rules of Play: one document per game for a pit manager or a
 * live-dealer trainer, in plain English, with no figure beyond the
 * paytable. Written from the results only (the engine's configuration,
 * rules and bets as results.ts reads them); figures.ts keeps every number
 * out of the text below.
 */
import {
  Md,
  dice,
  int,
  join,
  doc,
  money,
  odds,
  pct,
  signedMoney,
  text,
  type Fig,
  type Figs,
  type Part,
} from './figures.ts';
import { bullets, facts, sections, series, steps, table, type Section } from './markdown.ts';
import type {
  BetFacts,
  DiceSpreadTable,
  GameResults,
  LockAndRollTable,
  MirrorRecords,
  MirrorTable,
  MovingTargetTable,
  Pay,
  Results,
  Settled,
  ShoeFacts,
  Table,
} from './results.ts';

type Meta = Figs<Results['meta']>;
type Game<T extends Table, R = unknown> = Figs<GameResults<T, R>>;

// ─── Shared pieces ───

const label = (bet: Figs<BetFacts>) => text(bet.label);
const limits = (bet: Figs<BetFacts>) => doc`${money(bet.min)} to ${money(bet.max)}`;

function pays(pay: Figs<Pay>): Md {
  return pay.odds === undefined ? doc`push` : odds(pay.odds.to, pay.odds.per);
}

function onUnit(pay: Figs<Pay>): Md {
  return pay.onUnit === undefined ? doc`stake returned` : money(pay.onUnit);
}

function paysOf(game: Game<Table>, bet: Figs<BetFacts>): readonly Figs<Pay>[] {
  return game.table.pays.filter((pay) => pay.bet.value === bet.id.value);
}

/** The single winning line of a side bet. */
function onlyPay(game: Game<Table>, bet: Figs<BetFacts>): Figs<Pay> {
  const lines = paysOf(game, bet).filter((pay) => pay.odds !== undefined);
  if (lines.length !== 1)
    throw new Error(`${bet.id.value} has ${String(lines.length)} winning lines`);
  return lines[0]!;
}

function betById(game: Game<Table>, id: string): Figs<BetFacts> {
  const bet = game.table.bets.find((candidate) => candidate.id.value === id);
  if (bet === undefined) throw new Error(`No bet ${id}`);
  return bet;
}

/** "Between wins 2 to 1; Match loses." from an example's settled bets. */
function settledText(game: Game<Table>, results: Figs<Readonly<Record<string, Settled>>>): Md {
  const bets = game.table.bets;
  const of = (bet: Figs<BetFacts>) => results[bet.id.value]!;
  const winners = bets
    .filter((bet) => of(bet).outcome.value === 'win')
    .map((bet) => doc`${label(bet)} wins ${odds(of(bet).odds!.to, of(bet).odds!.per)}`);
  const pushes = bets
    .filter((bet) => of(bet).outcome.value === 'push')
    .map((bet) => doc`${label(bet)} pushes`);
  const losers = bets.filter((bet) => of(bet).outcome.value === 'lose').map(label);
  const lost =
    losers.length === 0 ? [] : [doc`${series(losers)} ${losers.length === 1 ? 'loses' : 'lose'}`];
  return join([...winners, ...pushes, ...lost], '; ');
}

function shoeLine(shoe: Figs<ShoeFacts>): Md {
  return doc`${int(shoe.decks)} decks, each of the ${text(shoe.lowest)} to the ${text(shoe.highest)} in ${int(shoe.suits)} suits (${int(shoe.cardsPerDeck)} cards): ${int(shoe.cards)} cards in all, made from standard decks with every card above the ${text(shoe.highest)} removed`;
}

function cutCardLine(shoe: Figs<ShoeFacts>): Md {
  return doc`**Cut card.** It goes in with ${int(shoe.behindCutCard)} cards behind it, a penetration of ${pct(shoe.penetration, 0)}: ${int(shoe.cutCard)} cards are dealt before it comes out. When it comes out, the round in progress is completed, and the whole shoe is shuffled before the next round.`;
}

function diceLine(game: Game<Table>): Md {
  const faces = game.table.dice.faces;
  return doc`**Dice.** Two standard six-sided dice, faces ${int(faces[0]!)} to ${int(faces.at(-1)!)}, thrown by the player (by the round's shooter at a live table: see section nine).`;
}

function documentFacts(game: Game<Table>, meta: Meta): Md {
  const history = table(
    [
      ['Revision', 'left'],
      ['Date', 'left'],
      ['Author', 'left'],
      ['Change', 'left'],
    ],
    game.revisions.map((revision) => [
      text(revision.revision),
      text(revision.date),
      text(revision.author),
      text(revision.change),
    ]),
  );
  return doc`${facts([
    ['Game', doc`${text(game.name)}, an original table game of the Roll & Deal family`],
    ['Version', text(meta.version)],
    ['Document', doc`Rules of Play, revision ${text(game.revision.revision)}`],
    ['Date', text(game.revision.date)],
    ['Author', text(meta.author)],
    ['Companion', doc`Math Report (\`docs/math/${text(game.id)}.md\`)`],
    ['Demo table', doc`[${text(game.url)}](${text(game.url)})`],
  ])}

**Revision history**

${history}

Money is written in the table's currency with two decimals, as the demo shows it (the demo plays with virtual chips).`;
}

function document(
  game: Game<Table>,
  meta: Meta,
  body: readonly Section[],
  toConfirm: readonly Part[],
): Md {
  return doc`# ${text(game.name)} — Rules of Play

_${text(game.tagline)}_

${sections([
  {
    title: 'Game and document',
    body: doc`${documentFacts(game, meta)}\n\n${new Md(PLAYER_START)}`,
  },
  ...body,
])}

## To confirm

These rulings are standard casino practice, not rules the game's code decides. Confirm each one, or replace it with the house's own, before a live table opens.

${bullets(toConfirm)}
`;
}

/**
 * Around the part of the Rules of Play a player needs at the table, from the
 * objective to the settlement: the table's Rules dialog shows only that.
 */
export const PLAYER_START = '<!-- player-rules:start -->';
export const PLAYER_END = '<!-- player-rules:end -->';

/** The sections from the objective to the settlement, closed by the end marker. */
function playerSections(...list: Section[]): Section[] {
  const last = list.at(-1)!;
  return [
    ...list.slice(0, -1),
    { ...last, body: doc`${last.body ?? ''}\n\n${new Md(PLAYER_END)}` },
  ];
}

/** Irregularities every game shares, and the rulings they call for. */
function diceIrregularities(reroll?: Part): Part[] {
  return [
    doc`**Die off the table.** A die that leaves the layout (off the table, into the chip rail or the dealer's bank) is no roll: the dealer calls it, checks the dice and the shooter rolls again${reroll ?? ''}. Wagers stay as they are.`,
    doc`**Cocked die.** A die that comes to rest tilted, against a chip, the rail, a card or the other die, so that no face is plainly uppermost, is no roll: the dice are rolled again${reroll ?? ''}. A die lying flat on a chip is read as it lies.`,
    doc`**Dice thrown too early.** Dice thrown before the dealer closes betting are no roll.`,
    doc`**Misread result.** The dice and cards as they lie decide the round: a misread call is corrected before the round is settled, and a settlement error is corrected before the next round begins.`,
  ];
}

function shortShoe(game: Game<Table>, most: Part): Md {
  return doc`**Cards short of the cut card.** It cannot happen as the shoe is prepared: a round uses at most ${most}, and ${int(game.table.shoe.behindCutCard)} cards sit behind the cut card. If the shoe were nonetheless to run out during a round (a cut card placed too deep, cards missing), the dealer shuffles the discards of earlier rounds, never the cards of the round in progress, and completes the round from them; the whole shoe is then shuffled before the next round. This is what the RNG version does.`;
}

const COMMON_CONFIRM: readonly Part[] = [
  doc`Settlement order: losing wagers collected first, then the winners paid, main wager first.`,
  doc`Dice off the table and cocked dice are no roll, rather than read where they lie.`,
  doc`At a table with several players, one shooter per round, in turn (or an automatic shaker), whose roll settles every seat.`,
  doc`No card is burned after the shuffle, as in the RNG version; a burn card would not change the rules.`,
];

// ─── Dice Spread ───

function diceSpread(game: Game<DiceSpreadTable>, meta: Meta): Md {
  const t = game.table;
  const between = betById(game, 'between');
  const sides = t.bets.filter((bet) => bet.kind.value === 'side');
  const [example] = t.examples;
  const inForce = t.spreads.find((row) => row.spread.value === example!.spread.value)!;
  const bullseye = t.examples[1]!;
  const lowest = t.spreads[0]!;
  const widest = t.spreads.at(-1)!;
  const spreadRows = t.spreads.map((row) => [
    doc`${label(between)}, spread ${int(row.spread)}`,
    doc`the card strictly between the dice (${int(row.values)} ${row.values.value === 1 ? 'value' : 'values'})`,
    odds(row.odds.to, row.odds.per),
    money(row.onUnit),
  ]);
  const pushRow = [
    doc`${label(between)}, spread ${series(t.pushSpreads.map(int), ' or ')}`,
    doc`no card can fall between the dice`,
    doc`push`,
    doc`stake returned`,
  ];
  const sideRow = (bet: Figs<BetFacts>, wins: Part) => {
    const pay = onlyPay(game, bet);
    return [label(bet), wins, pays(pay), onUnit(pay)];
  };
  const wins: Readonly<Record<string, Md>> = {
    match: doc`the card equals either die`,
    bullseye: doc`the dice are ${int(lowest.spread)} apart and the card is the value between them`,
    doubles: doc`the dice are a pair`,
    triple: doc`the dice are a pair and the card has their value`,
  };
  const sideSubsection = (bet: Figs<BetFacts>, extra: Part): Section => ({
    title: doc`${label(bet)} (side wager)`,
    body: bullets([
      doc`**When.** Before the roll, only with a ${label(between)} wager.`,
      doc`**Limits.** ${limits(bet)}.`,
      doc`**Wins** when ${wins[bet.id.value]}${extra}.`,
      doc`**Pays** ${pays(onlyPay(game, bet))}.`,
      doc`**Pushes** never.`,
      doc`**Loses** on any other roll and card.`,
    ]),
  });
  return document(
    game,
    meta,
    [
      ...playerSections(
        {
          title: 'Objective',
          body: doc`The player rolls two dice and the dealer deals one card from a shoe of cards ace to ${text(t.shoe.highest)}. The main wager, ${label(between)}, wins when the card falls strictly between the two dice and pays more the closer together they are; optional side wagers settle on the same roll and card.`,
        },
        {
          title: 'Equipment',
          body: bullets([
            doc`${diceLine(game)} The **spread** of a roll is the higher die minus the lower one: ${int(t.pushSpreads[0]!)} for a pair, ${int(widest.spread)} for a ${int(t.dice.faces[0]!)} and a ${int(t.dice.faces.at(-1)!)}.`,
            doc`**Shoe.** ${shoeLine(t.shoe)}. The ace counts ${int(t.shoe.ranks[0]!)} and every other card its number.`,
            cutCardLine(t.shoe),
            doc`**Cosmetic.** Suits never count: no wager looks at a card's suit, only at its value. Which die is which, and the order in which they stop, do not matter either: a roll is read by its two values.`,
            doc`**Also.** The layout (section four), chips, a discard rack and, at a live table, a dice cup or shaker.`,
          ]),
        },
        {
          title: 'Table layout',
          body: doc`Each player position has one spot for the main wager, ${label(between)}, in front, and one for each side wager around it: ${series(sides.map(label))}. The felt prints what each spot pays:

${table(
  [
    ['Spot', 'left'],
    ['Wins when', 'left'],
    ['Pays', 'right'],
    [doc`A ${money(t.unit)} wager wins`, 'right'],
  ],
  [...spreadRows, pushRow, ...sides.map((bet) => sideRow(bet, wins[bet.id.value]))],
)}

The demo shows this layout at [${text(game.url)}](${text(game.url)}). At the top are the dice and the dealer's card, then a strip of the values ${int(t.dice.faces[0]!)} to ${int(t.dice.faces.at(-1)!)} that marks the dice and lights the values between them. Below it is the felt: ${label(between)} in the centre with the side wagers around it, and ${label(between)}'s pays by spread printed along the bottom, the spread in force lit. Under the felt sit the chips, the balance, the total wagered and the Clear, Roll and Autoplay buttons, with Rules and Paytable buttons beside the balance; an RTP monitor below the table compares the rounds played with the declared figures.`,
        },
        {
          title: 'Wagers',
          body: doc`Every wager is placed before the roll and settled once the card is turned. The main wager comes first; the side wagers follow in the felt's order. The game has no progressive wager.`,
          subsections: [
            {
              title: doc`${label(between)} (main wager)`,
              body: bullets([
                doc`**When.** Before the roll. It can be placed alone, and every side wager needs it.`,
                doc`**Limits.** ${limits(between)}.`,
                doc`**Wins** when the card's value lies strictly between the two dice: higher than the lower die and lower than the higher one.`,
                doc`**Pays** by the spread: ${series(
                  t.spreads.map(
                    (row) =>
                      doc`${odds(row.odds.to, row.odds.per)} on a spread of ${int(row.spread)}`,
                  ),
                )}.`,
                doc`**Pushes** when the dice are a pair or one apart (spread ${series(t.pushSpreads.map(int), ' or ')}): no card can fall between them, so the wager is returned whatever the card.`,
                doc`**Loses** when the spread is ${int(lowest.spread)} or more and the card equals either die or lies outside them.`,
              ]),
            },
            ...sides.map((bet) =>
              sideSubsection(
                bet,
                bet.id.value === 'match'
                  ? doc`(it pays once, even when both dice show the card's value)`
                  : bet.id.value === 'bullseye'
                    ? doc` (dice ${dice(bullseye.dice[0]!, bullseye.dice[1]!)} and a ${int(bullseye.card)}, say)`
                    : bet.id.value === 'doubles'
                      ? doc`, whatever the card; it is settled with the other wagers once the card is turned`
                      : '',
              ),
            ),
          ],
        },
        {
          title: 'Sequence of play',
          body: steps([
            doc`**Wagers.** The dealer invites wagers. Each player places ${label(between)} and any side wagers, within the limits. The dealer then closes betting ("No more bets").`,
            doc`**Shuffle, if due.** If the cut card came out during the previous round, the dealer shuffles the whole shoe, has it cut and places the cut card with ${int(t.shoe.behindCutCard)} cards behind it before the round begins.`,
            doc`**Roll.** The player rolls both dice. The dealer reads the roll aloud with its spread and the ${label(between)} pay in force: "${int(example!.dice[0]!)} and ${int(example!.dice[1]!)}, spread ${int(example!.spread)}, ${label(between)} pays ${odds(inForce.odds.to, inForce.odds.per)}".`,
            doc`**Card.** The dealer deals one card from the shoe, face down, then turns it face up. No other card is dealt.`,
            doc`**Compare.** The dealer compares the card with the dice (section seven) and announces each wager's result.`,
            doc`**Settle.** The dealer settles every wager (section eight), clears the card to the discard rack and returns the dice for the next round.`,
          ]),
        },
        {
          title: 'Comparing the card with the dice',
          body: doc`There are no hands to rank: the one card is compared with the two dice.

${bullets([
  doc`A card is **between** the dice when its value is higher than the lower die and lower than the higher die. A card equal to either die is not between them.`,
  doc`The **spread** is the higher die minus the lower die; a pair has a spread of ${int(t.pushSpreads[0]!)}.`,
  doc`A card **matches** a die when it has the same value.`,
])}

Worked examples:

${bullets(
  t.examples.map(
    (row) =>
      doc`Dice ${dice(row.dice[0]!, row.dice[1]!)} (spread ${int(row.spread)}), card ${int(row.card)}: ${settledText(game, row.results)}.`,
  ),
)}`,
        },
        {
          title: 'Settlement procedure',
          body: bullets([
            doc`The dealer settles once the card is turned: first collecting every losing wager, then paying the winners, ${label(between)} first and the side wagers in the felt's order (${series(sides.map(label))}), and leaving pushed wagers in place.`,
            doc`A winning wager is paid at its odds and keeps its stake. The table above shows what a ${money(t.unit)} wager wins on each line.`,
            doc`A pay that is not a whole number of cents (${odds(widest.odds.to, widest.odds.per)} on an odd number of cents) is rounded down to the cent.`,
            doc`There is no fee, commission or progressive meter.`,
          ]),
        },
      ),
      {
        title: 'Physical and live-dealer adaptation',
        body: bullets([
          doc`**Dice.** The player throws from a dice cup or by hand, across the layout, so that both dice tumble and come to rest on the felt. At a table with several players, one shooter throws per round, in turn, and that one roll and one card settle every seat; an automatic shaker, as used for Sic Bo, can replace the throw.`,
          doc`**Calls.** The dealer announces the roll, its spread and the ${label(between)} pay in force before the card, then the card and the winning wagers.`,
          doc`**Shoe.** Prepare ${int(t.shoe.decks)} decks of ${text(t.shoe.lowest)} to ${text(t.shoe.highest)} (${int(t.shoe.cards)} cards), shuffle, offer the cut and place the cut card with ${int(t.shoe.behindCutCard)} cards behind it. A standard dealing shoe holds them. With one card a round, a shoe deals ${int(t.roundsPerShoe)} rounds.`,
          doc`**Card counting.** The cards dealt are visible, and ${label(between)} can be counted at this penetration: the Math Report measures by how much. A live table should shuffle after every round, use a continuous shuffling machine, or place the cut card much nearer the front.`,
          doc`**The RNG version** draws the dice and the cards from a certified random number generator, deals from a virtual shoe with the same cut card (or reshuffles it every round), and settles at once; the player's tap or throw only animates the dice. It has no physical irregularities. Every rule, limit and pay is the same.`,
        ]),
      },
      {
        title: 'Irregularities',
        body: bullets([
          ...diceIrregularities(),
          doc`**Exposed card.** A card exposed before the roll (dropped, flashed, turned while the shoe is handled) is burned to the discards, and the round proceeds with the next card. The round's card dealt face up instead of face down stands: facing it down is only presentation.`,
          doc`**Mis-deal.** Only the first card dealt after the roll counts. A card dealt before the roll, or any card after the first, is burned.`,
          shortShoe(game, doc`one card`),
        ]),
      },
    ],
    [
      ...COMMON_CONFIRM,
      doc`An exposed card is burned; the round's card dealt face up in error stands.`,
      doc`Extra cards, and a card dealt before the roll, are burned.`,
      doc`${label(between)} counting: shuffle after every round or use a continuous shuffler at a live table.`,
    ],
  );
}

// ─── Moving Target ───

function movingTarget(game: Game<MovingTargetTable>, meta: Meta): Md {
  const t = game.table;
  const exactHit = betById(game, 'exact-hit');
  const firstCard = betById(game, 'first-card');
  const threePlus = betById(game, 'three-plus-cards');
  const sides = [firstCard, threePlus];
  const targets = t.targets;
  const [lowTarget, highTarget] = [targets[0]!, targets.at(-1)!];
  return document(
    game,
    meta,
    [
      ...playerSections(
        {
          title: 'Objective',
          body: doc`The player rolls two dice, whose sum sets the round's target, and the dealer deals cards one at a time, adding their values, until the total reaches or passes the target. The main wager, ${label(exactHit)}, wins when the total lands exactly on the target and pays more on the targets that are harder to hit; optional side wagers settle on the same deal.`,
        },
        {
          title: 'Equipment',
          body: bullets([
            doc`${diceLine(game)} Their **sum**, from ${int(lowTarget.target)} to ${int(highTarget.target)}, is the round's **target**.`,
            doc`**Shoe.** ${shoeLine(t.shoe)}: no jacks, queens or kings. The ace counts ${int(t.cardValues.lowest)} and every other card its number, up to ${int(t.cardValues.highest)}.`,
            cutCardLine(t.shoe),
            doc`**Cosmetic.** Suits never count, only values. Which die is which does not matter: only their sum does. The order of the cards does matter, as it decides when the deal stops.`,
            doc`**Also.** The layout (section four), chips, a discard rack and, at a live table, a dice cup or shaker and a marker for the target.`,
          ]),
        },
        {
          title: 'Table layout',
          body: doc`Each player position has one spot for the main wager, ${label(exactHit)}, in the centre, and one on each side for ${series(sides.map(label))}. The felt prints ${label(exactHit)}'s pays by target and the side wagers' pays:

${table(
  [
    ['Target', 'left'],
    [doc`${label(exactHit)} pays`, 'right'],
    [doc`A ${money(t.unit)} wager wins`, 'right'],
  ],
  targets.map((row) => [int(row.target), odds(row.odds.to, row.odds.per), money(row.onUnit)]),
)}

${table(
  [
    ['Side wager', 'left'],
    ['Wins when', 'left'],
    ['Pays', 'right'],
    [doc`A ${money(t.unit)} wager wins`, 'right'],
  ],
  [
    [
      label(firstCard),
      doc`the first card alone is the target`,
      pays(onlyPay(game, firstCard)),
      onUnit(onlyPay(game, firstCard)),
    ],
    [
      label(threePlus),
      doc`the dealer needs ${int(t.threePlusCards)} cards or more`,
      pays(onlyPay(game, threePlus)),
      onUnit(onlyPay(game, threePlus)),
    ],
  ],
)}

The demo shows this layout at [${text(game.url)}](${text(game.url)}). At the top are the dice and the target board: the target, locked in large after the roll with what ${label(exactHit)} pays on it, ${label(exactHit)}'s paytable with that target lit, the dealer's running total filling up to the target, and the count of cards that ${label(threePlus)} watches. The dealer's cards land beside it, one at a time. Below is the felt, with ${label(exactHit)} in the centre and a side wager on each side, then the chips, the balance, the total wagered and the Clear, Roll and Autoplay buttons, with Rules and Paytable buttons beside the balance; an RTP monitor below the table compares the rounds played with the declared figures.`,
        },
        {
          title: 'Wagers',
          body: doc`Every wager is placed before the roll and settled once the dealer stops. The main wager comes first; the side wagers follow in the felt's order. The game has no progressive wager.`,
          subsections: [
            {
              title: doc`${label(exactHit)} (main wager)`,
              body: bullets([
                doc`**When.** Before the roll. It can be placed alone, and every side wager needs it.`,
                doc`**Limits.** ${limits(exactHit)}.`,
                doc`**Wins** when the dealer's total lands exactly on the target.`,
                doc`**Pays** by the target, as the felt prints it: ${series(
                  targets.map(
                    (row) => doc`${odds(row.odds.to, row.odds.per)} on ${int(row.target)}`,
                  ),
                )}. Half-unit odds pay exactly on the table's chips: a ${money(t.unit)} wager on a target of ${int(lowTarget.target)} wins ${money(lowTarget.onUnit)}.`,
                doc`**Pushes** never.`,
                doc`**Loses** when the total passes the target.`,
              ]),
            },
            {
              title: doc`${label(firstCard)} (side wager)`,
              body: bullets([
                doc`**When.** Before the roll, only with an ${label(exactHit)} wager. The target is not known when it is placed.`,
                doc`**Limits.** ${limits(firstCard)}.`,
                doc`**Wins** when the first card alone is the target. No card is worth more than ${int(t.cardValues.highest)}, so it cannot win on a target above ${int(t.firstCardTargets)}.`,
                doc`**Pays** ${pays(onlyPay(game, firstCard))}.`,
                doc`**Pushes** never.`,
                doc`**Loses** on any other deal.`,
              ]),
            },
            {
              title: doc`${label(threePlus)} (side wager)`,
              body: bullets([
                doc`**When.** Before the roll, only with an ${label(exactHit)} wager.`,
                doc`**Limits.** ${limits(threePlus)}.`,
                doc`**Wins** when the dealer needs ${int(t.threePlusCards)} cards or more to reach or pass the target, whether the total then lands on it or passes it.`,
                doc`**Pays** ${pays(onlyPay(game, threePlus))}.`,
                doc`**Pushes** never.`,
                doc`**Loses** when one or two cards reach the target.`,
              ]),
            },
          ],
        },
        {
          title: 'Sequence of play',
          body: steps([
            doc`**Wagers.** The dealer invites wagers. Each player places ${label(exactHit)} and any side wagers, within the limits. The dealer then closes betting ("No more bets").`,
            doc`**Shuffle, if due.** If the cut card came out during the previous round, the dealer shuffles the whole shoe, has it cut and places the cut card with ${int(t.shoe.behindCutCard)} cards behind it before the round begins.`,
            doc`**Roll.** The player rolls both dice. The dealer announces their sum as the target, with what ${label(exactHit)} pays on it, and marks the target on the layout.`,
            doc`**Deal.** The dealer deals cards from the shoe face up, one at a time, announcing each card and the running total. The dealer stops as soon as the total equals or passes the target, and never deals a card once it has.`,
            doc`**Compare.** The dealer compares the final total with the target (section seven) and counts the cards dealt.`,
            doc`**Settle.** The dealer settles every wager (section eight), clears the cards to the discard rack and returns the dice for the next round.`,
          ]),
        },
        {
          title: 'Comparing the total with the target',
          body: doc`There are no hands to rank: the dealer's total is compared with the target.

${bullets([
  doc`The **total** is the sum of the cards dealt so far, the ace counting ${int(t.cardValues.lowest)}.`,
  doc`The total **hits** when it equals the target, and goes **over** when it passes it; either way the deal stops.`,
  doc`The **card count** is the number of cards the dealer needed to stop, from ${int(t.cardsPerRound.least)} to ${int(t.cardsPerRound.most)} (a target of ${int(highTarget.target)} reached by aces alone).`,
])}

Worked examples:

${bullets(
  t.examples.map(
    (row) =>
      doc`Dice ${dice(row.dice[0]!, row.dice[1]!)} (target ${int(row.target)}), ${
        row.cards.length === 1
          ? doc`one card, a ${int(row.cards[0]!)}`
          : doc`cards ${series(row.cards.map(int))} (running total ${join(row.totals.map(int), ', ')})`
      }: the total ${row.over.value === 0 ? doc`lands on the target` : doc`passes the target`}. ${settledText(game, row.results)}.`,
  ),
)}`,
        },
        {
          title: 'Settlement procedure',
          body: bullets([
            doc`The dealer settles once the deal stops: first collecting every losing wager, then paying the winners, ${label(exactHit)} first and then ${series(sides.map(label))}.`,
            doc`A winning wager is paid at its odds and keeps its stake. The tables above show what a ${money(t.unit)} wager wins on each line.`,
            doc`A pay that is not a whole number of cents (half-unit odds on an odd number of cents) is rounded down to the cent.`,
            doc`There is no fee, commission or progressive meter.`,
          ]),
        },
      ),
      {
        title: 'Physical and live-dealer adaptation',
        body: bullets([
          doc`**Dice.** The player throws from a dice cup or by hand, across the layout, so that both dice tumble and come to rest on the felt. At a table with several players, one shooter throws per round, in turn, and that one roll and one deal settle every seat; an automatic shaker, as used for Sic Bo, can replace the throw.`,
          doc`**Calls and markers.** The dealer marks the target on the layout (a puck on a printed row of targets) and announces the running total after every card, then "hit" or "over" and the card count.`,
          doc`**Shoe.** Prepare ${int(t.shoe.decks)} decks of ${text(t.shoe.lowest)} to ${text(t.shoe.highest)} (${int(t.shoe.cards)} cards: every jack, queen and king removed), shuffle, offer the cut and place the cut card with ${int(t.shoe.behindCutCard)} cards behind it. A round uses one to ${int(t.cardsPerRound.most)} cards, so the number of rounds a shoe deals varies.`,
          doc`**Card counting.** The cards are dealt face up, and ${label(exactHit)} and ${label(threePlus)} can be counted at this penetration: the Math Report measures by how much. A live table should use a continuous shuffling machine, or shuffle much earlier.`,
          doc`**The RNG version** draws the dice and the cards from a certified random number generator, deals from a virtual shoe with the same cut card (or reshuffles it every round), and settles at once; the player's tap or throw only animates the dice, and the demo lands each card face down and turns it after a short pause, which is only presentation. It has no physical irregularities. Every rule, limit and pay is the same.`,
        ]),
      },
      {
        title: 'Irregularities',
        body: bullets([
          ...diceIrregularities(),
          doc`**Exposed card.** A card exposed out of turn (dropped, flashed, turned while the shoe is handled) is burned to the discards, and dealing continues with the next card.`,
          doc`**Mis-deal.** A card dealt after the total reached the target does not count and is burned. A deal stopped too early continues until the total reaches the target; the round is not settled before it does. A card dealt before the roll is burned.`,
          shortShoe(game, doc`${int(t.cardsPerRound.most)} cards`),
        ]),
      },
    ],
    [
      ...COMMON_CONFIRM,
      doc`An exposed card is burned and dealing continues with the next card; cards dealt past the target are burned.`,
      doc`Counting: a continuous shuffler, or a much earlier shuffle, at a live table.`,
    ],
  );
}

// ─── Mirror ───

function mirror(game: Game<MirrorTable, MirrorRecords>, meta: Meta): Md {
  const t = game.table;
  const main = betById(game, 'mirror');
  const doubleSixes = betById(game, 'double-sixes');
  const fixedSides = t.bets.filter(
    (bet) => bet.kind.value === 'side' && bet.id.value !== 'double-sixes',
  );
  const six = t.dice.faces.at(-1)!;
  const meter = t.meter;
  const ranking = t.ranking;
  const pairs = ranking.filter((hand) => hand.pair.value);
  const nonPairs = ranking.filter((hand) => !hand.pair.value);
  const [higher, pairBeats, tie, fourFours] = t.examples;
  const handText = (row: Figs<MirrorTable['examples'][number]>) =>
    doc`Dice ${dice(row.dice[0]!, row.dice[1]!)} (${text(row.diceHand)}) against cards ${dice(row.cards[0]!, row.cards[1]!)} (${text(row.cardsHand)})`;
  const winsWhen: Readonly<Record<string, Md>> = {
    tie: doc`the two hands rank exactly equal: the same pair, or the same two values`,
    'equal-sums': doc`the dice and the cards add up to the same total`,
    'pair-vs-pair': doc`both hands are pairs`,
    'perfect-mirror': doc`both hands are the same pair`,
  };
  const sideRows = fixedSides.map((bet) => {
    const pay = onlyPay(game, bet);
    return [label(bet), winsWhen[bet.id.value]!, pays(pay), onUnit(pay)];
  });
  const jackpotPay = onlyPay(game, doubleSixes);
  const example = game.records.meter.figures.example;
  return document(
    game,
    meta,
    [
      ...playerSections(
        {
          title: 'Objective',
          body: doc`The player's two dice and the dealer's two cards are two hands, read the same way: a pair above any non-pair, then by sum and by the higher value. The main wager, ${label(main)}, wins when the dice outrank the cards, and side wagers pay on the two hands mirroring each other, one of them with a progressive meter.`,
        },
        {
          title: 'Equipment',
          body: bullets([
            doc`${diceLine(game)} The two dice are the player's **hand**.`,
            doc`**Shoe.** ${shoeLine(t.shoe)}. The ace counts ${int(t.shoe.ranks[0]!)} and every other card its number. The dealer's two cards are the dealer's hand.`,
            cutCardLine(t.shoe),
            doc`**Progressive meter.** A display, visible to every seat, of the Double Sixes meter (section eight).`,
            doc`**Cosmetic.** Suits never count, only values. Which die is which, and the order of the two cards, do not matter: a hand is read by its two values.`,
            doc`**Also.** The layout (section four), chips, a discard rack and, at a live table, a dice cup or shaker.`,
          ]),
        },
        {
          title: 'Table layout',
          body: doc`Each player position has one spot for the main wager, ${label(main)}, in the centre, one for each fixed-odds side wager (${series(fixedSides.map(label))}) and one for the progressive wager, ${label(doubleSixes)}. The progressive meter hangs across the top of the layout. The felt prints:

${table(
  [
    ['Spot', 'left'],
    ['Wins when', 'left'],
    ['Pays', 'right'],
    [doc`A ${money(t.unit)} wager wins`, 'right'],
  ],
  [
    [
      label(main),
      doc`the dice outrank the cards (a tie loses)`,
      pays(onlyPay(game, main)),
      onUnit(onlyPay(game, main)),
    ],
    ...sideRows,
    [
      label(doubleSixes),
      doc`both hands are ${dice(six, six)}`,
      doc`${pays(jackpotPay)} plus a share of the meter`,
      doc`${onUnit(jackpotPay)} plus stake ÷ ${money(meter.fullShareStake)} of the meter`,
    ],
  ],
)}

The demo shows this layout at [${text(game.url)}](${text(game.url)}). At the top is the mirror: the dealer's cards above the glass, the dice below it, each hand labelled as the table reads it (${text(fourFours!.diceHand)}, ${text(higher!.diceHand)}), and the glass tilting toward the winner. Below is the felt, with the meter across its top, ${label(main)} in the centre, ${label(doubleSixes)} under it and two side wagers on each side, then the chips, the balance, the total wagered and the Clear, Roll and Autoplay buttons, with Rules and Paytable buttons beside the balance; an RTP monitor below the table compares the rounds played with the declared figures. The lobby shows the live meter on the table's card.`,
        },
        {
          title: 'Wagers',
          body: doc`Every wager is placed before the roll and settled once both hands are known. The main wager comes first, the fixed-odds side wagers next and the progressive wager last.`,
          subsections: [
            {
              title: doc`${label(main)} (main wager)`,
              body: bullets([
                doc`**When.** Before the roll. It can be placed alone, and every side wager needs it.`,
                doc`**Limits.** ${limits(main)}.`,
                doc`**Wins** when the dice outrank the cards (section seven).`,
                doc`**Pays** ${pays(onlyPay(game, main))}.`,
                doc`**Pushes** never: a tie loses.`,
                doc`**Loses** when the cards outrank the dice or the hands tie.`,
              ]),
            },
            ...fixedSides.map((bet) => ({
              title: doc`${label(bet)} (side wager)`,
              body: bullets([
                doc`**When.** Before the roll, only with a ${label(main)} wager.`,
                doc`**Limits.** ${limits(bet)}.`,
                doc`**Wins** when ${winsWhen[bet.id.value]}.`,
                doc`**Pays** ${pays(onlyPay(game, bet))}.`,
                doc`**Pushes** never.`,
                doc`**Loses** otherwise.`,
              ]),
            })),
            {
              title: doc`${label(doubleSixes)} (progressive side wager)`,
              body: bullets([
                doc`**When.** Before the roll, only with a ${label(main)} wager. ${pct(meter.contributionRate, 0)} of the stake goes into the meter as the wager is accepted, win or lose.`,
                doc`**Limits.** ${limits(doubleSixes)}.`,
                doc`**Wins** when both hands are ${dice(six, six)}: the dice a pair of ${int(six)}s and the dealer's two cards both ${int(six)}s.`,
                doc`**Pays** ${pays(jackpotPay)} on the stake, plus the stake's share of the meter: stake ÷ ${money(meter.fullShareStake)} of it, so the whole meter at the ${money(doubleSixes.max)} maximum and ${pct(meter.minimumShare, 0)} of it at the ${money(doubleSixes.min)} minimum.`,
                doc`**Pushes** never.`,
                doc`**Loses** otherwise; its contribution to the meter stays in the meter.`,
              ]),
            },
          ],
        },
        {
          title: 'Sequence of play',
          body: steps([
            doc`**Wagers.** The dealer invites wagers. Each player places ${label(main)} and any side wagers, within the limits, and the dealer closes betting ("No more bets"). The meter is raised by ${pct(meter.contributionRate, 0)} of every ${label(doubleSixes)} stake.`,
            doc`**Shuffle, if due.** If the cut card came out during the previous round, the dealer shuffles the whole shoe, has it cut and places the cut card with ${int(t.shoe.behindCutCard)} cards behind it before the round begins.`,
            doc`**Roll.** The player rolls both dice. The dealer announces the player's hand ("${text(fourFours!.diceHand)}", "${text(higher!.diceHand)}").`,
            doc`**Deal.** The dealer deals two cards from the shoe, face down, then turns them over one at a time and announces the dealer's hand.`,
            doc`**Compare.** The dealer compares the two hands (section seven) and announces the winner, or a tie, and the side wagers that win.`,
            doc`**Settle.** The dealer settles every wager (section eight), pays any ${label(doubleSixes)} win from the meter, clears the cards and returns the dice.`,
          ]),
        },
        {
          title: 'Hand ranking',
          body: doc`A hand is two values from ${int(t.dice.faces[0]!)} to ${int(six)}, and the dice and the cards are ranked the same way:

${steps([
  doc`A **pair** beats any non-pair, and a higher pair beats a lower one: from ${text(pairs[0]!.label)} down to ${text(pairs.at(-1)!.label)}.`,
  doc`Between two non-pairs, the higher **sum** wins; on equal sums, the higher of the two values wins. The table calls such a hand by its sum and its higher value: ${text(nonPairs[0]!.label)} is a ${int(nonPairs[0]!.high)} and a ${int(nonPairs[0]!.low)}.`,
  doc`Two hands still level hold the same two values: a **tie**, which the house wins on the main wager.`,
])}

From the strongest down: ${series(
            ranking.map((hand) => text(hand.label)),
            ', ',
          )}. Even ${text(pairs.at(-1)!.label)} beats ${text(nonPairs[0]!.label)}.

Worked examples:

${bullets([
  doc`${handText(higher!)}: equal sums, and the dice's higher value is higher. The dice win: ${settledText(game, higher!.results)}.`,
  doc`${handText(pairBeats!)}: a pair beats any non-pair. The dice win: ${settledText(game, pairBeats!.results)}.`,
  doc`${handText(tie!)}: the same two values, a tie. ${settledText(game, tie!.results)}.`,
  doc`${handText(fourFours!)}: the same pair, a tie. ${settledText(game, fourFours!.results)}.`,
])}`,
        },
        {
          title: 'Settlement procedure',
          body: bullets([
            doc`The dealer settles once both hands are known: first collecting every losing wager, then paying the winners in the felt's order, ${label(main)} first, the fixed-odds side wagers next and ${label(doubleSixes)} last. A winning wager is paid at its odds and keeps its stake.`,
            doc`**The meter.** It starts at its seed, ${money(meter.seed)}, and grows by ${pct(meter.contributionRate, 0)} of every ${label(doubleSixes)} stake, credited as the wager is accepted: the house funds it out of the stakes it holds, and a winning wager is still paid on its whole stake.`,
            doc`**A hit** pays ${pays(jackpotPay)} on the stake from the table's bank, plus the stake ÷ ${money(meter.fullShareStake)} share of the meter, rounded down to the cent, from the meter. The round's own contribution is already in the meter when the share is taken.`,
            doc`**After a hit** the meter is decreased by the share paid and keeps the rest, down to the fraction of a cent. If it falls below the seed, the house tops it back up to ${money(meter.seed)}.`,
            doc`**Example.** ${money(example.stake)} on ${label(doubleSixes)} with the meter at ${money(example.meterBefore)}: the stake takes it to ${money(example.meterAtHit)}. Both hands are ${dice(six, six)}: the wager wins ${money(example.fixedWin)} at ${pays(jackpotPay)} plus ${money(example.share)} from the meter, and keeps its stake. The meter keeps ${money(example.meterAfterShare)}, which the house tops up to ${money(example.meterAfter)}.`,
            doc`A fixed pay that is not a whole number of cents is rounded down to the cent; with these odds it never is.`,
          ]),
        },
      ),
      {
        title: 'Physical and live-dealer adaptation',
        body: bullets([
          doc`**Dice.** The player throws from a dice cup or by hand, across the layout, so that both dice tumble and come to rest on the felt. At a table with several players, one shooter throws per round, in turn, and that one roll and one pair of cards settle every seat; an automatic shaker, as used for Sic Bo, can replace the throw.`,
          doc`**Calls.** The dealer announces both hands by the table's names ("${text(higher!.diceHand)} against ${text(higher!.cardsHand)}: the dice win").`,
          doc`**Shoe.** Prepare ${int(t.shoe.decks)} decks of ${text(t.shoe.lowest)} to ${text(t.shoe.highest)} (${int(t.shoe.cards)} cards), shuffle, offer the cut and place the cut card with ${int(t.shoe.behindCutCard)} cards behind it. With two cards a round, a shoe deals ${int(t.roundsPerShoe)} rounds.`,
          doc`**Meter.** A meter display driven by the table's controller (or a network of tables sharing one meter), credited with every ${label(doubleSixes)} contribution as betting closes. A hit is verified by a supervisor before the meter is paid, as for any progressive.`,
          doc`**Several winners.** When several seats win ${label(doubleSixes)} in the same round, each seat is due stake ÷ ${money(meter.fullShareStake)} of the meter as it stood before the round's payments; if those shares add up to more than the whole meter, the meter is divided among the seats in proportion to their stakes.`,
          doc`**Card counting.** The cards are dealt openly, and ${label(main)} and ${label(doubleSixes)} can be counted at this penetration: the Math Report measures by how much. A live table should use a continuous shuffling machine, or shuffle much earlier.`,
          doc`**The RNG version** draws the dice and the cards from a certified random number generator, deals from a virtual shoe with the same cut card (or reshuffles it every round), keeps the meter to a millionth of a cent and settles at once; the player's tap or throw only animates the dice. It has no physical irregularities. Every rule, limit and pay is the same.`,
        ]),
      },
      {
        title: 'Irregularities',
        body: bullets([
          ...diceIrregularities(),
          doc`**Exposed card.** A card exposed before the roll is burned to the discards, and the round proceeds with the next cards. One of the round's two cards dealt face up instead of face down stands: facing them down is only presentation.`,
          doc`**Mis-deal.** Only the first two cards dealt after the roll count; any further card, or a card dealt before the roll, is burned.`,
          doc`**Meter fault.** If the meter display fails, the controller's record of the meter decides the share paid.`,
          shortShoe(game, doc`two cards`),
        ]),
      },
    ],
    [
      ...COMMON_CONFIRM,
      doc`Several ${label(doubleSixes)} winners in one round share the meter in proportion to their stakes when their shares exceed it.`,
      doc`A supervisor verifies every ${label(doubleSixes)} hit before the meter is paid.`,
      doc`An exposed card is burned; the round's card dealt face up in error stands; extra cards are burned.`,
      doc`Counting: a continuous shuffler, or a much earlier shuffle, at a live table.`,
    ],
  );
}

// ─── Lock & Roll ───

function lockAndRoll(game: Game<LockAndRollTable>, meta: Meta): Md {
  const t = game.table;
  const bet = t.bets[0]!;
  const fee = t.fee;
  const free = dice(fee.freeRoll[0]!, fee.freeRoll[1]!);
  const [win, tie, loss] = t.examples;
  const exampleText = (row: Figs<LockAndRollTable['examples'][number]>): Md => {
    const roll = dice(row.roll[0]!, row.roll[1]!);
    const decision =
      row.choice.value === 'stand'
        ? doc`The player stands on ${int(row.diceTotal)}`
        : doc`The player locks the ${int(row.kept!)} and re-rolls the ${int(row.rerolled!)}${row.fee.value === 0 ? doc`, free on ${roll}` : doc` for ${money(row.fee)}`}; it lands on ${int(row.landed!)}, for ${int(row.diceTotal)}`;
    const cards = doc`the dealer deals a ${int(row.cards[0]!)} and a ${int(row.cards[1]!)}, for ${int(row.cardsTotal)}`;
    const verdict =
      row.result.value === 'win'
        ? doc`the dice are higher and the wager wins ${money(row.bet)}`
        : row.tie.value
          ? doc`a tie, which the house wins`
          : doc`the cards are higher and the wager loses`;
    return doc`Wager ${money(row.bet)}, roll ${roll}. ${decision}; ${cards}: ${verdict}. The round nets ${signedMoney(row.net)} for the player${
      row.fee.value === 0 ? '' : doc`, the fee included`
    }.`;
  };
  return document(
    game,
    meta,
    [
      ...playerSections(
        {
          title: 'Objective',
          body: doc`The player rolls two dice and may, once, lock one die and re-roll the other for a fee; the dealer then deals two cards. The wager wins even money when the dice total more than the cards, and equal totals go to the house.`,
        },
        {
          title: 'Equipment',
          body: bullets([
            doc`${diceLine(game)} Their **total** runs from ${int(t.totals.lowest)} to ${int(t.totals.highest)}.`,
            doc`**Shoe.** ${shoeLine(t.shoe)}. The ace counts ${int(t.shoe.ranks[0]!)} and every other card its number. The dealer's two cards make the dealer's total.`,
            cutCardLine(t.shoe),
            doc`**Lock marker.** A marker (a padlock puck, or a marked spot on the layout) set on the die the player locks.`,
            doc`**Cosmetic.** Suits never count, only values, and the order of the dealer's two cards does not matter. Which die is which matters only for the decision: the player says which one to lock.`,
            doc`**Also.** The layout (section four), chips, a discard rack and, at a live table, a dice cup or shaker.`,
          ]),
        },
        {
          title: 'Table layout',
          body: doc`Each player position has a single spot, for the ${label(bet)} wager, with the house rules printed beside it: "Ties lose", "Lock fee: ${pct(fee.rate, 0)} of the bet", "${free} re-rolls free". A fee area next to the spot takes the Lock fee. The felt prints the one pay:

${table(
  [
    ['Spot', 'left'],
    ['Wins when', 'left'],
    ['Pays', 'right'],
    [doc`A ${money(t.unit)} wager wins`, 'right'],
  ],
  [
    [
      label(bet),
      doc`the dice total more than the cards`,
      pays(onlyPay(game, bet)),
      onUnit(onlyPay(game, bet)),
    ],
  ],
)}

The demo shows this layout at [${text(game.url)}](${text(game.url)}). At the top are the dealer's cards, the two totals side by side (the dice's and the cards', the higher one lit at the end) and the dice. Under the dice is the decision: Stand, and Lock with its fee once a die is locked (the dice are the lock buttons: tapping one puts a padlock on it), with a Strategy hint switch, off by default, which shows what the reference strategy would play. Below is the felt with the one wager and its printed rules, then the chips, the balance, the total wagered and the Clear, Roll and Autoplay buttons, with Rules and Paytable buttons beside the balance; an RTP monitor below the table compares the rounds played with the declared figures.`,
        },
        {
          title: 'Wagers',
          body: doc`The game has one wager and no side or progressive wager. The Lock fee is not a wager: nothing is paid on it.`,
          subsections: [
            {
              title: doc`${label(bet)} (main wager)`,
              body: bullets([
                doc`**When.** Before the roll.`,
                doc`**Limits.** ${limits(bet)}.`,
                doc`**Wins** when the dice's total, after the player's decision, is higher than the dealer's two cards.`,
                doc`**Pays** ${pays(onlyPay(game, bet))}.`,
                doc`**Pushes** never: equal totals lose.`,
                doc`**Loses** when the cards' total is equal or higher.`,
              ]),
            },
            {
              title: 'The Lock fee (not a wager)',
              body: bullets([
                doc`**What.** The price of locking one die and re-rolling the other: ${pct(fee.rate, 0)} of the wager (${money(fee.onUnit)} on a ${money(fee.unit)} wager), rounded up to the cent. It is a whole number of cents on any wager that is a multiple of ${money(fee.exactOn)}.`,
                doc`**Free on ${free}.** A roll of ${free} re-rolls for free.`,
                doc`**Never returned**, whatever the result, and nothing is paid on it: a winning wager is paid ${pays(onlyPay(game, bet))} on the wager alone.`,
              ]),
            },
          ],
        },
        {
          title: 'Sequence of play',
          body: steps([
            doc`**Wager.** The dealer invites wagers; each player places a ${label(bet)} wager within the limits, and the dealer closes betting ("No more bets").`,
            doc`**Shuffle, if due.** If the cut card came out during the previous round, the dealer shuffles the whole shoe, has it cut and places the cut card with ${int(t.shoe.behindCutCard)} cards behind it before the round begins.`,
            doc`**Roll.** The player rolls both dice. The dealer announces the roll and its total.`,
            doc`**Decision, once.** Before any card is dealt, the player chooses:

   - **Stand**: keep the roll; or
   - **Lock**: name one die to keep (the dealer sets the lock marker on it), place the Lock fee, ${pct(fee.rate, 0)} of the wager, in the fee area (nothing on ${free}), and re-roll the other die once. The re-rolled die is final.

   There is one decision per round. A player who has not decided when the dealer calls time stands: no fee is taken without the player's choice.`,
            doc`**Collect the fee.** The dealer takes each Lock fee as the lock is made, before the re-roll.`,
            doc`**Re-roll.** The locking player re-rolls the unlocked die; the dealer announces the new total.`,
            doc`**Deal.** The dealer deals two cards from the shoe, face up, and announces their total.`,
            doc`**Compare.** The dealer compares the dice's total with the cards' total (section seven).`,
            doc`**Settle.** The dealer settles the wager (section eight), clears the cards and returns the dice.`,
          ]),
        },
        {
          title: 'Comparing the totals',
          body: doc`There are no hands to rank: the dice's total, after the decision, is compared with the dealer's two cards.

${bullets([
  doc`The dice's total is the sum of the two dice as they stand after the decision: the roll if the player stood, the locked die and the re-rolled die otherwise.`,
  doc`The dealer's total is the sum of the two cards, the ace counting ${int(t.shoe.ranks[0]!)}.`,
  doc`A higher dice total wins; an equal or lower one loses. There is no push.`,
])}

Worked examples:

${bullets([exampleText(win!), exampleText(tie!), exampleText(loss!)])}`,
        },
        {
          title: 'Settlement procedure',
          body: bullets([
            doc`**The Lock fee** is collected when the player locks, before the re-roll, and is never returned: it is already the house's when the cards are dealt.`,
            doc`**The wager** is settled once the cards are dealt: a losing wager is collected; a winning one is paid ${pays(onlyPay(game, bet))} and keeps its stake. Nothing is paid on the fee.`,
            doc`With several players, the dealer collects every losing wager first, then pays the winners.`,
            doc`There is no progressive meter.`,
          ]),
        },
      ),
      {
        title: 'Physical and live-dealer adaptation',
        body: bullets([
          doc`**Dice.** The player throws from a dice cup or by hand, across the layout. At a table with several players, one roll (from a shooter in turn, or an automatic shaker) serves every seat; each seat then decides on its own. The re-roll becomes one more die, rolled once for every seat that locked: each of those seats keeps the die it locked and adds the new die.`,
          doc`**Timing.** The dealer calls for decisions after the roll and closes them before the re-roll; seats that have not decided stand. The cards are dealt only after the re-roll.`,
          doc`**Calls.** The dealer announces the roll, the decisions and fees taken, the re-rolled die, the cards' total and the result.`,
          doc`**Shoe.** Prepare ${int(t.shoe.decks)} decks of ${text(t.shoe.lowest)} to ${text(t.shoe.highest)} (${int(t.shoe.cards)} cards), shuffle, offer the cut and place the cut card with ${int(t.shoe.behindCutCard)} cards behind it. With two cards a round, a shoe deals ${int(t.roundsPerShoe)} rounds.`,
          doc`**Card counting.** The cards are dealt face up, and the wager can be counted at this penetration: the Math Report measures by how much. A live table should use a continuous shuffling machine, or shuffle much earlier.`,
          doc`**The RNG version** draws the dice, the re-roll and the cards from a certified random number generator, deals from a virtual shoe with the same cut card (or reshuffles it every round) and settles at once. The player taps a die to lock it; if the table closes before the player decides, the round finishes as a Stand. The optional Strategy hint and autoplay follow the reference strategy. It has no physical irregularities. Every rule, limit and pay is the same.`,
        ]),
      },
      {
        title: 'Irregularities',
        body: bullets([
          ...diceIrregularities(
            doc` (on the re-roll, only the re-rolled die: the locked die stays)`,
          ),
          doc`**Exposed card.** A card exposed before the decisions are made would inform them: it is burned to the discards, the decisions go ahead, and the round is dealt from the next cards. A card exposed after the decisions is burned too.`,
          doc`**Mis-deal.** Only the first two cards dealt after the re-roll count; a card dealt before the decisions or the re-roll, or any further card, is burned.`,
          doc`**Wrong die re-rolled.** If the locked die is thrown instead of the other, both dice are set back as they were before the decision and the right die is re-rolled; the fee stands.`,
          shortShoe(game, doc`two cards`),
        ]),
      },
    ],
    [
      ...COMMON_CONFIRM,
      doc`Undecided seats stand when the dealer calls time, and pay no fee.`,
      doc`At a multi-seat table, one extra die, rolled once, serves every seat that locked.`,
      doc`A card exposed before the decisions is burned and the decisions go ahead.`,
      doc`A die thrown by mistake is set back and the right die re-rolled, the fee standing.`,
      doc`Counting: a continuous shuffler, or a much earlier shuffle, at a live table.`,
    ],
  );
}

export function rulesOfPlay(results: Figs<Results>): Readonly<Record<string, Md>> {
  const { meta, games } = results;
  return {
    'dice-spread': diceSpread(games['dice-spread'], meta),
    'moving-target': movingTarget(games['moving-target'], meta),
    mirror: mirror(games.mirror, meta),
    'lock-and-roll': lockAndRoll(games['lock-and-roll'], meta),
  };
}

export type { Fig };
