/**
 * Mirror's declared math, proven exactly.
 *
 * The brief declares the figures for dice against two cards from an
 * infinite shoe of aces to sixes: 36 rolls × 24 × 24 cards. This suite
 * reproduces that table by enumerating those draws with the ranking written
 * from the rules, checks that the declared fractions (bets.ts) are the same
 * numbers, and runs the real game over every one of the 20,736 draws. The
 * progressive meter is kept out of the fixed-pay figures (a meter at zero),
 * then frozen at a value to check what a hit pays from it.
 */
import { describe, expect, it } from 'vitest';
import { RANK_SETS } from '../../cards/card.ts';
import { Shoe } from '../../cards/shoe.ts';
import { expectedMeterAtHit, progressiveRtpAtMeter } from '../../game/math-summary.ts';
import type { Bets } from '../../game/types.ts';
import { exactReturns } from '../../math/exact.ts';
import { Fraction } from '../../math/fraction.ts';
import { ProgressiveJackpot } from '../../progressive/progressive.ts';
import {
  exact,
  exactFigures,
  exposure,
  outcomeTable,
  recordFigures,
} from '../../testing/record.ts';
import { createScriptedCardSource } from '../../testing/scripted-cards.ts';
import { createScriptedRng, scriptForDice } from '../../testing/scripted-rng.ts';
import {
  MIRROR_BETS,
  MIRROR_MATH,
  DOUBLE_SIXES_FIXED_RTP,
  DOUBLE_SIXES_RTP,
  DOUBLE_SIXES_RTP_AT_SEED,
} from './bets.ts';
import { MIRROR_CONFIG } from './config.ts';
import { createMirror, mirrorMathSummary } from './game.ts';
import { compareHands, readHand } from './rules.ts';

const { jackpot: METER, sideMax } = MIRROR_CONFIG;
const pct = (ratio: number, digits = 2) => `${(ratio * 100).toFixed(digits)}%`;
const bet = (id: string) => MIRROR_BETS.find((definition) => definition.id === id)!;

/** A meter that never moves from `amount`: no contributions, and a hit refills it to itself. */
const frozenMeter = (amount: number) =>
  new ProgressiveJackpot({ id: METER.id, seed: amount, contributionRate: 0 });

/** Every bet at 1.00 (Double Sixes included), where each payout is a whole number of cents. */
const ALL_BETS: Bets = Object.fromEntries(MIRROR_BETS.map(({ id }) => [id, 100]));

describe('Mirror — the declared table, from 36 × 24 × 24 draws', () => {
  /** The ranking as the rules state it: pairs first, by value; then by sum, then the higher value. */
  const strength = (a: number, b: number) => (a === b ? 1_000 + a : 10 * (a + b) + Math.max(a, b));

  // Tally every roll against every ordered pair of cards (24 per deck: 4 suits × 6 values).
  const tally = { win: 0, tie: 0, sum: 0, pairs: 0, same: 0, sixes: 0, total: 0 };
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      for (let first = 0; first < 24; first++) {
        for (let second = 0; second < 24; second++) {
          const [c1, c2] = [1 + (first % 6), 1 + (second % 6)];
          const [player, dealer] = [strength(d1, d2), strength(c1, c2)];
          tally.total++;
          if (player > dealer) tally.win++;
          if (player === dealer) tally.tie++;
          if (d1 + d2 === c1 + c2) tally.sum++;
          if (d1 === d2 && c1 === c2) tally.pairs++;
          if (d1 === d2 && c1 === c2 && d1 === c1) tally.same++;
          if (d1 === 6 && d2 === 6 && c1 === 6 && c2 === 6) tally.sixes++;
        }
      }
    }
  }
  const p = (count: number) => count / tally.total;
  const edge = (count: number, pays: number) => 1 - (pays + 1) * p(count);

  it('reproduces the published figures', () => {
    expect(tally.total).toBe(20_736);
    // Mirror: player wins 47.45%, tie 5.09%, house edge 5.09%.
    expect([pct(p(tally.win)), pct(p(tally.tie)), pct(edge(tally.win, 1))]).toEqual([
      '47.45%',
      '5.09%',
      '5.09%',
    ]);
    // Tie: P = 5.09%, house edge 8.33%.
    expect([pct(p(tally.tie)), pct(edge(tally.tie, 17))]).toEqual(['5.09%', '8.33%']);
    // Pair vs Pair: 2.78%, 13.89%. Perfect Mirror: 0.46%, 6.94%.
    expect([pct(p(tally.pairs)), pct(edge(tally.pairs, 30))]).toEqual(['2.78%', '13.89%']);
    expect([pct(p(tally.same)), pct(edge(tally.same, 200))]).toEqual(['0.46%', '6.94%']);
    // Double Sixes: 0.077%, house edge 22.76% on the fixed pay.
    expect([pct(p(tally.sixes), 3), pct(edge(tally.sixes, 1000))]).toEqual(['0.077%', '22.76%']);
  });

  it('corrects one figure: Equal Sums has an edge of 9.88%, not 9.85%', () => {
    // P = 146/1296 = 11.27% as published; at 7 to 1 the edge is 1 − 8 × 146/1296 = 8/81.
    expect(pct(p(tally.sum))).toBe('11.27%');
    expect(Fraction.ONE.sub(Fraction.of(8 * tally.sum, tally.total)).toString()).toBe('8/81');
    expect(pct(edge(tally.sum, 7))).toBe('9.88%');
  });

  it('ranks the 21 kinds of hand as the rules state, and every dice hand against every card hand', async () => {
    // One hand of each kind, weakest first, read by the engine.
    const kinds = [1, 2, 3, 4, 5, 6]
      .flatMap((high) => [1, 2, 3, 4, 5, 6].filter((low) => low <= high).map((low) => [high, low]))
      .map(([high, low]) => ({ high: high!, low: low!, hand: readHand([high!, low!]) }))
      .sort((a, b) => a.hand.strength - b.hand.strength);
    expect(kinds).toHaveLength(21);
    const chance = (kind: { high: number; low: number }) =>
      Fraction.of(kind.high === kind.low ? 1 : 2, 36);
    let win = Fraction.ZERO;
    let tie = Fraction.ZERO;
    const matrix = kinds.map((dice) =>
      kinds.map((cards) => {
        const result = compareHands([dice.high, dice.low], [cards.high, cards.low]);
        // The engine's comparison is the ranking written here from the rules.
        const ruled = Math.sign(strength(dice.high, dice.low) - strength(cards.high, cards.low));
        expect(result).toBe(ruled);
        const both = chance(dice).mul(chance(cards));
        if (result === 1) win = win.add(both);
        if (result === 0) tie = tie.add(both);
        return result;
      }),
    );
    // Only identical kinds tie; the chances are those of the declared table.
    expect(matrix.every((row, i) => row.every((cell, j) => (cell === 0) === (i === j)))).toBe(true);
    expect(win.equals(Fraction.of(tally.win, tally.total))).toBe(true);
    expect(tie.equals(Fraction.of(tally.tie, tally.total))).toBe(true);
    await recordFigures('hands', {
      kinds: kinds.map((kind, index) => ({
        rank: kinds.length - index,
        high: kind.high,
        low: kind.low,
        pair: kind.hand.pair,
        sum: kind.hand.sum,
        label: kind.hand.label,
        chance: exact(chance(kind)),
      })),
      matrix,
      win: exact(win),
      tie: exact(tie),
      lose: exact(Fraction.ONE.sub(win).sub(tie)),
    });
  });

  it('is exactly the math the bets declare', () => {
    const declared = MIRROR_MATH;
    const exact = (count: number) => Fraction.of(count, tally.total);
    expect(declared.mirror.p.equals(exact(tally.win))).toBe(true);
    expect(declared.tie.p.equals(exact(tally.tie))).toBe(true);
    expect(declared.equalSums.p.equals(exact(tally.sum))).toBe(true);
    expect(declared.pairVsPair.p.equals(exact(tally.pairs))).toBe(true);
    expect(declared.perfectMirror.p.equals(exact(tally.same))).toBe(true);
    expect(declared.doubleSixes.p.equals(exact(tally.sixes))).toBe(true);
    expect(
      [declared.mirror, declared.tie, declared.equalSums, declared.pairVsPair].map(({ p: q }) =>
        q.toString(),
      ),
    ).toEqual(['205/432', '11/216', '73/648', '1/36']);
    expect(declared.perfectMirror.p.toString()).toBe('1/216');
    expect(declared.doubleSixes.p.toString()).toBe('1/1296');
  });
});

describe('Mirror — the game over every draw of the dice and an infinite shoe', () => {
  const infiniteShoe = () => new Shoe({ decks: Infinity, ranks: RANK_SETS.aceToSix });
  // The fixed pays alone: a meter at zero pays nothing on top.
  const report = exactReturns(
    () => createMirror({ source: infiniteShoe(), jackpot: frozenMeter(0) }),
    ALL_BETS,
  );

  const FIXED: readonly [string, keyof typeof MIRROR_MATH, string, string][] = [
    ['mirror', 'mirror', 'higher', '205/216'],
    ['tie', 'tie', 'tie', '11/12'],
    ['equal-sums', 'equalSums', 'same-sum', '73/81'],
    ['pair-vs-pair', 'pairVsPair', 'pairs', '31/36'],
    ['perfect-mirror', 'perfectMirror', 'same-pair', '67/72'],
  ];

  it('enumerates 36 rolls × 24 × 24 cards', () => {
    expect(report.outcomes).toBe(20_736);
  });

  it("adds up each bet's outcomes to its declared figures, and finds the most a round can pay", async () => {
    const summary = mirrorMathSummary();
    const bets = Object.fromEntries(
      summary.bets.map((declared) => {
        const result = report.bets[declared.betId]!;
        const fixed = declared.progressive === undefined;
        expect(result.rtp.toNumber()).toBe(fixed ? declared.rtp : declared.progressive.fixedRtp);
        return [
          declared.betId,
          { outcomes: outcomeTable(declared.paytable, result), ...exactFigures(result) },
        ];
      }),
    );
    // Double Sixes with the meter at its seed: a hit pays 1000 to 1 plus seed ÷ SIDE_MAX.
    const atSeed = exactReturns(
      () => createMirror({ source: infiniteShoe(), jackpot: frozenMeter(METER.seed) }),
      { mirror: 100, 'double-sixes': 100 },
    ).bets['double-sixes']!;
    expect(atSeed.standardDeviation).toBeCloseTo(bet('double-sixes').standardDeviation!, 12);
    // Every bet at its maximum, the meter at its seed.
    const atMax = exposure(
      () => createMirror({ source: infiniteShoe(), jackpot: frozenMeter(METER.seed) }),
      Object.fromEntries(MIRROR_BETS.map(({ id, max }) => [id, max])),
    );
    for (const declared of summary.bets) {
      const most = atMax.bets[declared.betId]!.win;
      const perUnit = declared.maxExposure ?? declared.progressive!.maxExposureAtSeed;
      expect(most).toBe(perUnit * declared.max);
    }
    await recordFigures('exact', {
      sampleSpace: { rolls: 36, cards: 24 * 24, outcomes: report.outcomes },
      source: { kind: 'infinite shoe', ranks: RANK_SETS.aceToSix, suits: 4 },
      bets,
      doubleSixesAtSeed: {
        meter: METER.seed,
        rtp: exact(atSeed.rtp),
        variance: exact(atSeed.variance),
        standardDeviation: atSeed.standardDeviation,
      },
      maxExposure: atMax,
    });
  });

  it.each(FIXED)(
    '%s returns exactly its declared RTP, hit chance and volatility',
    (id, key, entry, rtp) => {
      const result = report.bets[id]!;
      const definition = bet(id);
      expect(result.rtp.toString()).toBe(rtp);
      expect(result.rtp.toNumber()).toBe(definition.rtp);
      expect(result.hitFrequency.equals(MIRROR_MATH[key].p)).toBe(true);
      expect(result.entries[entry]!.equals(MIRROR_MATH[key].p)).toBe(true);
      expect(result.pushFrequency.equals(Fraction.ZERO)).toBe(true);
      expect(result.standardDeviation).toBeCloseTo(definition.standardDeviation!, 12);
    },
  );

  it('pays Double Sixes its fixed 1000 to 1 on a hit 1 time in 1,296: 1001/1296', () => {
    const result = report.bets['double-sixes']!;
    expect(result.hitFrequency.toString()).toBe('1/1296');
    expect(result.entries['six-six']!.toString()).toBe('1/1296');
    expect(result.rtp.toString()).toBe('1001/1296');
    expect(result.rtp.equals(DOUBLE_SIXES_FIXED_RTP)).toBe(true);
    expect(pct(1 - result.rtp.toNumber())).toBe('22.76%');
  });

  it('declares Double Sixes at its fixed pays plus the contributions: 87.24%, the seed excluded', () => {
    expect(DOUBLE_SIXES_RTP.toString()).toBe('5653/6480');
    expect(DOUBLE_SIXES_RTP.equals(DOUBLE_SIXES_FIXED_RTP.add(Fraction.of(1, 10)))).toBe(true);
    expect(DOUBLE_SIXES_RTP.toNumber()).toBe(bet('double-sixes').rtp);
    expect([pct(DOUBLE_SIXES_RTP.toNumber()), pct(1 - DOUBLE_SIXES_RTP.toNumber())]).toEqual([
      '87.24%',
      '12.76%',
    ]);
  });

  it('takes the volatility index of Double Sixes with the meter at its seed', () => {
    const atSeed = exactReturns(
      () => createMirror({ source: infiniteShoe(), jackpot: frozenMeter(METER.seed) }),
      { mirror: 100, 'double-sixes': 100 },
    ).bets['double-sixes']!;
    // A hit pays 1 + 1000 + 5,000.00 ÷ 25.00 = 1201 per unit staked.
    expect(atSeed.rtp.toString()).toBe('1201/1296');
    expect(atSeed.rtp.equals(DOUBLE_SIXES_RTP_AT_SEED)).toBe(true);
    expect(atSeed.variance.toString()).toBe(Fraction.of(1201 ** 2 * 1295, 1296 ** 2).toString());
    expect(atSeed.standardDeviation).toBeCloseTo(bet('double-sixes').standardDeviation!, 12);
  });
});

describe('Mirror — the progressive meter', () => {
  /** One round of 6-6 against 6-6 with the meter frozen at `meter`. */
  function hit(meter: number, stake: number) {
    const game = createMirror({
      source: createScriptedCardSource('6S 6H'),
      jackpot: frozenMeter(meter),
    });
    const state = game.start(
      { mirror: 100, 'double-sixes': stake },
      createScriptedRng(scriptForDice([6, 6])),
    );
    const won = state.events.find((event) => event.type === 'jackpot-won');
    return {
      line: state.settlement['double-sixes']!,
      share: won?.type === 'jackpot-won' ? won.amount : 0,
    };
  }

  it('pays every stake the same per unit: 1000 to 1 plus the meter ÷ 25.00', () => {
    // At the seed, at the break-even meter and above it (values the 0.50 stake divides exactly).
    for (const meter of [500_000, 737_500, 1_234_550]) {
      const perUnit = new Set(
        [50, 100, 500, 2_500].map((stake) => {
          const { line, share } = hit(meter, stake);
          expect(share).toBe((stake * meter) / sideMax);
          return line.payout / stake;
        }),
      );
      expect([...perUnit]).toEqual([1 + 1000 + meter / sideMax]);
    }
  });

  it('rounds the share down to the cent and keeps the rest in the meter', () => {
    const jackpot = new ProgressiveJackpot({ id: METER.id, seed: 500_000, contributionRate: 0.1 });
    jackpot.contribute(1_234_567); // 123,456.7¢ more: the meter is 623,456.7¢
    const game = createMirror({ source: createScriptedCardSource('6S 6H'), jackpot });
    const state = game.start(
      { mirror: 100, 'double-sixes': 150 },
      createScriptedRng(scriptForDice([6, 6])),
    );
    // The round's own 15¢ goes in first: 623,471.7¢ × 150/2,500 = 37,408.302¢ → 37,408¢.
    expect(state.settlement['double-sixes']!.payout).toBe(150 + 150_000 + 37_408);
    expect(jackpot.amount).toBe(586_063); // 623,471.7 − 37,408 = 586,063.7¢
  });

  it('prices the meter, and pays the worked example of the rules', async () => {
    const terms = mirrorMathSummary().bets.find(
      ({ betId }) => betId === 'double-sixes',
    )!.progressive!;
    const hitChance = MIRROR_MATH.doubleSixes.p;
    const contribution = Fraction.of(Math.round(METER.contributionRate * 1_000_000), 1_000_000);
    const fixedRtp = DOUBLE_SIXES_FIXED_RTP;
    // Break-even: fixedRtp + hitChance × M ÷ SIDE_MAX = 1.
    const breakEven = Fraction.ONE.sub(fixedRtp).mul(Fraction.of(sideMax)).div(hitChance);
    expect(breakEven.toNumber()).toBeCloseTo(terms.breakEvenMeter, 6);
    const seedCost = Fraction.of(METER.seed).mul(hitChance);
    expect(seedCost.toNumber()).toBeCloseTo(terms.seedCostPerRound, 9);
    // The meter at a hit, when every cycle starts at the seed: seed + rate × mean stake × cycle.
    const meanStakes = [50, 100, 500, (50 + 100 + 500 + 2_500) / 4, 2_500];
    const atHit = meanStakes.map((meanStake) => ({
      meanStake,
      meter: expectedMeterAtHit(terms, meanStake),
    }));
    // The worked example: 5.00 on Double Sixes with the meter at 6,000.00, then 6-6 against 6-6.
    const jackpot = new ProgressiveJackpot({
      id: METER.id,
      seed: METER.seed,
      contributionRate: METER.contributionRate,
    });
    jackpot.contribute(1_000_000); // 10% of 10,000.00: the meter is 6,000.00
    const before = jackpot.amount;
    expect(before).toBe(600_000);
    const game = createMirror({ source: createScriptedCardSource('6S 6H'), jackpot });
    const state = game.start(
      { mirror: 100, 'double-sixes': 500 },
      createScriptedRng(scriptForDice([6, 6])),
    );
    const meters = state.events.flatMap((event) => (event.type === 'jackpot-meter' ? [event] : []));
    const won = state.events.find((event) => event.type === 'jackpot-won');
    const line = state.settlement['double-sixes']!;
    const share = won?.type === 'jackpot-won' ? won.amount : 0;
    expect(share).toBe(120_010);
    expect(jackpot.amount).toBe(METER.seed);
    await recordFigures('meter', {
      terms: {
        seed: METER.seed,
        contributionRate: exact(contribution),
        fullShareStake: sideMax,
        hitChance: exact(hitChance),
        cycleRounds: exact(Fraction.ONE.div(hitChance)),
      },
      fixedRtp: exact(fixedRtp),
      contributionRtp: exact(contribution),
      rtpExcludingSeed: exact(DOUBLE_SIXES_RTP),
      rtpAtSeed: exact(DOUBLE_SIXES_RTP_AT_SEED),
      /** One round's return with the meter at M: fixedRtp + M × hitChance ÷ SIDE_MAX. */
      rtpPerMeterUnit: exact(hitChance.div(Fraction.of(sideMax))),
      breakEvenMeter: exact(breakEven),
      seedCostPerRound: exact(seedCost),
      seedCostShareAtMax: exact(seedCost.div(Fraction.of(sideMax))),
      meterAtHit: atHit,
      example: {
        stake: 500,
        meterBefore: before,
        contribution: meters[0]!.amount - before,
        meterAtHit: meters[0]!.amount,
        fixedWin: line.payout - line.stake - share,
        share,
        payout: line.payout,
        meterAfterShare: meters[0]!.amount - share,
        topUp: METER.seed - (meters[0]!.amount - share),
        meterAfter: jackpot.amount,
      },
    });
  });

  it('is worth 92.67% at its seed and breaks even at 7,375.00', () => {
    const terms = mirrorMathSummary().bets.find(
      ({ betId }) => betId === 'double-sixes',
    )!.progressive!;
    expect(pct(progressiveRtpAtMeter(terms, METER.seed))).toBe('92.67%');
    expect(Math.abs(progressiveRtpAtMeter(terms, 737_500) - 1)).toBeLessThan(1e-4); // ±0.01 pp
    expect(terms.breakEvenMeter).toBeCloseTo(737_500, 6);
    expect(terms.rtpAtSeed).toBeCloseTo(DOUBLE_SIXES_RTP_AT_SEED.toNumber(), 15);
    expect(terms.cycleRounds).toBeCloseTo(1_296, 9);
    // The house re-seeds 5,000.00 after each hit at 25.00: 3.86 per round.
    expect((terms.seedCostPerRound / 100).toFixed(2)).toBe('3.86');
    // A cycle adds 10% × 1,296 × the mean stake: 5,129.60 at 1.00, 8,240.00 at 25.00.
    expect(expectedMeterAtHit(terms, 100)).toBeCloseTo(512_960, 6);
    expect(expectedMeterAtHit(terms, 2_500)).toBeCloseTo(824_000, 6);
  });
});
