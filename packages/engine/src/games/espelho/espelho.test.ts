/**
 * Espelho's declared math, proven exactly.
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
import { createScriptedCardSource } from '../../testing/scripted-cards.ts';
import { createScriptedRng, scriptForDice } from '../../testing/scripted-rng.ts';
import {
  ESPELHO_BETS,
  ESPELHO_MATH,
  SEIS_SEIS_FIXED_RTP,
  SEIS_SEIS_RTP,
  SEIS_SEIS_RTP_AT_SEED,
} from './bets.ts';
import { ESPELHO_CONFIG } from './config.ts';
import { createEspelho, espelhoMathSummary } from './game.ts';

const { jackpot: METER, sideMax } = ESPELHO_CONFIG;
const pct = (ratio: number, digits = 2) => `${(ratio * 100).toFixed(digits)}%`;
const bet = (id: string) => ESPELHO_BETS.find((definition) => definition.id === id)!;

/** A meter that never moves from `amount`: no contributions, and a hit refills it to itself. */
const frozenMeter = (amount: number) =>
  new ProgressiveJackpot({ id: METER.id, seed: amount, contributionRate: 0 });

/** Every bet at 1.00 (6-6 vs 6-6 included), where each payout is a whole number of cents. */
const ALL_BETS: Bets = Object.fromEntries(ESPELHO_BETS.map(({ id }) => [id, 100]));

describe('Espelho — the declared table, from 36 × 24 × 24 draws', () => {
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
    // Espelho: player wins 47.45%, tie 5.09%, house edge 5.09%.
    expect([pct(p(tally.win)), pct(p(tally.tie)), pct(edge(tally.win, 1))]).toEqual([
      '47.45%',
      '5.09%',
      '5.09%',
    ]);
    // Empate: P = 5.09%, house edge 8.33%.
    expect([pct(p(tally.tie)), pct(edge(tally.tie, 17))]).toEqual(['5.09%', '8.33%']);
    // Par vs Par: 2.78%, 13.89%. Espelho Perfeito: 0.46%, 6.94%.
    expect([pct(p(tally.pairs)), pct(edge(tally.pairs, 30))]).toEqual(['2.78%', '13.89%']);
    expect([pct(p(tally.same)), pct(edge(tally.same, 200))]).toEqual(['0.46%', '6.94%']);
    // 6-6 vs 6-6: 0.077%, house edge 22.76% on the fixed pay.
    expect([pct(p(tally.sixes), 3), pct(edge(tally.sixes, 1000))]).toEqual(['0.077%', '22.76%']);
  });

  it('corrects one figure: Somas Iguais has an edge of 9.88%, not 9.85%', () => {
    // P = 146/1296 = 11.27% as published; at 7 to 1 the edge is 1 − 8 × 146/1296 = 8/81.
    expect(pct(p(tally.sum))).toBe('11.27%');
    expect(Fraction.ONE.sub(Fraction.of(8 * tally.sum, tally.total)).toString()).toBe('8/81');
    expect(pct(edge(tally.sum, 7))).toBe('9.88%');
  });

  it('is exactly the math the bets declare', () => {
    const declared = ESPELHO_MATH;
    const exact = (count: number) => Fraction.of(count, tally.total);
    expect(declared.espelho.p.equals(exact(tally.win))).toBe(true);
    expect(declared.empate.p.equals(exact(tally.tie))).toBe(true);
    expect(declared.somasIguais.p.equals(exact(tally.sum))).toBe(true);
    expect(declared.parVsPar.p.equals(exact(tally.pairs))).toBe(true);
    expect(declared.espelhoPerfeito.p.equals(exact(tally.same))).toBe(true);
    expect(declared.seisSeis.p.equals(exact(tally.sixes))).toBe(true);
    expect(
      [declared.espelho, declared.empate, declared.somasIguais, declared.parVsPar].map(({ p: q }) =>
        q.toString(),
      ),
    ).toEqual(['205/432', '11/216', '73/648', '1/36']);
    expect(declared.espelhoPerfeito.p.toString()).toBe('1/216');
    expect(declared.seisSeis.p.toString()).toBe('1/1296');
  });
});

describe('Espelho — the game over every draw of the dice and an infinite shoe', () => {
  const infiniteShoe = () => new Shoe({ decks: Infinity, ranks: RANK_SETS.aceToSix });
  // The fixed pays alone: a meter at zero pays nothing on top.
  const report = exactReturns(
    () => createEspelho({ source: infiniteShoe(), jackpot: frozenMeter(0) }),
    ALL_BETS,
  );

  const FIXED: readonly [string, keyof typeof ESPELHO_MATH, string, string][] = [
    ['espelho', 'espelho', 'higher', '205/216'],
    ['empate', 'empate', 'tie', '11/12'],
    ['somas-iguais', 'somasIguais', 'same-sum', '73/81'],
    ['par-vs-par', 'parVsPar', 'pairs', '31/36'],
    ['espelho-perfeito', 'espelhoPerfeito', 'same-pair', '67/72'],
  ];

  it('enumerates 36 rolls × 24 × 24 cards', () => {
    expect(report.outcomes).toBe(20_736);
  });

  it.each(FIXED)(
    '%s returns exactly its declared RTP, hit chance and volatility',
    (id, key, entry, rtp) => {
      const result = report.bets[id]!;
      const definition = bet(id);
      expect(result.rtp.toString()).toBe(rtp);
      expect(result.rtp.toNumber()).toBe(definition.rtp);
      expect(result.hitFrequency.equals(ESPELHO_MATH[key].p)).toBe(true);
      expect(result.entries[entry]!.equals(ESPELHO_MATH[key].p)).toBe(true);
      expect(result.pushFrequency.equals(Fraction.ZERO)).toBe(true);
      expect(result.standardDeviation).toBeCloseTo(definition.standardDeviation!, 12);
    },
  );

  it('pays 6-6 vs 6-6 its fixed 1000 to 1 on a hit 1 time in 1,296: 1001/1296', () => {
    const result = report.bets['seis-seis']!;
    expect(result.hitFrequency.toString()).toBe('1/1296');
    expect(result.entries['six-six']!.toString()).toBe('1/1296');
    expect(result.rtp.toString()).toBe('1001/1296');
    expect(result.rtp.equals(SEIS_SEIS_FIXED_RTP)).toBe(true);
    expect(pct(1 - result.rtp.toNumber())).toBe('22.76%');
  });

  it('declares 6-6 vs 6-6 at its fixed pays plus the contributions: 87.24%, the seed excluded', () => {
    expect(SEIS_SEIS_RTP.toString()).toBe('5653/6480');
    expect(SEIS_SEIS_RTP.equals(SEIS_SEIS_FIXED_RTP.add(Fraction.of(1, 10)))).toBe(true);
    expect(SEIS_SEIS_RTP.toNumber()).toBe(bet('seis-seis').rtp);
    expect([pct(SEIS_SEIS_RTP.toNumber()), pct(1 - SEIS_SEIS_RTP.toNumber())]).toEqual([
      '87.24%',
      '12.76%',
    ]);
  });

  it('takes the volatility index of 6-6 vs 6-6 with the meter at its seed', () => {
    const atSeed = exactReturns(
      () => createEspelho({ source: infiniteShoe(), jackpot: frozenMeter(METER.seed) }),
      { espelho: 100, 'seis-seis': 100 },
    ).bets['seis-seis']!;
    // A hit pays 1 + 1000 + 5,000.00 ÷ 25.00 = 1201 per unit staked.
    expect(atSeed.rtp.toString()).toBe('1201/1296');
    expect(atSeed.rtp.equals(SEIS_SEIS_RTP_AT_SEED)).toBe(true);
    expect(atSeed.variance.toString()).toBe(Fraction.of(1201 ** 2 * 1295, 1296 ** 2).toString());
    expect(atSeed.standardDeviation).toBeCloseTo(bet('seis-seis').standardDeviation!, 12);
  });
});

describe('Espelho — the progressive meter', () => {
  /** One round of 6-6 against 6-6 with the meter frozen at `meter`. */
  function hit(meter: number, stake: number) {
    const game = createEspelho({
      source: createScriptedCardSource('6S 6H'),
      jackpot: frozenMeter(meter),
    });
    const state = game.start(
      { espelho: 100, 'seis-seis': stake },
      createScriptedRng(scriptForDice([6, 6])),
    );
    const won = state.events.find((event) => event.type === 'jackpot-won');
    return {
      line: state.settlement['seis-seis']!,
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
    const game = createEspelho({ source: createScriptedCardSource('6S 6H'), jackpot });
    const state = game.start(
      { espelho: 100, 'seis-seis': 150 },
      createScriptedRng(scriptForDice([6, 6])),
    );
    // The round's own 15¢ goes in first: 623,471.7¢ × 150/2,500 = 37,408.302¢ → 37,408¢.
    expect(state.settlement['seis-seis']!.payout).toBe(150 + 150_000 + 37_408);
    expect(jackpot.amount).toBe(586_063); // 623,471.7 − 37,408 = 586,063.7¢
  });

  it('is worth 92.67% at its seed and breaks even at 7,375.00', () => {
    const terms = espelhoMathSummary().bets.find(
      ({ betId }) => betId === 'seis-seis',
    )!.progressive!;
    expect(pct(progressiveRtpAtMeter(terms, METER.seed))).toBe('92.67%');
    expect(Math.abs(progressiveRtpAtMeter(terms, 737_500) - 1)).toBeLessThan(1e-4); // ±0.01 pp
    expect(terms.breakEvenMeter).toBeCloseTo(737_500, 6);
    expect(terms.rtpAtSeed).toBeCloseTo(SEIS_SEIS_RTP_AT_SEED.toNumber(), 15);
    expect(terms.cycleRounds).toBeCloseTo(1_296, 9);
    // The house re-seeds 5,000.00 after each hit at 25.00: 3.86 per round.
    expect((terms.seedCostPerRound / 100).toFixed(2)).toBe('3.86');
    // A cycle adds 10% × 1,296 × the mean stake: 5,129.60 at 1.00, 8,240.00 at 25.00.
    expect(expectedMeterAtHit(terms, 100)).toBeCloseTo(512_960, 6);
    expect(expectedMeterAtHit(terms, 2_500)).toBeCloseTo(824_000, 6);
  });
});
