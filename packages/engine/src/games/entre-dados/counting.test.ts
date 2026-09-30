/**
 * Card counting exposure of the Entre bet, computed exactly (no simulation)
 * for the table's shoe. The figures are quoted in docs/games/entre-dados.md.
 *
 * Entre's expectation depends on the cards left in the shoe: aces and sixes
 * can never fall between the dice, while threes and fours often do. A player
 * who tracks the cards dealt knows the exact composition before each round;
 * this suite measures how often that composition favours the player.
 */
import { describe, expect, it } from 'vitest';
import type { Rank } from '../../cards/card.ts';
import { DIE_FACES } from '../../dice/dice.ts';
import { winnings } from '../../game/money.ts';
import { Fraction } from '../../math/fraction.ts';
import { createEntreDadosShoe } from './game.ts';
import { resolveEntreDadosBet } from './rules.ts';

/** Expected net of one unit on Entre when the card is `value`, over the 36 rolls. */
function entreValue(value: Rank): Fraction {
  let sum = Fraction.ZERO;
  for (const a of DIE_FACES) {
    for (const b of DIE_FACES) {
      const result = resolveEntreDadosBet('entre', [a, b], value);
      // Net per unit, exactly: stake a large even amount so every payout is whole.
      const stake = 1_000;
      const net =
        result.outcome === 'win'
          ? winnings(stake, result.odds)
          : result.outcome === 'push'
            ? 0
            : -stake;
      sum = sum.add(Fraction.of(net, stake * 36));
    }
  }
  return sum;
}

interface Exposure {
  /** Rounds dealt per shoe before the cut card comes out. */
  readonly rounds: number;
  /** Share of rounds in which Entre has a positive expectation. */
  readonly favourable: number;
  /** Average player edge in those rounds. */
  readonly edgeWhenFavourable: number;
  /** Bet spread (largest ÷ smallest bet) at which a perfect counter breaks even. */
  readonly breakEvenSpread: number;
}

/**
 * Exact exposure over the rounds of one shoe. The card values fall into
 * three classes of equal expectation (A/6, 2/5, 3/4), so the composition
 * before the card of round d + 1 is a 3-class hypergeometric draw of d cards.
 */
function exposure(penetration: number): Exposure {
  const shoe = createEntreDadosShoe();
  const size = shoe.size();
  const perClass = size / 3;
  const rounds = size - Math.round(size * (1 - penetration));
  const [ends, near, middle] = [entreValue(1), entreValue(2), entreValue(3)].map((f) =>
    f.toNumber(),
  ) as [number, number, number];
  const choose = binomials(size);

  let favourable = 0;
  let gain = 0;
  let total = 0;
  for (let dealt = 0; dealt < rounds; dealt++) {
    for (let xe = 0; xe <= Math.min(perClass, dealt); xe++) {
      for (let xn = 0; xn <= Math.min(perClass, dealt - xe); xn++) {
        const xm = dealt - xe - xn;
        if (xm > perClass) continue;
        const p =
          (choose(perClass, xe) * choose(perClass, xn) * choose(perClass, xm)) /
          choose(size, dealt);
        const left = size - dealt;
        const ev =
          ((perClass - xe) * ends + (perClass - xn) * near + (perClass - xm) * middle) / left;
        total += p * ev;
        if (ev > 0) {
          favourable += p;
          gain += p * ev;
        }
      }
    }
  }
  return {
    rounds,
    favourable: favourable / rounds,
    edgeWhenFavourable: gain / favourable,
    breakEvenSpread: -(total - gain) / gain,
  };
}

/** Binomial coefficients up to n as doubles (exact enough for probabilities). */
function binomials(n: number): (n: number, k: number) => number {
  const rows: number[][] = [[1]];
  for (let i = 1; i <= n; i++) {
    const previous = rows[i - 1]!;
    rows.push(Array.from({ length: i + 1 }, (_, k) => (previous[k - 1] ?? 0) + (previous[k] ?? 0)));
  }
  return (top, k) => rows[top]![k]!;
}

describe('Entre Dados — card counting exposure', () => {
  it('values each card for Entre by class: aces and sixes hurt, threes and fours help', () => {
    const values = DIE_FACES.map((value) => entreValue(value).toString());
    expect(values).toEqual(['-5/9', '1/12', '13/36', '13/36', '1/12', '-5/9']);
    // Over a uniform card this is the declared house edge of 1/27.
    const average = DIE_FACES.reduce((sum, value) => sum.add(entreValue(value)), Fraction.ZERO);
    expect(average.div(Fraction.of(6)).toString()).toBe('-1/27');
  });

  it('favours a perfect counter in 8.57% of rounds at the default 75% penetration', () => {
    const result = exposure(createEntreDadosShoe().penetration);
    expect(result.rounds).toBe(108);
    expect((result.favourable * 100).toFixed(2)).toBe('8.57');
    expect((result.edgeWhenFavourable * 100).toFixed(2)).toBe('2.05');
    expect(result.breakEvenSpread.toFixed(1)).toBe('22.1');
  });

  it('shrinks with shallower penetration', () => {
    const half = exposure(0.5);
    const quarter = exposure(0.25);
    expect([
      half.rounds,
      (half.favourable * 100).toFixed(2),
      half.breakEvenSpread.toFixed(0),
    ]).toEqual([72, '3.66', '87']);
    expect([quarter.rounds, (quarter.favourable * 100).toFixed(2)]).toEqual([36, '0.47']);
    expect(quarter.breakEvenSpread).toBeGreaterThan(1_000);
  });
});
