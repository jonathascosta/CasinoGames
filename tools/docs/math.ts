/**
 * The Math Report: one document per game for a gaming-lab mathematician or
 * a distributor's analyst. Every figure comes from the game's mathSummary()
 * or from a figure its tests recorded (results.ts), and every table names
 * the test that reproduces it. figures.ts keeps every number out of the
 * text below.
 */
import type { Md } from './figures.ts';
import {
  dice,
  doc,
  frac,
  fracNum,
  int,
  join,
  money,
  moneyExact,
  num,
  odds,
  pct,
  points,
  pp,
  spread,
  text,
  times,
  type Fig,
  type Figs,
  type Part,
} from './figures.ts';
import {
  bullets,
  facts,
  paragraphs,
  sections,
  series,
  table,
  type Align,
  type Section,
} from './markdown.ts';
import type {
  Counting,
  DiceSpreadRecords,
  DiceSpreadTable,
  Exact,
  ExactFigures,
  Exposure,
  GameResults,
  LockAndRollRecords,
  LockAndRollTable,
  MirrorRecords,
  MirrorTable,
  MovingTargetRecords,
  MovingTargetTable,
  OutcomeRow,
  Recorded,
  Results,
  Simulation,
  SourceRecord,
  Statistics,
  Table,
  TargetRow,
  Verification,
} from './results.ts';

type Meta = Figs<Results['meta']>;
type Game<T extends Table, R> = Figs<GameResults<T, R>>;
type TestRecord = Figs<Recorded<unknown>>;
type BetMath = Figs<GameResults<Table, unknown>['summary']['bets'][number]>;

// ─── Shared pieces ───

/** "Reproduced by `file` › suite › test." */
function cite(...records: readonly TestRecord[]): Md {
  const one = (record: TestRecord) =>
    doc`\`${text(record.test.file)}\` › ${text(record.test.name)}`;
  return doc`_Reproduced by ${join(records.map(one), '; ')}._`;
}

/** An exact figure: "26/27 (96.2963%)". */
const exactPct = (figure: Figs<Exact>, digits = 4) =>
  doc`${frac(figure.fraction)} (${pct(figure.value, digits)})`;

function outcomeTable(rows: readonly Figs<OutcomeRow>[]): Md {
  return table(
    [
      ['Outcome', 'left'],
      ['Probability', 'right'],
      ['Exactly', 'right'],
      ['Pays', 'right'],
      ['Returns per unit', 'right'],
      ['Contribution to RTP', 'right'],
    ],
    rows.map((row) => [
      text(row.label),
      pct(row.probability.value, 4),
      frac(row.probability.fraction),
      row.odds !== undefined
        ? odds(row.odds.to, row.odds.per)
        : row.entry.value === 'push'
          ? 'push'
          : 'loses',
      frac(row.returns.fraction),
      frac(row.contribution.fraction),
    ]),
  );
}

function exactTotals(figures: Figs<ExactFigures>, push: boolean): Md {
  return bullets([
    doc`**Total return (RTP):** ${exactPct(figures.rtp)}, the sum of the contributions.`,
    doc`**House edge:** ${exactPct(figures.houseEdge)}.`,
    doc`**Variance** of the net result per unit staked: ${frac(figures.variance.fraction)} (${num(figures.variance.value, 4)}); **standard deviation** ${num(figures.standardDeviation, 4)}.`,
    doc`**Hit frequency** (the wager wins): ${exactPct(figures.hitFrequency)}${push ? doc`; **push frequency** ${exactPct(figures.pushFrequency)}` : ''}.`,
  ]);
}

function documentFacts(game: Game<Table, unknown>, meta: Meta): Md {
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
    ['Document', doc`Math Report, revision ${text(game.revision.revision)}`],
    ['Date', text(game.revision.date)],
    ['Author', text(meta.author)],
    [
      'Code',
      doc`commit \`${text(meta.commit)}\` (${text(meta.commitDate)}): the last change to the engine, its tests or their recorded results`,
    ],
    [
      'Figures',
      doc`\`docs/results.json\`, written with this report by \`${text(meta.generator)}\``,
    ],
    ['Companion', doc`Rules of Play (\`docs/rules/${text(game.id)}.md\`)`],
  ])}

**Revision history**

${history}

**How to read this report.** Every figure is read from \`docs/results.json\`, which the generator builds from the game's \`mathSummary()\` (the declared figures) and from the figures its tests record (\`packages/engine/src/games/${text(game.id)}/results/\`); the generator fails if a document holds a number that is not in it. Each table names the test that reproduces it, as file › suite › test: \`pnpm test\` runs the exact tests and \`pnpm test:math\` the simulations, and each fails if it no longer reproduces its recorded figures. Returns are per unit staked, the stake included; exact figures are fractions, rounded percentages beside them.`;
}

function document(game: Game<Table, unknown>, meta: Meta, body: readonly Section[]): Md {
  return doc`# ${text(game.name)} — Math Report

_${text(game.tagline)}_

${sections([{ title: 'Cover', body: documentFacts(game, meta) }, ...body])}
`;
}

function summarySection(
  bets: readonly BetMath[],
  exposure: Figs<Exposure>,
  notes: readonly Part[],
  source: TestRecord,
): Section {
  const push = bets.some((bet) => bet.pushFrequency !== undefined);
  const columns: [Part, Align][] = [
    ['Wager', 'left'],
    ['RTP', 'right'],
    ['House edge', 'right'],
    ['Hit frequency', 'right'],
    ...(push ? ([['Push frequency', 'right']] as [Part, Align][]) : []),
    ['SD per unit', 'right'],
    ['Max payout', 'right'],
    ['Max exposure at max bet', 'right'],
  ];
  const rows = bets.map((bet) => {
    const most = exposure.bets[bet.betId.value]!;
    const multiple =
      bet.maxExposure !== undefined
        ? times(bet.maxExposure)
        : doc`${times(bet.progressive!.maxExposureAtSeed)} at the seed`;
    return [
      doc`${text(bet.label)} (${text(bet.kind)})`,
      pct(bet.rtp, 4),
      pct(bet.houseEdge, 4),
      bet.hitFrequency === undefined ? '—' : pct(bet.hitFrequency, 4),
      ...(push ? [bet.pushFrequency === undefined ? '—' : pct(bet.pushFrequency, 4)] : []),
      bet.standardDeviation === undefined ? '—' : num(bet.standardDeviation, 4),
      multiple,
      doc`${money(most.win)} (on ${money(bet.max)})`,
    ];
  });
  return {
    title: 'Summary',
    body: doc`${table(columns, rows)}

${bullets([
  doc`**RTP** and **house edge** are per unit staked, pushes included. **Hit frequency** is the chance that the wager wins in a round${push ? '; **push frequency**, that the stake is simply returned' : ''}. **SD per unit** is the standard deviation of the net result per unit staked.`,
  doc`**Max payout** is the largest net win per unit staked, the stake being returned on top. **Max exposure at max bet** is the most a single wager at its maximum can win in a round, found by running the real game over every outcome at the table maximums; all the wagers of one position together can win at most ${money(exposure.layout.win)} in a round.`,
  ...notes,
])}

${cite(source)} The declared figures are \`mathSummary()\` (bets.ts); the test holds them equal to the enumeration.`,
  };
}

function sourceText(source: Figs<SourceRecord>): Md {
  if (source.kind.value === 'shoe') {
    const shoe = source as Figs<Extract<SourceRecord, { kind: 'shoe' }>>;
    return doc`the ${int(shoe.decks)}-deck shoe of ${int(shoe.cards)} cards, ranks ${int(shoe.ranks[0]!)} to ${int(shoe.ranks.at(-1)!)}, with its cut card after ${int(shoe.cutCard)} cards (penetration ${pct(shoe.penetration, 0)}) and reshuffles, as the production game deals it`;
  }
  const ranks = source.ranks;
  return source.kind.value === 'infinite shoe'
    ? doc`an infinite shoe (every card drawn independently and uniformly from one deck of ranks ${int(ranks[0]!)} to ${int(ranks.at(-1)!)} in ${int((source as Figs<Extract<SourceRecord, { kind: 'infinite shoe' }>>).suits)} suits)`
    : doc`uniform ranks ${int(ranks[0]!)} to ${int(ranks.at(-1)!)} (an infinite shoe's values, one draw per card)`;
}

type Stakes = Figs<Readonly<Record<string, number>>>;

/** A simulation's stakes: one set every round, or several sets in turn. */
function stakeSets(simulation: Figs<Simulation>): readonly Stakes[] {
  const stakes = simulation.stakes as unknown as Stakes | readonly Stakes[];
  return Array.isArray(stakes) ? (stakes as readonly Stakes[]) : [stakes as Stakes];
}

/** A simulation's facts: rounds, RNG and seed, card source, stakes, criterion. */
function simulationFacts(simulation: Figs<Simulation>, stakes: Part, criterion: Part): Md {
  return facts([
    ['Rounds', int(simulation.rounds)],
    ['Generator', text(simulation.rng)],
    ['Seed', doc`\`${text(simulation.seed)}\``],
    ['Cards', sourceText(simulation.source)],
    ['Stakes', stakes],
    ['Criterion', criterion],
  ]);
}

function verificationRow(label: Part, check: Figs<Verification>, digits = 3): Part[] {
  return [
    label,
    pct(check.observed, digits),
    pct(check.expected, digits),
    pp(check.difference, digits),
    points(check.standardError, digits),
    doc`${pct(check.ci95[0]!, digits)} to ${pct(check.ci95[1]!, digits)}`,
    doc`±${points(check.allowed, digits)}`,
    check.pass.value ? '**pass**' : '**fail**',
  ];
}

/** The columns of a verification table; the confidence level is the simulation's. */
function verificationColumns(simulation: Figs<Simulation>): readonly (readonly [Part, Align])[] {
  return [
    ['Figure', 'left'],
    ['Observed', 'right'],
    ['Expected', 'right'],
    ['Difference', 'right'],
    ['Standard error', 'right'],
    [doc`${pct(simulation.confidence.level, 0)} confidence interval`, 'right'],
    ['Allowed', 'right'],
    ['Result', 'left'],
  ];
}

/** How the confidence interval relates to a test's own criterion. */
function intervalNote(simulation: Figs<Simulation>): Md {
  return doc`The ${pct(simulation.confidence.level, 0)} confidence interval is the observed value ± ${num(simulation.confidence.z, 2)} standard errors, and at that level about one figure in twenty falls outside its interval by chance. The tests' own criterion, "Allowed" above, is wider: ${num(simulation.z, 2)} standard errors, or a fixed tolerance.`;
}

function stakesText(stakes: Figs<Readonly<Record<string, number>>>, bets: readonly BetMath[]): Md {
  return series(
    bets
      .filter((bet) => stakes[bet.betId.value] !== undefined)
      .map((bet) => doc`${text(bet.label)} ${money(stakes[bet.betId.value]!)}`),
  );
}

function countingRows(rows: readonly (readonly [Part, Figs<Counting>])[]): Part[][] {
  return rows.map(([label, counting]) => [
    label,
    pct(counting.favourable, 2),
    counting.favourable.value === 0 ? '—' : pct(counting.edgeWhenFavourable, 1),
    counting.breakEvenSpread.value === null ? '—' : spread(counting.breakEvenSpread),
  ]);
}

const COUNTING_COLUMNS: readonly (readonly [Part, Align])[] = [
  ['Wager', 'left'],
  ['Rounds favouring a perfect counter', 'right'],
  ['Counter’s edge in them', 'right'],
  ['Break-even bet spread', 'right'],
];

const ROUNDING = doc`**Rounding.** Winnings are paid to the cent, rounded down (the engine's \`winnings()\`); the declared figures assume exact pays. Every odds in these games has a denominator of one or two, so a wager in multiples of the minimum pays exactly and the rounding never applies at the table's stakes.`;
const PLAYER_ERROR = doc`**No player or dealer error** is modelled, nor any irregularity: the figures are those of the rules as the engine settles them.`;
const INDEPENDENCE = doc`**Independence.** The dice and the cards are independent: the RNG draws each die and each card separately (a live table uses separate devices), and nothing about the dice changes the shoe. Within a round the cards are dealt from one shoe, which the finite-shoe figures account for.`;
const RNG_ASSUMPTION = doc`**Randomness.** The analysis assumes a certified RNG: every die face and every card position equally likely and independent. The engine draws integers by rejection sampling, without modulo bias, and shuffles by Fisher–Yates in a specified order.`;

function notApplicable(what: Part): Section {
  return {
    title: 'Progressive analysis',
    body: doc`Not applicable: ${what} has no progressive wager.`,
  };
}

// ─── Dice Spread ───

function diceSpread(game: Game<DiceSpreadTable, DiceSpreadRecords>, meta: Meta): Md {
  const { summary, records, table: t } = game;
  const exact = records.exact.figures;
  const mc = records['monte-carlo'].figures;
  const counting = records.counting.figures;
  const enumeration = records.enumeration.figures;
  const bets = summary.bets;
  const faces = t.dice.faces;
  const [low, high] = [faces[0]!, faces.at(-1)!];
  const between = bets[0]!;
  const minSpread = t.spreads[0]!.spread;
  const conditions: Readonly<Record<string, Md>> = {
    between: doc`S ≥ ${int(minSpread)} and L < c < H, paid by S; a push when S < ${int(minSpread)}`,
    match: doc`c = d₁ or c = d₂`,
    bullseye: doc`S = ${int(minSpread)} and c is the value midway between L and H`,
    doubles: doc`d₁ = d₂`,
    triple: doc`d₁ = d₂ = c`,
  };
  const perWager: Section[] = bets.map((bet) => {
    const figures = exact.bets[bet.betId.value]!;
    return {
      title: doc`${text(bet.label)} (${text(bet.kind)})`,
      body: doc`**Wins** when ${conditions[bet.betId.value]}. **Method:** exact enumeration of the production game over Ω.

${outcomeTable(figures.outcomes)}

${exactTotals(figures, figures.pushFrequency.value.value !== 0)}

${cite(records.exact)}`,
    };
  });
  const penetrationRows = counting.penetrations.map((row) => [
    doc`${pct(row.penetration, 0)}${row.penetration.value === t.shoe.penetration.value ? ' (the table)' : ''}`,
    int(row.rounds),
    pct(row.bets.between!.favourable, 2),
    pct(row.bets.between!.edgeWhenFavourable, 2),
    spread(row.bets.between!.breakEvenSpread as Fig<number>),
    pct(row.bets.bullseye!.favourable, 2),
  ]);
  const cardValueRows = t.shoe.ranks.map((rank, index) => [
    int(rank),
    ...counting.countable.map((bet) => fracNum(counting.cardValues[bet.value]![index]!, 4)),
  ]);
  return document(game, meta, [
    summarySection(bets, exact.maxExposure, [], records.exact),
    {
      title: 'Game model',
      body: bullets([
        doc`**Sample space.** Ω = D × C. D is the ordered pair of dice (d₁, d₂), each uniform on ${int(low)} to ${int(high)}: ${int(exact.sampleSpace.rolls)} equally likely rolls. C is the value c of the one card, uniform on ${int(low)} to ${int(high)}. |Ω| = ${int(exact.sampleSpace.outcomes)} equally likely outcomes; with the card's suit as well, ${int(exact.sampleSpace.withSuits)}, which the exact test also enumerates and which gives the same fractions. Write L and H for the lower and higher die and S = H − L for the spread.`,
        doc`**Card supply.** The declared figures take the card uniform over its ${int(exact.sampleSpace.cardValues)} values, independent of the dice: an infinite shoe. That is also exactly what the table's ${int(t.shoe.decks)}-deck shoe returns in the long run to a player who bets the same way every round: each round deals one card and the cut card always comes out after ${int(t.shoe.cutCard)} cards, so the rounds a shoe deals never depend on the cards, and over all shuffles the card of any given round is uniform over the values (section six confirms it by simulation).`,
        doc`**Decisions.** None: every wager is settled by the roll and the card.`,
      ]),
    },
    { title: 'Per-wager analysis', subsections: perWager },
    notApplicable(text(game.name)),
    {
      title: 'Finite-shoe effects',
      body: doc`As section three shows, the ${int(t.shoe.decks)}-deck shoe at ${pct(t.shoe.penetration, 0)} penetration returns exactly the declared figures to a flat bettor: there is no finite-shoe shift to measure, only its absence to confirm. The simulation of section seven deals from that shoe, with its cut card and reshuffles:

${table(
  [
    ['Wager', 'left'],
    ['RTP, declared', 'right'],
    ['RTP, six-deck shoe (observed)', 'right'],
    ['Difference', 'right'],
    ['Standard error', 'right'],
  ],
  bets.map((bet) => {
    const check = mc.bets[bet.betId.value]!.rtp;
    return [
      text(bet.label),
      pct(check.expected, 3),
      pct(check.observed, 3),
      pp(check.difference, 3),
      points(check.standardError, 3),
    ];
  }),
)}

Every difference lies within the run's noise. ${cite(records['monte-carlo'])}`,
    },
    {
      title: 'Simulation verification',
      body: doc`${simulationFacts(
        mc.simulation,
        doc`every wager at its minimum each round: ${stakesText(stakeSets(mc.simulation)[0]!, bets)}`,
        doc`each RTP within ±${points(mc.simulation.tolerance!, 2)} of the declared figure, and each hit and push frequency within ${num(mc.simulation.z, 2)} binomial standard errors; the round count makes ±${points(mc.simulation.tolerance!, 2)} equal to ${num(mc.simulation.z, 2)} standard errors for the most volatile wager`,
      )}

${table(
  verificationColumns(mc.simulation),
  bets.flatMap((bet) => {
    const result = mc.bets[bet.betId.value]!;
    return [
      verificationRow(doc`${text(bet.label)}, RTP`, result.rtp),
      verificationRow(doc`${text(bet.label)}, hit frequency`, result.hitFrequency),
      ...(bet.pushFrequency === undefined
        ? []
        : [verificationRow(doc`${text(bet.label)}, push frequency`, result.pushFrequency)]),
    ];
  }),
)}

${intervalNote(mc.simulation)} ${cite(records['monte-carlo'])}`,
    },
    {
      title: 'Assumptions and limitations',
      body: paragraphs([
        INDEPENDENCE,
        doc`**Card counting.** A player who tracks the cards dealt knows the shoe's composition before every round. ${text(between.label)}'s value depends on it: over the ${int(exact.sampleSpace.rolls)} rolls, one unit is worth, by the card's value:

${table(
  [
    ['Card value', 'left'],
    ...counting.countable.map(
      (bet) =>
        [
          doc`${text(bets.find((candidate) => candidate.betId.value === bet.value)!.label)}, expected net`,
          'right',
        ] as [Part, Align],
    ),
  ],
  cardValueRows,
)}

The other wagers are worth the same whatever the card, so they cannot be counted. The exposure, computed exactly for a player who knows the composition before every round (a hypergeometric model of the shoe, no simulation):

${table(
  [
    ['Penetration', 'left'],
    ['Rounds per shoe', 'right'],
    [doc`${text(between.label)}: rounds favouring the counter`, 'right'],
    ['Counter’s edge in them', 'right'],
    ['Break-even bet spread', 'right'],
    [
      doc`${text(bets.find((bet) => bet.betId.value === 'bullseye')!.label)}: rounds favouring the counter`,
      'right',
    ],
  ],
  penetrationRows,
)}

The table's limits allow a spread of ${spread(counting.limits.spread, 0)} on ${text(between.label)}, so at the table's penetration a skilled counter could beat it wherever the cards are visible. A live table should shuffle after every round, use a continuous shuffling machine, or cut the penetration well below the table's; an RNG table that reshuffles every round returns exactly the declared figures. ${cite(records.counting)}`,
        ROUNDING,
        PLAYER_ERROR,
        RNG_ASSUMPTION,
      ]),
    },
    {
      title: 'Appendix',
      body: doc`**Full enumeration.** Every distinct roll (the higher die first; "ways" counts the ordered rolls that show it) against every card value, with its probability and each wager's net result per unit staked (${text(between.label)}'s push is ${frac(enumeration.rows[0]!.net.between!)}). Each column, weighted by the probabilities, adds up to the wager's RTP; the test checks it.

${table(
  [
    ['Dice', 'left'],
    ['Ways', 'right'],
    ['Card', 'right'],
    ['Probability', 'right'],
    ...bets.map((bet) => [text(bet.label), 'right'] as [Part, Align]),
  ],
  enumeration.rows.map((row) => [
    dice(row.dice[0]!, row.dice[1]!),
    int(row.ways),
    int(row.card),
    frac(row.probability),
    ...bets.map((bet) => frac(row.net[bet.betId.value]!)),
  ]),
)}

${cite(records.enumeration)}

${recordsIndex(game.records, text(game.id))}`,
    },
  ]);
}

/** Every record of a game, with its test. */
function recordsIndex(records: Figs<Readonly<Record<string, Recorded<unknown>>>>, id: Md): Md {
  return doc`**Records.** The tests recorded these figures (\`packages/engine/src/games/${id}/results/\`):

${table(
  [
    ['Record', 'left'],
    ['Test', 'left'],
  ],
  Object.entries(records).map(([name, record]) => [
    doc`\`${name}.json\``,
    doc`\`${text(record.test.file)}\` › ${text(record.test.name)}`,
  ]),
)}`;
}

// ─── Moving Target ───

function targetTable(rows: readonly Figs<TargetRow>[], rtp: Figs<Exact>): Md {
  return table(
    [
      ['Target', 'left'],
      ['P(target)', 'right'],
      ['P(win | target)', 'right'],
      ['Pays', 'right'],
      ['Return given target', 'right'],
      ['House edge given target', 'right'],
      ['P(target and win)', 'right'],
      ['Contribution to RTP', 'right'],
    ],
    [
      ...rows.map((row) => [
        int(row.target),
        frac(row.rollChance.fraction),
        doc`${frac(row.win.fraction)} (${pct(row.win.value, 2)})`,
        odds(row.odds.to, row.odds.per),
        pct(row.returnGivenTarget.value, 3),
        pct(row.edgeGivenTarget.value, 3),
        pct(row.probability.value, 4),
        pct(row.contribution.value, 4),
      ]),
      ['**All targets**', '', '', '', '', '', '', doc`**${pct(rtp.value, 4)}**`],
    ],
  );
}

function movingTarget(game: Game<MovingTargetTable, MovingTargetRecords>, meta: Meta): Md {
  const { summary, records, table: t } = game;
  const exact = records.exact.figures;
  const infinite = records['infinite-shoe'].figures;
  const sixDeck = records['six-deck-shoe'].figures;
  const firstRound = records['first-round'].figures;
  const counting = records.counting.figures;
  const bets = summary.bets;
  const [exactHit, firstCard, threePlus] = [bets[0]!, bets[1]!, bets[2]!];
  const faces = t.dice.faces;
  const targets = t.targets;
  const conditions: Readonly<Record<string, Md>> = {
    'exact-hit': doc`the running total X_k = c₁ + … + c_k takes the value T for some k, that is X_K = T where K is the first k with X_k ≥ T; paid at the odds of T`,
    'first-card': doc`c₁ = T (possible only for T ≤ ${int(t.cardValues.highest)})`,
    'three-plus-cards': doc`K ≥ ${int(t.threePlusCards)}, that is c₁ + c₂ < T`,
  };
  const recursion = doc`With every value equally likely, the running total, which starts at zero, passes through n with chance h(n) = (h(n − ${int(t.cardValues.lowest)}) + … + h(n − ${int(t.cardValues.highest)})) / ${int(t.cardValues.highest)}, and Exact Hit on a target T wins with chance h(T)`;
  const perWager: Section[] = bets.map((bet) => {
    const figures = exact.bets[bet.betId.value]!;
    return {
      title: doc`${text(bet.label)} (${text(bet.kind)})`,
      body: doc`**Wins** when ${conditions[bet.betId.value]}. **Method:** a memoised recursion over the running total and the card count, written from the rules alone, checked against the closed forms of bets.ts and against exact enumeration of the production game over Ω; all three agree as fractions.

By target, weighted by the dice:

${targetTable(figures.byTarget, figures.rtp)}

As an outcome table:

${outcomeTable(figures.outcomes)}

${exactTotals(figures, false)}

${cite(records.exact)}`,
    };
  });
  return document(game, meta, [
    summarySection(bets, exact.maxExposure, [], records.exact),
    {
      title: 'Game model',
      body: bullets([
        doc`**Sample space.** The dice (d₁, d₂) are uniform on ${int(faces[0]!)} to ${int(faces.at(-1)!)}: ${int(exact.sampleSpace.rolls)} rolls, whose sum is the target T, from ${int(targets[0]!.target)} to ${int(targets.at(-1)!.target)}. The cards c₁, c₂, … take values ${int(t.cardValues.lowest)} to ${int(t.cardValues.highest)}, and the deal stops at the first K with c₁ + … + c_K ≥ T. Ω is the set of rolls and the card sequences each can deal: ${int(exact.sampleSpace.outcomes)} outcomes (from ${int(exact.sampleSpace.sequences[String(targets[0]!.target.value)]!)} sequences for a target of ${int(targets[0]!.target)} to ${int(exact.sampleSpace.sequences[String(targets.at(-1)!.target.value)]!)} for ${int(targets.at(-1)!.target)}), each with the product of its draws' chances.`,
        doc`**Card supply.** The declared figures take every card value equally likely and independent: an infinite shoe, as an RNG game that draws each card independently deals it. ${recursion}; bets.ts declares these chances in closed form, and the exact test checks the closed forms against the recursion and the game. The real ${int(t.shoe.decks)}-deck shoe deals without replacement and its rounds interact; section six measures by how much that moves each figure.`,
        doc`**Decisions.** None: every wager is settled by the roll and the deal.`,
      ]),
    },
    { title: 'Per-wager analysis', subsections: perWager },
    notApplicable(text(game.name)),
    {
      title: 'Finite-shoe effects',
      body: doc`Two tests measure the ${int(t.shoe.decks)}-deck shoe against the declared, infinite-shoe figures. The first round after a shuffle is computed exactly, by a recursion over the cards drawn without replacement from a full shoe (${int(firstRound.perValue)} cards of each value): a second card of a value already drawn is less likely, so totals reached through pairs get rarer. The long run is simulated on the production game, with its cut card after ${int(t.shoe.cutCard)} cards and reshuffles: over whole shoes the rounds interact, since each round takes cards whose mix depends on the target it chased, and the number of rounds a shoe deals depends on its cards.

${table(
  [
    ['Wager', 'left'],
    ['House edge, declared', 'right'],
    ['First round, exact', 'right'],
    ['Long run, observed', 'right'],
    ['Long-run shift', 'right'],
    ['Standard error', 'right'],
  ],
  bets.map((bet) => {
    const first = firstRound.bets[bet.betId.value]!;
    const long = sixDeck.bets[bet.betId.value]!.houseEdge;
    return [
      text(bet.label),
      pct(bet.houseEdge, 3),
      pct(first.houseEdge.value, 3),
      pct(long.observed, 3),
      pp(long.difference, 3),
      points(long.standardError, 3),
    ];
  }),
)}

${text(exactHit.label)} by target (house edge; a positive shift is dearer for the player):

${table(
  [
    ['Target', 'left'],
    ['Declared', 'right'],
    ['First round, exact', 'right'],
    ['Long run, observed', 'right'],
    ['Long-run shift', 'right'],
    ['Standard error', 'right'],
  ],
  sixDeck.byTarget.map((row, index) => [
    int(row.target),
    pct(row.houseEdge.expected, 2),
    pct(firstRound.byTarget[index]!.houseEdge.value, 2),
    pct(row.houseEdge.observed, 2),
    pp(row.houseEdge.difference, 2),
    points(row.houseEdge.standardError, 3),
  ]),
)}

Which figures a table returns depends on how it deals: an RNG table that draws every card independently returns the declared figures; one that reshuffles a virtual ${int(t.shoe.decks)}-deck shoe before every round, as a continuous shuffler does, returns the first-round column; a shoe dealt down to the cut card, as at a live table, returns the long-run column. No wager's edge moves by more than ${points(sixDeck.maxShift, 2)} (the test's bound). ${cite(records['first-round'], records['six-deck-shoe'])}`,
    },
    {
      title: 'Simulation verification',
      body: doc`**On the infinite shoe**, against the declared figures:

${simulationFacts(
  infinite.simulation,
  doc`every wager at its minimum each round: ${stakesText(stakeSets(infinite.simulation)[0]!, bets)}`,
  doc`each RTP within ±${points(infinite.simulation.tolerance!, 2)} of the declared figure and each hit frequency within ${num(infinite.simulation.z, 2)} binomial standard errors; the round count makes ±${points(infinite.simulation.tolerance!, 2)} equal to ${num(infinite.simulation.z, 2)} standard errors for the most volatile wager`,
)}

${table(
  verificationColumns(infinite.simulation),
  bets.flatMap((bet) => {
    const result = infinite.bets[bet.betId.value]!;
    return [
      verificationRow(doc`${text(bet.label)}, RTP`, result.rtp),
      verificationRow(doc`${text(bet.label)}, hit frequency`, result.hitFrequency),
    ];
  }),
)}

${cite(records['infinite-shoe'])}

**On the ${int(t.shoe.decks)}-deck shoe**, measuring the shift of section six rather than checking a declared figure:

${simulationFacts(
  sixDeck.simulation,
  doc`every wager at its minimum each round: ${stakesText(stakeSets(sixDeck.simulation)[0]!, bets)}`,
  doc`no wager's house edge shifted by more than ${points(sixDeck.maxShift, 2)} from the declared figure, and no target's by more than that plus ${num(sixDeck.simulation.z, 2)} standard errors; the round count measures each wager's shift to ±${points(sixDeck.simulation.tolerance!, 2)} at ${num(sixDeck.simulation.z, 2)} standard errors`,
)}

${table(
  verificationColumns(sixDeck.simulation),
  bets.map((bet) =>
    verificationRow(doc`${text(bet.label)}, house edge`, sixDeck.bets[bet.betId.value]!.houseEdge),
  ),
)}

${intervalNote(infinite.simulation)} ${cite(records['six-deck-shoe'])}`,
    },
    {
      title: 'Assumptions and limitations',
      body: paragraphs([
        INDEPENDENCE,
        doc`**Card counting.** The cards are dealt face up, so a player who tracks them knows the shoe's composition before every round. A seeded run of ${int(counting.simulation.rounds)} rounds of the production game (seed \`${text(counting.simulation.seed)}\`, ${int(counting.shuffles)} shoes) computes each wager's exact expectation for the composition before every round: the chance that some first k cards of the shoe add up to the target is a sum over the multisets of values that do, each with its hypergeometric chance, which the test checks against a direct recursion.

${table(COUNTING_COLUMNS, countingRows(bets.map((bet) => [text(bet.label), counting.bets[bet.betId.value]!] as const)))}

The break-even spread is how much more a perfect counter must stake in the favourable rounds than in the others (one unit) to break even. ${text(exactHit.label)} and ${text(threePlus.label)} can be counted at the table's penetration, ${text(firstCard.label)} barely. A live table should use a continuous shuffling machine or shuffle much earlier; an RNG table that reshuffles every round is immune. ${cite(records.counting)}`,
        ROUNDING,
        PLAYER_ERROR,
        RNG_ASSUMPTION,
      ]),
    },
    {
      title: 'Appendix',
      body: doc`The full enumeration of ${int(exact.sampleSpace.outcomes)} outcomes does not fit a page; the tests hold it. \`moving-target.test.ts\` runs the production game over every roll and card sequence and checks each wager's RTP, hit frequency, lines and variance against the recursion, and its record holds the per-target figures above as exact fractions. The number of card sequences by target:

${table(
  [
    ['Target', 'left'],
    ['Rolls', 'right'],
    ['Card sequences', 'right'],
  ],
  targets.map((row) => [
    int(row.target),
    int(exact.rolls[String(row.target.value)]!),
    int(exact.sampleSpace.sequences[String(row.target.value)]!),
  ]),
)}

${recordsIndex(game.records, text(game.id))}`,
    },
  ]);
}

// ─── Mirror ───

function mirror(game: Game<MirrorTable, MirrorRecords>, meta: Meta): Md {
  const { summary, records, table: t } = game;
  const exact = records.exact.figures;
  const hands = records.hands.figures;
  const meter = records.meter.figures;
  const sixExact = records['six-deck-exact'].figures;
  const infinite = records['infinite-shoe'].figures;
  const sixDeck = records['six-deck-shoe'].figures;
  const bets = summary.bets;
  const main = bets[0]!;
  const doubleSixes = bets.find((bet) => bet.betId.value === 'double-sixes')!;
  const progressive = doubleSixes.progressive!;
  const faces = t.dice.faces;
  const six = faces.at(-1)!;
  const conditions: Readonly<Record<string, Md>> = {
    mirror: doc`rank(dice) > rank(cards)`,
    tie: doc`rank(dice) = rank(cards), that is the two hands hold the same two values`,
    'equal-sums': doc`d₁ + d₂ = c₁ + c₂`,
    'pair-vs-pair': doc`d₁ = d₂ and c₁ = c₂`,
    'perfect-mirror': doc`d₁ = d₂ = c₁ = c₂`,
    'double-sixes': doc`d₁ = d₂ = c₁ = c₂ = ${int(six)}`,
  };
  const perWager: Section[] = bets.map((bet) => {
    const figures = exact.bets[bet.betId.value]!;
    const jackpot = bet.progressive !== undefined;
    return {
      title: doc`${text(bet.label)} (${text(bet.kind)}${jackpot ? ', progressive' : ''})`,
      body: doc`**Wins** when ${conditions[bet.betId.value]}. **Method:** exact enumeration of the production game over Ω${jackpot ? ', with the meter at zero: the fixed pay alone' : ''}.${bet.betId.value === 'mirror' ? doc` The ranking is enumerated in the appendix: the dice outrank the cards with chance ${exactPct(hands.win)}, tie with chance ${exactPct(hands.tie)} and lose with chance ${exactPct(hands.lose)}.` : ''}

${outcomeTable(figures.outcomes)}

${exactTotals(figures, false)}${
        jackpot
          ? doc`

With the meter at its seed, ${money(exact.doubleSixesAtSeed.meter)}, a hit pays ${times(progressive.maxExposureAtSeed)} plus the stake per unit, and one round returns ${exactPct(exact.doubleSixesAtSeed.rtp)} with a standard deviation of ${num(exact.doubleSixesAtSeed.standardDeviation, 4)}: the volatility the summary declares. The declared RTP, ${pct(bet.rtp, 4)}, counts the fixed pays and the ${pct(progressive.contributionRate, 0)} of every stake the meter pays back in the long run, the seed excluded; section five gives the meter's economics.`
          : ''
      }

${cite(records.exact)}`,
    };
  });
  const verification = (results: typeof infinite.results, key: string) =>
    results[key] as unknown as Figs<Verification>;
  return document(game, meta, [
    summarySection(
      bets,
      exact.maxExposure,
      [
        doc`**${text(doubleSixes.label)}** pays a share of the progressive meter on top of its fixed odds. Its RTP excludes the meter's seed, which the house funds: the fixed pays plus the contributions. Its SD per unit, max payout and max exposure are taken with the meter at its seed; above it they grow with the meter.`,
      ],
      records.exact,
    ),
    {
      title: 'Game model',
      body: bullets([
        doc`**Sample space.** Ω = D × C². D is the ordered pair of dice (d₁, d₂), uniform on ${int(faces[0]!)} to ${int(six)}; C² the ordered pair of card values (c₁, c₂). Each hand is read by its two values: a pair ranks above every non-pair, by its value; non-pairs rank by sum, then by the higher value, so only identical hands tie. The exact test enumerates ${int(exact.sampleSpace.rolls)} rolls × ${int(exact.sampleSpace.cards)} ordered pairs of cards from one deck's ${int(t.shoe.cardsPerDeck)} cards: ${int(exact.sampleSpace.outcomes)} outcomes.`,
        doc`**Card supply.** The declared figures take the two cards independent and uniform over the values: an infinite shoe, as an RNG game that draws each card independently deals them. On the table's ${int(t.shoe.decks)}-deck shoe a pair of cards is rarer (once a card is out, fewer of its value are left), and section six gives those figures exactly: with two cards a round and ${int(t.roundsPerShoe)} rounds a shoe whatever the cards, the two cards of any round are a uniform draw of two cards from the full shoe.`,
        doc`**Decisions.** None: every wager is settled by the two hands.`,
      ]),
    },
    { title: 'Per-wager analysis', subsections: perWager },
    {
      title: 'Progressive analysis',
      body: doc`${facts([
        ['Term', 'Value'],
        ['Seed (the meter starts at it and never drops below it)', money(meter.terms.seed)],
        [
          'Contribution rate (of every stake, into the meter)',
          exactPct(meter.terms.contributionRate, 0),
        ],
        [
          'Full-share stake (a hit takes stake ÷ it of the meter)',
          money(meter.terms.fullShareStake),
        ],
        ['Hit chance per round', exactPct(meter.terms.hitChance, 4)],
        ['Rounds per hit, on average', frac(meter.terms.cycleRounds.fraction)],
        ['Fixed-pay RTP', exactPct(meter.fixedRtp)],
        ['Contribution RTP (paid back through the meter)', exactPct(meter.contributionRtp, 0)],
        ['RTP excluding the seed (declared)', exactPct(meter.rtpExcludingSeed)],
        ['RTP of one round at the seed', exactPct(meter.rtpAtSeed)],
        ['RTP added per cent of meter', frac(meter.rtpPerMeterUnit.fraction)],
        [
          'Break-even meter (one round returns all that is staked)',
          money(meter.breakEvenMeter.value),
        ],
        [
          'Seed cost per round, at the full-share stake',
          doc`${money(meter.seedCostPerRound.value)} (${pct(meter.seedCostShareAtMax.value, 2)} of the stake)`,
        ],
      ])}

- **The meter's rule.** Every stake on ${text(doubleSixes.label)} adds ${pct(progressive.contributionRate, 0)} of itself to the meter as the wager is accepted, kept to a millionth of a cent. A hit pays ${odds(progressive.fixedOdds.to, progressive.fixedOdds.per)} from the table's bank plus stake ÷ ${money(progressive.fullShareStake)} of the meter, rounded down to the cent; the meter is decreased by the share paid and keeps the rest, and the house tops it back up to the seed if it fell below.
- **Return at a given meter.** A hit pays meter ÷ ${money(progressive.fullShareStake)} per unit staked, whatever the stake, so with the meter at M cents one round returns ${pct(meter.fixedRtp.value, 2)} + M × ${frac(meter.rtpPerMeterUnit.fraction)}: ${pct(meter.rtpAtSeed.value, 2)} at the seed, and all that is staked at ${money(meter.breakEvenMeter.value)}, the break-even meter (${money(sixExact.doubleSixes.breakEvenMeter.value)} on the ${int(t.shoe.decks)}-deck shoe).
- **The meter at a hit.** If every cycle starts at the seed, the meter at a hit averages the seed plus a cycle's contributions, seed + rate × mean stake ÷ hit chance: ${series(meter.meterAtHit.map((row) => doc`${money(row.meter)} at a mean stake of ${moneyExact(row.meanStake)}`))}. With stakes below the full share a hit takes only part of the meter and the rest carries over, so the meter settles higher: in the simulations of section seven, with stakes of ${series(stakeSets(infinite.simulation).map((stakes) => money(stakes['double-sixes']!)))} in turn, it averaged ${money(infinite.meter.meterAtHit)} at a hit on the infinite shoe and ${money(sixDeck.meter.meterAtHit)} on the ${int(t.shoe.decks)}-deck shoe.
- **The seed's cost.** At the full-share stake every hit takes the whole meter and the house re-seeds it: ${money(meter.seedCostPerRound.value)} a round, ${pct(meter.seedCostShareAtMax.value, 2)} of the stake. In the mixed-stake simulations the top-ups came to ${money(infinite.meter.topUpsPerRound)} and ${money(sixDeck.meter.topUpsPerRound)} a round, and the wager returned ${pct(infinite.meter.rtpWithTopUps, 2)} and ${pct(sixDeck.meter.rtpWithTopUps, 2)} with them.

${cite(records.meter, records['infinite-shoe'], records['six-deck-shoe'])}`,
    },
    {
      title: 'Finite-shoe effects',
      body: doc`On the table's ${int(t.shoe.decks)}-deck shoe the second card matches the first less often than on an infinite shoe (a pair of cards is ${frac(sixExact.pairRatio.fraction)} as likely), which moves every wager. The exact figures come from running the production game over every roll and every ordered pair of cards from a full shoe (${int(sixExact.sampleSpace.outcomes)} outcomes); the simulation confirms them on the real shoe, with its cut card and reshuffles.

${table(
  [
    ['Wager', 'left'],
    ['RTP, declared', 'right'],
    ['RTP, six-deck shoe (exact)', 'right'],
    ['RTP, six-deck shoe (observed)', 'right'],
    ['Standard error', 'right'],
  ],
  [
    ...bets
      .filter((bet) => bet.progressive === undefined)
      .map((bet) => {
        const check = verification(sixDeck.results, `${bet.betId.value}/rtp`);
        const exactShoe = sixExact.bets[bet.betId.value]!.rtp;
        return [
          text(bet.label),
          pct(bet.rtp, 3),
          pct(exactShoe.value, 3),
          pct(check.observed, 3),
          points(check.standardError, 3),
        ];
      }),
    ...(['fixedRtp', 'rtpExcludingSeed'] as const).map((key) => {
      const check = verification(sixDeck.results, `double-sixes/${key}`);
      return [
        doc`${text(doubleSixes.label)}, ${key === 'fixedRtp' ? 'fixed pays' : 'excluding the seed'}`,
        pct(key === 'fixedRtp' ? meter.fixedRtp.value : meter.rtpExcludingSeed.value, 3),
        pct(
          key === 'fixedRtp'
            ? sixExact.doubleSixes.fixedRtp.value
            : sixExact.doubleSixes.rtpExcludingSeed.value,
          3,
        ),
        pct(check.observed, 3),
        points(check.standardError, 3),
      ];
    }),
  ],
)}

These six-deck figures are exact for every round, not only the first after a shuffle, and a table that reshuffles before every round returns them too. ${cite(records['six-deck-exact'], records['six-deck-shoe'])}`,
    },
    {
      title: 'Simulation verification',
      body: doc`Both runs play every wager in every round, with ${text(doubleSixes.label)} staked at ${series(stakeSets(infinite.simulation).map((stakes) => money(stakes['double-sixes']!)))} in turn and its meter live.

**On the infinite shoe**, against the declared figures:

${simulationFacts(
  infinite.simulation,
  doc`${stakesText(
    stakeSets(infinite.simulation)[0]!,
    bets.filter((bet) => bet.progressive === undefined),
  )}, and ${text(doubleSixes.label)} as above`,
  doc`each RTP within ±${points(infinite.simulation.tolerance!, 2)} of the declared figure, or ${num(infinite.simulation.z, 2)} of its own standard errors for the wagers too volatile for that within ${int(infinite.budget)} rounds; each hit frequency within ${num(infinite.simulation.z, 2)} binomial standard errors`,
)}

${table(verificationColumns(infinite.simulation), [
  ...bets
    .filter((bet) => bet.progressive === undefined)
    .map((bet) =>
      verificationRow(
        doc`${text(bet.label)}, RTP`,
        verification(infinite.results, `${bet.betId.value}/rtp`),
      ),
    ),
  verificationRow(
    doc`${text(doubleSixes.label)}, fixed pays`,
    verification(infinite.results, 'double-sixes/fixedRtp'),
  ),
  verificationRow(
    doc`${text(doubleSixes.label)}, excluding the seed`,
    verification(infinite.results, 'double-sixes/rtpExcludingSeed'),
  ),
  ...bets.map((bet) =>
    verificationRow(
      doc`${text(bet.label)}, hit frequency`,
      verification(infinite.results, `${bet.betId.value}/hitFrequency`),
      4,
    ),
  ),
])}

${cite(records['infinite-shoe'])}

**On the ${int(t.shoe.decks)}-deck shoe**, against the exact six-deck figures:

${simulationFacts(
  sixDeck.simulation,
  doc`as on the infinite shoe`,
  doc`each figure within ${num(sixDeck.simulation.z, 2)} of its own standard errors of the exact six-deck figure; the round count holds ${text(bets.find((bet) => bet.betId.value === 'pair-vs-pair')!.label)} to ±${points(sixDeck.simulation.tolerance!, 1)}`,
)}

${table(verificationColumns(sixDeck.simulation), [
  ...bets
    .filter((bet) => bet.progressive === undefined)
    .map((bet) =>
      verificationRow(
        doc`${text(bet.label)}, RTP`,
        verification(sixDeck.results, `${bet.betId.value}/rtp`),
      ),
    ),
  verificationRow(
    doc`${text(doubleSixes.label)}, fixed pays`,
    verification(sixDeck.results, 'double-sixes/fixedRtp'),
  ),
  verificationRow(
    doc`${text(doubleSixes.label)}, excluding the seed`,
    verification(sixDeck.results, 'double-sixes/rtpExcludingSeed'),
  ),
  ...bets.map((bet) =>
    verificationRow(
      doc`${text(bet.label)}, hit frequency`,
      verification(sixDeck.results, `${bet.betId.value}/hitFrequency`),
      4,
    ),
  ),
])}

${intervalNote(infinite.simulation)} ${cite(records['six-deck-shoe'])}`,
    },
    {
      title: 'Assumptions and limitations',
      body: paragraphs([
        INDEPENDENCE,
        doc`**Card counting.** A player who tracks the cards dealt knows the shoe's composition before every round. The ${int(t.shoe.decks)}-deck simulation computes each wager's exact expectation for that composition, round by round (for ${text(doubleSixes.label)} also with the meter as it stood):

${table(
  COUNTING_COLUMNS,
  countingRows([
    ...bets.map((bet) => [text(bet.label), sixDeck.counting[bet.betId.value]!] as const),
    [
      doc`${text(doubleSixes.label)}, with the meter`,
      sixDeck.counting['double-sixes-with-meter']!,
    ] as const,
  ]),
)}

The break-even spread is how much more a perfect counter must stake in the favourable rounds than in the others (one unit) to break even. The main wager and ${text(doubleSixes.label)} are exposed; with the meter above break-even much of the time, a counter needs almost no spread on ${text(doubleSixes.label)}. A table that reshuffles before every round, as a continuous shuffler does, removes the exposure and changes no figure of this report. ${cite(records['six-deck-shoe'])}`,
        doc`**Rounding.** Fixed pays are whole units per unit staked, so they are exact. A meter share is rounded down to the cent and the rest stays in the meter, to a millionth of a cent: nothing is lost, and the long-run return is unchanged.`,
        doc`**The meter** is modelled for one table with its own meter, as the demo runs it; a meter shared across tables changes the contributions per hit, not the rules. The seed and top-ups are the operator's cost and are excluded from the declared RTP.`,
        PLAYER_ERROR,
        RNG_ASSUMPTION,
      ]),
    },
    {
      title: 'Appendix',
      body: doc`**The kinds of hand**, strongest first, with their chance for the dice (and for two cards from an infinite shoe):

${table(
  [
    ['Rank', 'right'],
    ['Hand', 'left'],
    ['Values', 'left'],
    ['Chance', 'right'],
  ],
  [...hands.kinds]
    .reverse()
    .map((kind) => [
      int(kind.rank),
      text(kind.label),
      dice(kind.high, kind.low),
      frac(kind.chance.fraction),
    ]),
)}

**Every dice hand against every card hand.** Rows are the dice's hand and columns the cards', both by the rank above; W marks a win for the dice (the ${text(main.label)} wager wins), T a tie and a blank a loss. The cells, weighted by the two hands' chances, give the chances of section four.

${table(
  [
    ['Dice \\ cards', 'left'],
    ...[...hands.kinds].reverse().map((kind) => [int(kind.rank), 'center'] as [Part, Align]),
  ],
  [...hands.kinds].reverse().map((dicesKind, row) => [
    int(dicesKind.rank),
    ...[...hands.matrix]
      .reverse()
      [row]!.slice()
      .reverse()
      .map((cell) => (cell.value === 1 ? 'W' : cell.value === 0 ? 'T' : '')),
  ]),
)}

${cite(records.hands)}

${recordsIndex(game.records, text(game.id))}`,
    },
  ]);
}

// ─── Lock & Roll ───

function lockAndRoll(game: Game<LockAndRollTable, LockAndRollRecords>, meta: Meta): Md {
  const { summary, records, table: t } = game;
  const exact = records.exact.figures;
  const strategy = records.strategy.figures;
  const sixExact = records['six-deck-exact'].figures;
  const infinite = records['infinite-shoe'].figures;
  const sixDeck = records['six-deck-shoe'].figures;
  const bets = summary.bets;
  const bet = bets[0]!;
  const faces = t.dice.faces;
  const free = dice(t.fee.freeRoll[0]!, t.fee.freeRoll[1]!);
  const fee = exact.rules.fee;
  const decisionLabel: Readonly<Record<string, Md>> = {
    stand: doc`Stand`,
    lock: doc`Lock (fee paid)`,
    'lock-free': doc`Lock (free on ${free})`,
  };
  const bestLabel = (value: string) =>
    value === 'stand'
      ? 'Stand'
      : value === 'lock-high'
        ? 'Lock the higher die'
        : 'Lock the lower die';
  const locked = strategy.rows.filter((row) => row.best.value !== 'stand');
  const strategyNames: Readonly<Record<string, string>> = {
    optimal: 'Optimal (the reference strategy, declared)',
    'never-lock': 'Never lock',
    'always-lock-low': 'Always lock the lower die (re-roll the higher every round)',
    'always-lock-high': 'Always lock the higher die (re-roll the lower every round)',
    'optimal-wrong-die': 'Lock when the strategy does, but the lower die',
  };
  return document(game, meta, [
    summarySection(
      bets,
      exact.maxExposure,
      [
        doc`The figures assume the **optimal strategy** of section four, and count the Lock fee against the return: a fee is never returned and is not a stake, so RTP = (payouts − fees) ÷ stakes. Measured instead against everything the player pays, the wager and the fees, the loss is the element of risk, ${exactPct(exact.bet.elementOfRisk!, 2)}.`,
        doc`The most a round can cost the player is ${money(exact.maxExposure.bets['lock-and-roll']!.loss)} at the maximum wager: the wager and the Lock fee.`,
      ],
      records.exact,
    ),
    {
      title: 'Game model',
      body: bullets([
        doc`**Sample space.** The dice (d₁, d₂) are uniform on ${int(faces[0]!)} to ${int(faces.at(-1)!)}: ${int(exact.sampleSpace.rolls)} rolls. The player then stands, or locks one die and re-rolls the other once: a face r uniform on ${int(faces[0]!)} to ${int(faces.at(-1)!)} (${int(exact.sampleSpace.rerolls)} outcomes). The dealer's two cards (c₁, c₂) follow. The wager wins when the dice's final total exceeds c₁ + c₂. The exact test enumerates the production game with the reference strategy over every roll, re-roll and ordered pair of cards from one deck's ${int(t.shoe.cardsPerDeck)} cards: ${int(exact.sampleSpace.outcomes)} outcomes.`,
        doc`**Card supply.** The declared figures take the two cards independent and uniform over the values: an infinite shoe, as an RNG game that draws each card independently deals them. On the table's ${int(t.shoe.decks)}-deck shoe the two cards of any round are a uniform draw of two cards from the full shoe (two cards a round and ${int(t.roundsPerShoe)} rounds a shoe, whatever the dice and the decisions); section six gives those figures exactly.`,
        doc`**Decision model.** After the roll the player knows the dice and chooses Stand, or Lock one die for the fee of ${exactPct(fee, 0)} of the wager (free on ${free}). Each choice is valued by its expected net result per unit: standing on a total s is worth P(c₁ + c₂ < s) − P(c₁ + c₂ ≥ s), and locking a die of value k is worth the average over the re-rolled face of standing on k + r, less the fee. The **optimal strategy** takes the choice of highest value on each roll, standing when no lock is strictly better. The declared figures assume it; section four prices other strategies.`,
      ]),
    },
    {
      title: 'Per-wager analysis',
      subsections: [
        {
          title: doc`${text(bet.label)} (main)`,
          body: doc`**Wins** when the final dice total exceeds c₁ + c₂; a tie loses. **Method:** exact enumeration of the production game with the reference strategy over Ω; the strategy itself is derived by a second test from scratch, by expected value.

The return by what the player did and how the wager ended (the fee counted in the net):

${table(
  [
    ['Decision', 'left'],
    ['Result', 'left'],
    ['Probability', 'right'],
    ['Exactly', 'right'],
    ['Net per unit', 'right'],
    ['Contribution to the net', 'right'],
  ],
  exact.outcomes.map((row) => [
    decisionLabel[row.decision.value]!,
    row.result.value === 'win' ? 'wins' : 'loses',
    pct(row.probability.value, 4),
    frac(row.probability.fraction),
    fracNum(row.net.fraction, 2),
    frac(row.contribution.fraction),
  ]),
)}

${exactTotals(exact.bet, false)}
- **Lock:** in ${exactPct(exact.bet.rerollFrequency!, 2)} of rounds; the fee is paid in ${exactPct(exact.bet.feeFrequency!, 2)} of rounds, ${exactPct(exact.bet.averageFee, 2)} of the wager on average.

${cite(records.exact)}

**The decision table.** Each value is the expected net result per unit of the wager, the fee included; the dice are listed higher first, and on a double both locks are worth the same.

${table(
  [
    ['Roll', 'left'],
    ['Chance', 'right'],
    ['Stand', 'right'],
    ['Lock the higher die', 'right'],
    ['Lock the lower die', 'right'],
    ['Best play', 'left'],
    ['Margin', 'right'],
  ],
  strategy.rows.map((row) => [
    dice(row.dice[0]!, row.dice[1]!),
    frac(row.chance.fraction),
    fracNum(row.stand.fraction, 4),
    fracNum(row.lockHigh.fraction, 4),
    fracNum(row.lockLow.fraction, 4),
    row.dice[0]!.value === row.dice[1]!.value && row.best.value !== 'stand'
      ? doc`Lock either die${row.free.value ? doc` (free)` : ''}`
      : bestLabel(row.best.value),
    fracNum(row.margin.fraction, 4),
  ]),
)}

**The optimal strategy.** Lock the higher die and re-roll the lower on ${series(locked.map((row) => dice(row.dice[0]!, row.dice[1]!)))}; stand on the other rolls. Locking the lower die is never best: the higher the die kept, the better the re-roll. The closest calls are decided by ${frac(strategy.rows.reduce((least, row) => (row.margin.value.value < least.margin.value.value ? row : least)).margin.fraction)} of the wager. The strategy locks in ${exactPct(strategy.rerolls, 2)} of rounds.

**With and without the free ${free}.** The free re-roll is worth ${exactPct(strategy.freeOneOneWorth, 2)} of the wager to the player. Without it, ${free} stands (a sure loss beats paying the fee for the re-roll), the strategy locks in ${exactPct(strategy.rerollsWithoutFree, 2)} of rounds, and:

${table(
  [
    ['Rules', 'left'],
    ['RTP', 'right'],
    ['House edge', 'right'],
    ['Hit frequency', 'right'],
    ['SD per unit', 'right'],
  ],
  [
    [
      doc`As played, ${free} free`,
      exactPct(exact.bet.rtp),
      exactPct(exact.bet.houseEdge),
      pct(exact.bet.hitFrequency.value, 3),
      num(exact.bet.standardDeviation, 4),
    ],
    [
      doc`Without the free ${free}`,
      exactPct(exact.withoutFreeOneOne.rtp),
      exactPct(exact.withoutFreeOneOne.houseEdge),
      pct(exact.withoutFreeOneOne.hitFrequency.value, 3),
      num(exact.withoutFreeOneOne.standardDeviation, 4),
    ],
  ],
)}

**Other strategies.** The declared edge assumes optimal play; a player who plays otherwise gives the house more:

${table(
  [
    ['Strategy', 'left'],
    ['RTP', 'right'],
    ['House edge', 'right'],
    ['Hit frequency', 'right'],
    ['Average fee', 'right'],
  ],
  Object.entries(exact.strategies).map(([name, figures]) => [
    strategyNames[name] ?? name,
    exactPct(figures.rtp, 2),
    exactPct(figures.houseEdge, 2),
    pct(figures.hitFrequency.value, 2),
    pct(figures.averageFee.value, 2),
  ]),
)}

${cite(records.strategy, records.exact)}`,
        },
      ],
    },
    notApplicable(text(game.name)),
    {
      title: 'Finite-shoe effects',
      body: doc`On the table's ${int(t.shoe.decks)}-deck shoe the second card matches the first less often, which moves the dealer's totals toward the middle and helps the dice a little. The exact figures come from running the production game with the reference strategy over every roll, re-roll and ordered pair of cards from a full shoe (${int(sixExact.sampleSpace.outcomes)} outcomes); the strategy is the same on both shoes, and the simulation confirms the figure on the real shoe, with its cut card and reshuffles.

${table(
  [
    ['Figure', 'left'],
    ['Declared (infinite shoe)', 'right'],
    ['Six-deck shoe, exact', 'right'],
    ['Six-deck shoe, observed', 'right'],
  ],
  [
    [
      'RTP',
      exactPct(exact.bet.rtp, 3),
      exactPct(sixExact.bet.rtp, 3),
      doc`${pct(sixDeck.rtp.observed, 3)} ± ${points(sixDeck.rtp.standardError, 3)}`,
    ],
    ['House edge', exactPct(exact.bet.houseEdge, 3), exactPct(sixExact.bet.houseEdge, 3), ''],
    [
      'Hit frequency',
      exactPct(exact.bet.hitFrequency, 3),
      exactPct(sixExact.bet.hitFrequency, 3),
      pct(sixDeck.hitFrequency.observed, 3),
    ],
    [
      'Element of risk',
      exactPct(exact.bet.elementOfRisk!, 3),
      exactPct(sixExact.bet.elementOfRisk!, 3),
      '',
    ],
  ],
)}

The six-deck shoe returns ${pp(sixExact.shift.value, 3)} more than declared. ${cite(records['six-deck-exact'], records['six-deck-shoe'])}`,
    },
    {
      title: 'Simulation verification',
      body: doc`Both runs play the production game with the reference strategy deciding every round, the same bot the demo's autoplay uses.

**On the infinite shoe**, against the declared figures:

${simulationFacts(
  infinite.simulation,
  doc`${money(stakeSets(infinite.simulation)[0]!['lock-and-roll']!)} a round`,
  doc`the RTP within ±${points(infinite.simulation.tolerance!, 2)} of the declared figure (${num(infinite.simulation.z, 2)} standard errors at this round count), and each frequency within ${num(infinite.simulation.z, 2)} binomial standard errors`,
)}

${table(verificationColumns(infinite.simulation), [
  verificationRow('RTP', infinite.results.rtp!),
  verificationRow('Win frequency', infinite.results.hitFrequency!),
  verificationRow('Lock (re-rolls)', infinite.results.rerollFrequency!),
  verificationRow(doc`Free ${free} re-rolls`, infinite.results.freeRerollFrequency!),
  verificationRow('Fee paid', infinite.results.feeFrequency!),
])}

${cite(records['infinite-shoe'])}

**On the ${int(t.shoe.decks)}-deck shoe**, against the exact six-deck figures:

${simulationFacts(
  sixDeck.simulation,
  doc`${money(stakeSets(sixDeck.simulation)[0]!['lock-and-roll']!)} a round; ${int(sixDeck.shuffles)} shuffles`,
  doc`the RTP within ±${points(sixDeck.simulation.tolerance!, 2)} and ${num(sixDeck.simulation.z, 2)} standard errors of the exact six-deck figure, the win frequency within ${num(sixDeck.simulation.z, 2)} binomial standard errors`,
)}

${table(verificationColumns(sixDeck.simulation), [verificationRow('RTP', sixDeck.rtp), verificationRow('Win frequency', sixDeck.hitFrequency)])}

${intervalNote(infinite.simulation)} The six-deck RTP lies ${num(sixDeck.rtp.errors, 1)} standard errors from its exact figure: outside the ${pct(sixDeck.simulation.confidence.level, 0)} interval, inside the test's ${num(sixDeck.simulation.z, 2)}. ${cite(records['six-deck-shoe'])}`,
    },
    {
      title: 'Assumptions and limitations',
      body: paragraphs([
        INDEPENDENCE,
        doc`**Optimal play.** The declared figures assume the optimal strategy; section four gives the return of other strategies. A player who never locks gives the house ${exactPct(exact.strategies['never-lock']!.houseEdge, 2)} instead of ${exactPct(exact.bet.houseEdge, 2)}.`,
        doc`**Card counting.** The cards are dealt face up, so a player who tracks them knows the shoe's composition before every round. The ${int(t.shoe.decks)}-deck simulation computes the exact expectation for that composition, round by round, playing the reference strategy and deciding with the count:

${table(
  COUNTING_COLUMNS,
  countingRows([
    ['The reference strategy', sixDeck.counting.fixed!],
    ['Deciding with the count', sixDeck.counting.counter!],
  ]),
)}

The break-even spread is how much more a perfect counter must stake in the favourable rounds than in the others (one unit) to break even. The wager is exposed at the table's penetration; adjusting the decisions to the count adds almost nothing. A table that reshuffles before every round, as a continuous shuffler does, removes the exposure; its figures are the six-deck figures of section six. ${cite(records['six-deck-shoe'])}`,
        doc`**Rounding.** The wager pays even money, exactly. The Lock fee is rounded up to the cent, which only matters on wagers that are not a multiple of ${money(t.fee.exactOn)}; the figures assume the exact fee.`,
        doc`**Timing.** A player who does not decide stands (the RTP of standing on every roll is in section four's table of strategies); no fee is taken without a decision.`,
        RNG_ASSUMPTION,
      ]),
    },
    {
      title: 'Appendix',
      body: doc`The full enumeration of ${int(exact.sampleSpace.outcomes)} outcomes does not fit a page; the tests hold it. The decision table of section four, exactly:

${table(
  [
    ['Roll', 'left'],
    ['Stand', 'right'],
    ['Lock the higher die', 'right'],
    ['Lock the lower die', 'right'],
    ['Margin', 'right'],
  ],
  strategy.rows.map((row) => [
    dice(row.dice[0]!, row.dice[1]!),
    frac(row.stand.fraction),
    frac(row.lockHigh.fraction),
    frac(row.lockLow.fraction),
    frac(row.margin.fraction),
  ]),
)}

${cite(records.strategy)}

${recordsIndex(game.records, text(game.id))}`,
    },
  ]);
}

export function mathReports(results: Figs<Results>): Readonly<Record<string, Md>> {
  const { meta, games } = results;
  return {
    'dice-spread': diceSpread(games['dice-spread'], meta),
    'moving-target': movingTarget(games['moving-target'], meta),
    mirror: mirror(games.mirror, meta),
    'lock-and-roll': lockAndRoll(games['lock-and-roll'], meta),
  };
}

export type { Statistics };
