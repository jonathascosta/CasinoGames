/**
 * The results the documents are written from, and nothing else: each game's
 * math summary (mathSummary()), the figures its tests recorded
 * (packages/engine/src/games/<id>/results/*.json, see
 * packages/engine/src/testing/record.ts), what the Rules of Play state about
 * the table (read from the engine's configuration and rules), and the
 * documents' metadata. docs/results.json is this object as JSON.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import {
  BETWEEN_ODDS,
  DICE_SPREAD_BET_IDS,
  DIE_FACES,
  EXACT_HIT_ODDS,
  GAMES,
  LOCK_AND_ROLL_CONFIG,
  MAX_CARD_VALUE,
  MIRROR_BET_IDS,
  MIRROR_CONFIG,
  MOVING_TARGET_BET_IDS,
  TARGETS,
  compareHands,
  createDiceSpreadShoe,
  createLockAndRollShoe,
  createMirrorShoe,
  createMovingTargetShoe,
  lockAndRollWins,
  lockFee,
  paidLockFee,
  rankLabel,
  readDiceSpreadRoll,
  readHand,
  readMovingTargetDeal,
  resolveDiceSpreadBet,
  resolveMirrorBet,
  resolveMovingTargetBet,
  targetOf,
  winnings,
  type DicePair,
  type MathSummary,
  type Odds,
  type Rank,
  type Shoe,
} from '../../packages/engine/src/index.ts';
import { GAMES as CATALOG } from '../../apps/lobby/src/catalog.ts';
import { AUTHOR, REVISIONS, SITE, type Revision } from './revisions.ts';

const ROOT = new URL('../../', import.meta.url);

// ─── What the tests record (see packages/engine/src/testing/record.ts) ───

export interface Exact {
  readonly fraction: string;
  readonly value: number;
}

export interface OddsRecord {
  readonly to: number;
  readonly per: number;
  readonly returns: number;
}

export interface OutcomeRow {
  readonly entry: string;
  readonly label: string;
  readonly odds?: OddsRecord;
  readonly probability: Exact;
  readonly returns: Exact;
  readonly contribution: Exact;
}

export interface ExactFigures {
  readonly rtp: Exact;
  readonly houseEdge: Exact;
  readonly hitFrequency: Exact;
  readonly pushFrequency: Exact;
  readonly variance: Exact;
  readonly standardDeviation: number;
}

export interface Exposure {
  readonly stakes: Readonly<Record<string, number>>;
  readonly bets: Readonly<Record<string, { readonly win: number; readonly loss: number }>>;
  readonly layout: { readonly win: number; readonly loss: number };
}

export type SourceRecord =
  | {
      readonly kind: 'shoe';
      readonly decks: number;
      readonly ranks: readonly number[];
      readonly suits: number;
      readonly cards: number;
      readonly penetration: number;
      readonly cutCard: number;
      readonly behindCutCard: number;
    }
  | { readonly kind: 'infinite shoe'; readonly ranks: readonly number[]; readonly suits: number }
  | { readonly kind: 'uniform ranks'; readonly ranks: readonly number[] };

export interface Simulation {
  readonly rounds: number;
  readonly seed: string;
  readonly source: SourceRecord;
  readonly stakes: unknown;
  readonly strategy?: string;
  readonly z: number;
  readonly tolerance?: number;
  readonly rng: string;
  readonly confidence: { readonly level: number; readonly z: number };
}

export interface Verification {
  readonly expected: number;
  readonly observed: number;
  readonly difference: number;
  readonly standardError: number;
  readonly ci95: readonly [number, number];
  readonly errors: number;
  readonly allowed: number;
  readonly pass: boolean;
}

export interface Statistics {
  readonly rounds: number;
  readonly staked: number;
  readonly returned: number;
  readonly fees: number;
  readonly rtp: number;
  readonly houseEdge: number;
  readonly hitFrequency: number;
  readonly pushFrequency: number;
  readonly standardDeviation: number;
  readonly standardError: number;
}

export interface Counting {
  readonly favourable: number;
  readonly edgeWhenFavourable: number;
  readonly breakEvenSpread: number | null;
  readonly flatRtp?: number;
  readonly observedRtp?: number;
}

export interface Recorded<F> {
  readonly test: { readonly file: string; readonly name: string };
  readonly figures: F;
}

type Bets<T> = Readonly<Record<string, T>>;

export interface DiceSpreadRecords {
  readonly exact: Recorded<{
    readonly sampleSpace: {
      readonly rolls: number;
      readonly cardValues: number;
      readonly outcomes: number;
      readonly withSuits: number;
    };
    readonly source: SourceRecord;
    readonly bets: Bets<ExactFigures & { readonly outcomes: readonly OutcomeRow[] }>;
    readonly allBets: Exact;
    readonly maxExposure: Exposure;
  }>;
  readonly enumeration: Recorded<{
    readonly bets: readonly string[];
    readonly rows: readonly {
      readonly dice: readonly [number, number];
      readonly spread: number;
      readonly ways: number;
      readonly card: number;
      readonly probability: string;
      readonly net: Bets<string>;
    }[];
  }>;
  readonly counting: Recorded<{
    readonly shoe: SourceRecord;
    readonly cardValues: Bets<readonly string[]>;
    readonly countable: readonly string[];
    readonly penetrations: readonly {
      readonly penetration: number;
      readonly rounds: number;
      readonly bets: Bets<Counting & { readonly rounds: number }>;
    }[];
    readonly limits: { readonly min: number; readonly max: number; readonly spread: number };
  }>;
  readonly 'monte-carlo': Recorded<{
    readonly simulation: Simulation;
    readonly bets: Bets<{
      readonly statistics: Statistics;
      readonly rtp: Verification;
      readonly hitFrequency: Verification;
      readonly pushFrequency: Verification;
    }>;
  }>;
}

export interface TargetRow {
  readonly target: number;
  readonly rollChance: Exact;
  readonly win: Exact;
  readonly odds: OddsRecord;
  readonly returnGivenTarget: Exact;
  readonly edgeGivenTarget: Exact;
  readonly probability: Exact;
  readonly contribution: Exact;
}

export interface MovingTargetRecords {
  readonly exact: Recorded<{
    readonly sampleSpace: {
      readonly rolls: number;
      readonly targets: number;
      readonly cardValues: number;
      readonly outcomes: number;
      readonly sequences: Bets<number>;
    };
    readonly source: SourceRecord;
    readonly rolls: Bets<number>;
    readonly bets: Bets<
      ExactFigures & {
        readonly byTarget: readonly TargetRow[];
        readonly outcomes: readonly OutcomeRow[];
      }
    >;
    readonly maxExposure: Exposure;
  }>;
  readonly 'first-round': Recorded<{
    readonly shoe: SourceRecord;
    readonly perValue: number;
    readonly bets: Bets<{
      readonly rtp: Exact;
      readonly houseEdge: Exact;
      readonly declaredHouseEdge: number;
      readonly shift: number;
    }>;
    readonly byTarget: readonly {
      readonly target: number;
      readonly hit: Exact;
      readonly houseEdge: Exact;
      readonly declaredHouseEdge: number;
      readonly shift: number;
    }[];
  }>;
  readonly 'infinite-shoe': Recorded<{
    readonly simulation: Simulation;
    readonly bets: Bets<{
      readonly statistics: Statistics;
      readonly rtp: Verification;
      readonly hitFrequency: Verification;
    }>;
  }>;
  readonly 'six-deck-shoe': Recorded<{
    readonly simulation: Simulation;
    readonly maxShift: number;
    readonly bets: Bets<{ readonly statistics: Statistics; readonly houseEdge: Verification }>;
    readonly byTarget: readonly {
      readonly target: number;
      readonly rounds: number;
      readonly hits: number;
      readonly hitFrequency: { readonly declared: number; readonly observed: number };
      readonly houseEdge: Verification;
    }[];
  }>;
  readonly counting: Recorded<{
    readonly simulation: Simulation;
    readonly shuffles: number;
    readonly bets: Bets<Counting>;
  }>;
}

export interface MeterFigures {
  readonly hits: number;
  readonly roundsPerHit: number;
  readonly meterAtHit: number;
  readonly topUps: number;
  readonly topUpsPerRound: number;
  readonly topUpsShareOfStakes?: number;
  readonly rtpWithTopUps: number;
  readonly staked: number;
}

export interface MirrorRecords {
  readonly hands: Recorded<{
    readonly kinds: readonly {
      readonly rank: number;
      readonly high: number;
      readonly low: number;
      readonly pair: boolean;
      readonly sum: number;
      readonly label: string;
      readonly chance: Exact;
    }[];
    readonly matrix: readonly (readonly number[])[];
    readonly win: Exact;
    readonly tie: Exact;
    readonly lose: Exact;
  }>;
  readonly exact: Recorded<{
    readonly sampleSpace: {
      readonly rolls: number;
      readonly cards: number;
      readonly outcomes: number;
    };
    readonly source: SourceRecord;
    readonly bets: Bets<ExactFigures & { readonly outcomes: readonly OutcomeRow[] }>;
    readonly doubleSixesAtSeed: {
      readonly meter: number;
      readonly rtp: Exact;
      readonly variance: Exact;
      readonly standardDeviation: number;
    };
    readonly maxExposure: Exposure;
  }>;
  readonly meter: Recorded<{
    readonly terms: {
      readonly seed: number;
      readonly contributionRate: Exact;
      readonly fullShareStake: number;
      readonly hitChance: Exact;
      readonly cycleRounds: Exact;
    };
    readonly fixedRtp: Exact;
    readonly contributionRtp: Exact;
    readonly rtpExcludingSeed: Exact;
    readonly rtpAtSeed: Exact;
    readonly rtpPerMeterUnit: Exact;
    readonly breakEvenMeter: Exact;
    readonly seedCostPerRound: Exact;
    readonly seedCostShareAtMax: Exact;
    readonly meterAtHit: readonly { readonly meanStake: number; readonly meter: number }[];
    readonly example: {
      readonly stake: number;
      readonly meterBefore: number;
      readonly contribution: number;
      readonly meterAtHit: number;
      readonly fixedWin: number;
      readonly share: number;
      readonly payout: number;
      readonly meterAfterShare: number;
      readonly topUp: number;
      readonly meterAfter: number;
    };
  }>;
  readonly 'six-deck-exact': Recorded<{
    readonly shoe: SourceRecord;
    readonly sampleSpace: {
      readonly rolls: number;
      readonly firstCard: number;
      readonly secondCard: number;
      readonly outcomes: number;
    };
    readonly bets: Bets<{
      readonly hitFrequency: Exact;
      readonly rtp: Exact;
      readonly houseEdge: Exact;
      readonly variance: Exact;
      readonly standardDeviation: number;
    }>;
    readonly doubleSixes: {
      readonly fixedRtp: Exact;
      readonly rtpExcludingSeed: Exact;
      readonly cycleRounds: Exact;
      readonly breakEvenMeter: Exact;
    };
    readonly pairRatio: Exact;
  }>;
  readonly 'infinite-shoe': Recorded<{
    readonly simulation: Simulation;
    readonly budget: number;
    readonly results: Readonly<Record<string, Verification | Statistics>>;
    readonly meter: MeterFigures;
  }>;
  readonly 'six-deck-shoe': Recorded<{
    readonly simulation: Simulation;
    readonly results: Readonly<
      Record<string, (Verification & { readonly declared: number }) | Statistics>
    >;
    readonly meter: MeterFigures;
    readonly counting: Bets<Counting>;
  }>;
}

export interface DecisionRow {
  readonly dice: readonly [number, number];
  readonly chance: Exact;
  readonly free: boolean;
  readonly stand: Exact;
  readonly lockHigh: Exact;
  readonly lockLow: Exact;
  readonly best: 'stand' | 'lock-high' | 'lock-low';
  readonly margin: Exact;
  readonly bestWithoutFree: 'stand' | 'lock-high' | 'lock-low';
}

type LockAndRollFigures = ExactFigures & {
  readonly averageFee: Exact;
  readonly elementOfRisk?: Exact;
  readonly rerollFrequency?: Exact;
  readonly feeFrequency?: Exact;
};

export interface LockAndRollRecords {
  readonly strategy: Recorded<{
    readonly rules: { readonly fee: Exact; readonly freeOneOne: boolean };
    readonly rows: readonly DecisionRow[];
    readonly houseEdge: Exact;
    readonly rtp: Exact;
    readonly houseEdgeWithoutFree: Exact;
    readonly rtpWithoutFree: Exact;
    readonly rerolls: Exact;
    readonly rerollsWithoutFree: Exact;
    readonly freeOneOneWorth: Exact;
  }>;
  readonly exact: Recorded<{
    readonly sampleSpace: {
      readonly rolls: number;
      readonly rerolls: number;
      readonly cards: number;
      readonly outcomes: number;
    };
    readonly source: SourceRecord;
    readonly rules: { readonly fee: Exact; readonly freeOneOne: boolean };
    readonly outcomes: readonly {
      readonly decision: 'stand' | 'lock' | 'lock-free';
      readonly result: 'win' | 'lose';
      readonly probability: Exact;
      readonly net: Exact;
      readonly contribution: Exact;
    }[];
    readonly bet: LockAndRollFigures;
    readonly withoutFreeOneOne: LockAndRollFigures;
    readonly strategies: Bets<LockAndRollFigures>;
    readonly maxExposure: Exposure;
  }>;
  readonly 'six-deck-exact': Recorded<{
    readonly shoe: SourceRecord;
    readonly sampleSpace: {
      readonly rolls: number;
      readonly firstCard: number;
      readonly secondCard: number;
      readonly outcomes: number;
    };
    readonly bet: LockAndRollFigures;
    readonly shift: Exact;
  }>;
  readonly 'infinite-shoe': Recorded<{
    readonly simulation: Simulation;
    readonly statistics: Statistics;
    readonly results: Readonly<Record<string, Verification>>;
    readonly counts: {
      readonly rerolls: number;
      readonly freeRerolls: number;
      readonly feesPaid: number;
    };
  }>;
  readonly 'six-deck-shoe': Recorded<{
    readonly simulation: Simulation;
    readonly statistics: Statistics;
    readonly shuffles: number;
    readonly rerolls: number;
    readonly rtp: Verification & { readonly declared: number };
    readonly hitFrequency: Verification;
    readonly counting: Bets<Counting>;
  }>;
}

// ─── What the Rules of Play state about each table ───

export interface ShoeFacts {
  readonly decks: number;
  readonly ranks: readonly number[];
  readonly rankLabels: readonly string[];
  readonly lowest: string;
  readonly highest: string;
  readonly suits: number;
  readonly cardsPerDeck: number;
  readonly cards: number;
  readonly penetration: number;
  readonly cutCard: number;
  readonly behindCutCard: number;
}

export interface BetFacts {
  readonly id: string;
  readonly label: string;
  readonly kind: 'main' | 'side';
  readonly min: number;
  readonly max: number;
}

export interface Settled {
  readonly outcome: 'win' | 'lose' | 'push';
  readonly odds?: Odds;
}

/** A line of a bet's paytable as the felt prints it, with what it pays on one unit. */
export interface Pay {
  readonly bet: string;
  readonly entry: string;
  readonly label: string;
  readonly odds?: Odds;
  readonly push?: boolean;
  /** Winnings on a wager of one unit (the stake returned on top), in cents. */
  readonly onUnit?: number;
}

export interface Table {
  readonly dice: { readonly count: number; readonly faces: readonly number[] };
  readonly shoe: ShoeFacts;
  readonly bets: readonly BetFacts[];
  /** One unit, in cents: the wager the pays are shown on. */
  readonly unit: number;
  readonly pays: readonly Pay[];
}

export interface DiceSpreadTable extends Table {
  readonly spreads: readonly {
    readonly spread: number;
    readonly values: number;
    readonly odds: Odds;
    readonly onUnit: number;
  }[];
  readonly pushSpreads: readonly number[];
  readonly roundsPerShoe: number;
  readonly examples: readonly {
    readonly dice: readonly [number, number];
    readonly card: number;
    readonly spread: number;
    readonly results: Readonly<Record<string, Settled>>;
  }[];
}

export interface MovingTargetTable extends Table {
  readonly targets: readonly {
    readonly target: number;
    readonly odds: Odds;
    readonly onUnit: number;
  }[];
  readonly cardValues: { readonly lowest: number; readonly highest: number };
  readonly cardsPerRound: { readonly least: number; readonly most: number };
  readonly firstCardTargets: number;
  readonly threePlusCards: number;
  readonly examples: readonly {
    readonly dice: readonly [number, number];
    readonly target: number;
    readonly cards: readonly number[];
    readonly totals: readonly number[];
    readonly total: number;
    readonly over: number;
    readonly results: Readonly<Record<string, Settled>>;
  }[];
}

export interface MirrorTable extends Table {
  readonly roundsPerShoe: number;
  readonly ranking: readonly {
    readonly label: string;
    readonly pair: boolean;
    readonly high: number;
    readonly low: number;
    readonly sum: number;
  }[];
  readonly meter: {
    readonly seed: number;
    readonly contributionRate: number;
    readonly fullShareStake: number;
    readonly fixedOdds: Odds;
    /** What a minimum stake takes of the meter. */
    readonly minimumShare: number;
  };
  readonly examples: readonly {
    readonly dice: readonly [number, number];
    readonly cards: readonly [number, number];
    readonly diceHand: string;
    readonly cardsHand: string;
    readonly result: 'dice' | 'cards' | 'tie';
    readonly results: Readonly<Record<string, Settled>>;
  }[];
}

export interface LockAndRollTable extends Table {
  readonly roundsPerShoe: number;
  readonly odds: Odds;
  readonly fee: {
    readonly numerator: number;
    readonly denominator: number;
    readonly rate: number;
    readonly onUnit: number;
    readonly unit: number;
    readonly exactOn: number;
    readonly freeOneOne: boolean;
    readonly freeRoll: readonly [number, number];
  };
  readonly totals: { readonly lowest: number; readonly highest: number };
  readonly examples: readonly {
    readonly bet: number;
    readonly roll: readonly [number, number];
    readonly choice: 'stand' | 'lock';
    readonly kept?: number;
    readonly rerolled?: number;
    readonly landed?: number;
    readonly dice: readonly [number, number];
    readonly fee: number;
    readonly cards: readonly [number, number];
    readonly diceTotal: number;
    readonly cardsTotal: number;
    readonly result: 'win' | 'lose';
    readonly tie: boolean;
    readonly net: number;
  }[];
}

export interface GameResults<TTable extends Table, TRecords> {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly url: string;
  readonly revision: Revision;
  readonly revisions: readonly (Revision & { readonly author: string })[];
  readonly table: TTable;
  readonly summary: MathSummary;
  readonly records: TRecords;
}

export interface Results {
  readonly about: string;
  readonly meta: {
    readonly version: string;
    readonly commit: string;
    readonly commitDate: string;
    readonly author: string;
    readonly generator: string;
    readonly site: string;
    readonly pack: string;
  };
  readonly games: {
    readonly 'dice-spread': GameResults<DiceSpreadTable, DiceSpreadRecords>;
    readonly 'moving-target': GameResults<MovingTargetTable, MovingTargetRecords>;
    readonly mirror: GameResults<MirrorTable, MirrorRecords>;
    readonly 'lock-and-roll': GameResults<LockAndRollTable, LockAndRollRecords>;
  };
}

// ─── Building them ───

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

/**
 * The last commit that changed the engine (its code, its tests or their
 * records): the code every figure comes from. The documents are committed
 * after it, so they can name it. Uncommitted changes to the engine mark it.
 */
function engineCommit(): { readonly commit: string; readonly commitDate: string } {
  const [commit = '', commitDate = ''] = git(
    'log',
    '-1',
    '--format=%H %cs',
    '--',
    'packages/engine',
  ).split(' ');
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error('No commit touches packages/engine: is the history complete (fetch-depth: 0)?');
  }
  const dirty = git('status', '--porcelain', '--', 'packages/engine') !== '';
  return { commit: dirty ? `${commit}+uncommitted` : commit, commitDate };
}

function readRecords(id: string): Record<string, Recorded<unknown>> {
  const dir = new URL(`packages/engine/src/games/${id}/results/`, ROOT);
  if (!existsSync(dir))
    throw new Error(`${id} has no recorded results: run pnpm test and pnpm test:math`);
  const records: Record<string, Recorded<unknown>> = {};
  for (const file of readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()) {
    const record = JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as Recorded<unknown>;
    // A record must still have its test: a removed or renamed test leaves it stale.
    const test = new URL(record.test.file, ROOT);
    const title = record.test.name.split(' › ').at(-1)!;
    if (!existsSync(test) || !readFileSync(test, 'utf8').includes(title.slice(0, 40))) {
      throw new Error(`${id}/${file}: its test "${record.test.name}" is gone; remove the record`);
    }
    records[file.replace(/\.json$/, '')] = record;
  }
  return records;
}

function shoeFacts(shoe: Shoe): ShoeFacts {
  const labels = shoe.ranks.map((rank) => rankLabel(rank));
  return {
    decks: shoe.decks,
    ranks: shoe.ranks,
    rankLabels: labels,
    lowest: labels[0]!,
    highest: labels.at(-1)!,
    suits: 4,
    cardsPerDeck: shoe.size() / shoe.decks,
    cards: shoe.size(),
    penetration: shoe.penetration,
    cutCard: shoe.cutCardPosition(),
    behindCutCard: shoe.size() - shoe.cutCardPosition(),
  };
}

function betFacts(summary: MathSummary): BetFacts[] {
  return summary.bets.map(({ betId, label, kind, min, max }) => ({
    id: betId,
    label,
    kind,
    min,
    max,
  }));
}

const UNIT = 100;

function pays(summary: MathSummary): Pay[] {
  return summary.bets.flatMap((bet) =>
    bet.paytable.map((entry) => ({
      bet: bet.betId,
      entry: entry.id,
      label: entry.label,
      ...('odds' in entry ? { odds: entry.odds, onUnit: winnings(UNIT, entry.odds) } : {}),
      ...('push' in entry ? { push: true } : {}),
    })),
  );
}

/** What every table shares: the dice, the shoe, the bets and their pays. */
function common(shoe: Shoe, summary: MathSummary): Table {
  return {
    dice: { count: 2, faces: DIE_FACES },
    shoe: shoeFacts(shoe),
    bets: betFacts(summary),
    unit: UNIT,
    pays: pays(summary),
  };
}

function diceSpreadTable(summary: MathSummary): DiceSpreadTable {
  const shoe = createDiceSpreadShoe();
  const settle = (dice: DicePair, card: number) =>
    Object.fromEntries(
      DICE_SPREAD_BET_IDS.map((bet) => {
        const result = resolveDiceSpreadBet(bet, dice, card as Rank);
        return [
          bet,
          result.outcome === 'win'
            ? { outcome: 'win', odds: result.odds }
            : { outcome: result.outcome },
        ];
      }),
    ) as Record<string, Settled>;
  const examples: [DicePair, number][] = [
    [[2, 5], 3],
    [[4, 6], 5],
    [[3, 3], 3],
    [[1, 6], 6],
  ];
  return {
    ...common(shoe, summary),
    spreads: ([2, 3, 4, 5] as const).map((spread) => ({
      spread,
      values: spread - 1,
      odds: BETWEEN_ODDS[spread],
      onUnit: winnings(UNIT, BETWEEN_ODDS[spread]),
    })),
    pushSpreads: [0, 1],
    // One card a round: the rounds of a shoe are the cards dealt before the cut card.
    roundsPerShoe: shoe.cutCardPosition(),
    examples: examples.map(([dice, card]) => ({
      dice: [Math.max(...dice), Math.min(...dice)],
      card,
      spread: readDiceSpreadRoll(dice).spread,
      results: settle(dice, card),
    })),
  };
}

function movingTargetTable(summary: MathSummary): MovingTargetTable {
  const shoe = createMovingTargetShoe();
  const examples: [DicePair, number[]][] = [
    [
      [3, 4],
      [3, 4],
    ],
    [[1, 4], [5]],
    [
      [6, 6],
      [10, 5],
    ],
    [
      [5, 6],
      [1, 2, 3, 7],
    ],
  ];
  return {
    ...common(shoe, summary),
    targets: TARGETS.map((target) => ({
      target,
      odds: EXACT_HIT_ODDS[target],
      onUnit: winnings(UNIT, EXACT_HIT_ODDS[target]),
    })),
    cardValues: { lowest: 1, highest: MAX_CARD_VALUE },
    // The highest target, reached by aces alone, takes the most cards.
    cardsPerRound: { least: 1, most: Math.max(...TARGETS) },
    firstCardTargets: MAX_CARD_VALUE,
    threePlusCards: 3,
    examples: examples.map(([dice, cards]) => {
      const target = targetOf(dice);
      const deal = readMovingTargetDeal(target, cards);
      let running = 0;
      return {
        dice: [Math.max(...dice), Math.min(...dice)],
        target,
        cards,
        totals: cards.map((card) => (running += card)),
        total: deal.total,
        over: deal.over,
        results: Object.fromEntries(
          MOVING_TARGET_BET_IDS.map((bet) => {
            const result = resolveMovingTargetBet(bet, target, cards);
            return [
              bet,
              result.outcome === 'win'
                ? { outcome: 'win', odds: result.odds }
                : { outcome: 'lose' },
            ];
          }),
        ),
      };
    }),
  };
}

function mirrorTable(summary: MathSummary): MirrorTable {
  const shoe = createMirrorShoe();
  const hands = DIE_FACES.flatMap((high) =>
    DIE_FACES.filter((low) => low <= high).map((low) => readHand([high, low])),
  ).sort((a, b) => b.strength - a.strength);
  const examples: [DicePair, readonly [number, number]][] = [
    [
      [6, 3],
      [5, 4],
    ],
    [
      [1, 1],
      [6, 5],
    ],
    [
      [5, 2],
      [5, 2],
    ],
    [
      [4, 4],
      [4, 4],
    ],
  ];
  const { seed, contributionRate } = MIRROR_CONFIG.jackpot;
  return {
    ...common(shoe, summary),
    // Two cards a round.
    roundsPerShoe: shoe.cutCardPosition() / 2,
    ranking: hands.map(({ label, pair, high, low, sum }) => ({ label, pair, high, low, sum })),
    meter: {
      seed,
      contributionRate,
      fullShareStake: MIRROR_CONFIG.sideMax,
      fixedOdds: MIRROR_CONFIG.odds.doubleSixes,
      minimumShare: MIRROR_CONFIG.sideMin / MIRROR_CONFIG.sideMax,
    },
    examples: examples.map(([dice, cards]) => {
      const order = compareHands(dice, cards);
      return {
        dice: [dice[0], dice[1]],
        cards: [cards[0], cards[1]],
        diceHand: readHand(dice).label,
        cardsHand: readHand(cards).label,
        result: order === 1 ? 'dice' : order === -1 ? 'cards' : 'tie',
        results: Object.fromEntries(
          MIRROR_BET_IDS.map((bet) => {
            const result = resolveMirrorBet(bet, dice, cards);
            return [
              bet,
              result.outcome === 'win'
                ? { outcome: 'win', odds: result.odds }
                : { outcome: 'lose' },
            ];
          }),
        ),
      };
    }),
  };
}

function lockAndRollTable(summary: MathSummary): LockAndRollTable {
  const shoe = createLockAndRollShoe();
  const { rules, odds } = LOCK_AND_ROLL_CONFIG;
  const unit = UNIT;
  interface Example {
    roll: DicePair;
    lock?: { kept: 0 | 1; landed: number };
    cards: readonly [number, number];
  }
  const examples: Example[] = [
    { roll: [6, 1], lock: { kept: 0, landed: 4 }, cards: [5, 3] },
    { roll: [1, 1], lock: { kept: 0, landed: 5 }, cards: [3, 3] },
    { roll: [6, 2], cards: [6, 5] },
  ];
  return {
    ...common(shoe, summary),
    roundsPerShoe: shoe.cutCardPosition() / 2,
    odds,
    fee: {
      numerator: rules.fee.numerator,
      denominator: rules.fee.denominator,
      rate: rules.fee.numerator / rules.fee.denominator,
      onUnit: paidLockFee(unit, rules),
      unit,
      // The fee is a whole number of cents on any bet that is a multiple of this.
      exactOn: rules.fee.denominator,
      freeOneOne: rules.freeOneOne,
      freeRoll: [1, 1],
    },
    totals: { lowest: 2, highest: 12 },
    examples: examples.map(({ roll, lock, cards }) => {
      const kept = lock === undefined ? undefined : roll[lock.kept];
      const dice: DicePair =
        lock === undefined ? roll : ([kept!, lock.landed] as unknown as DicePair);
      const fee = lock === undefined ? 0 : lockFee(unit, roll, rules);
      const diceTotal = dice[0] + dice[1];
      const cardsTotal = cards[0] + cards[1];
      const won = lockAndRollWins(diceTotal, cardsTotal);
      return {
        bet: unit,
        roll: [roll[0], roll[1]],
        choice: lock === undefined ? 'stand' : 'lock',
        ...(lock === undefined
          ? {}
          : { kept: kept!, rerolled: roll[lock.kept === 0 ? 1 : 0], landed: lock.landed }),
        dice: [dice[0], dice[1]],
        fee,
        cards: [cards[0], cards[1]],
        diceTotal,
        cardsTotal,
        result: won ? 'win' : 'lose',
        tie: diceTotal === cardsTotal,
        net: (won ? unit : -unit) - fee,
      };
    }),
  };
}

function game<TTable extends Table, TRecords>(
  id: string,
  table: (summary: MathSummary) => TTable,
): GameResults<TTable, TRecords> {
  const entry = GAMES.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`The engine has no game ${id}`);
  const revisions = REVISIONS[id];
  if (revisions === undefined || revisions.length === 0)
    throw new Error(`${id} has no revision history`);
  // Through JSON, as results.json holds it.
  const summary = JSON.parse(JSON.stringify(entry.mathSummary())) as MathSummary;
  return {
    id,
    name: entry.name,
    tagline: CATALOG.find((table) => table.slug === id)!.tagline,
    url: `${SITE}${id}`,
    revision: revisions.at(-1)!,
    revisions: revisions.map((revision) => ({ ...revision, author: AUTHOR })),
    table: table(summary),
    summary,
    records: readRecords(id) as TRecords,
  };
}

export function buildResults(): Results {
  const version = (
    JSON.parse(readFileSync(new URL('packages/engine/package.json', ROOT), 'utf8')) as {
      version: string;
    }
  ).version;
  const results: Results = {
    about:
      'Every figure of the Rules of Play and Math Reports (docs/rules, docs/math), as ' +
      'tools/generate-docs.ts wrote them: the games’ math summaries, the figures their tests ' +
      'recorded, and the table facts read from the engine. Regenerate with pnpm docs:generate.',
    meta: {
      version,
      ...engineCommit(),
      author: AUTHOR,
      generator: 'tools/generate-docs.ts',
      site: SITE,
      pack: 'docs/SUBMISSION-PACK.pdf',
    },
    games: {
      'dice-spread': game('dice-spread', diceSpreadTable),
      'moving-target': game('moving-target', movingTargetTable),
      mirror: game('mirror', mirrorTable),
      'lock-and-roll': game('lock-and-roll', lockAndRollTable),
    },
  };
  // Exactly the games the engine registers.
  const ids = Object.keys(results.games);
  if (ids.join() !== GAMES.map((entry) => entry.id).join()) {
    throw new Error(
      `The engine registers ${GAMES.map((entry) => entry.id).join(', ')}, not ${ids.join(', ')}`,
    );
  }
  return JSON.parse(JSON.stringify(results)) as Results;
}
