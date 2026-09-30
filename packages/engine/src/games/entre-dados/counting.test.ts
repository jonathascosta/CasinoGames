/**
 * Card counting exposure, computed exactly (no simulation) for the table's
 * shoe. The figures are quoted in docs/games/entre-dados.md.
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
import { ENTRE_DADOS_BET_IDS, resolveEntreDadosBet, type EntreDadosBetId } from './rules.ts';

/** Expected net of one unit on `bet` when the card is `value`, over the 36 rolls. */
function cardValue(bet: EntreDadosBetId, value: Rank): Fraction {
  let sum = Fraction.ZERO;
  for (const a of DIE_FACES) {
    for (const b of DIE_FACES) {
      const result = resolveEntreDadosBet(bet, [a, b], value);
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
 * Exact exposure of `bet` over the rounds of one shoe. For every bet the card
 * values fall into three classes of equal expectation (A/6, 2/5, 3/4), so the
 * composition before the card of round d + 1 is a 3-class hypergeometric
 * draw of d cards.
 */
function exposure(bet: EntreDadosBetId, penetration: number): Exposure {
  const shoe = createEntreDadosShoe();
  const size = shoe.size();
  const perClass = size / 3;
  const rounds = size - Math.round(size * (1 - penetration));
  const [ends, near, middle] = ([1, 2, 3] as const).map((value) =>
    cardValue(bet, value).toNumber(),
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
        // Non-zero expectations are multiples of 1/(36 · left): the threshold
        // only keeps rounding noise from counting a neutral shoe as favourable.
        if (ev > 1e-9) {
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
    const values = DIE_FACES.map((value) => cardValue('entre', value).toString());
    expect(values).toEqual(['-5/9', '1/12', '13/36', '13/36', '1/12', '-5/9']);
    // Over a uniform card this is the declared house edge of 1/27.
    const average = DIE_FACES.reduce(
      (sum, value) => sum.add(cardValue('entre', value)),
      Fraction.ZERO,
    );
    expect(average.div(Fraction.of(6)).toString()).toBe('-1/27');
  });

  it('values the cards of every bet symmetrically, so three classes cover the shoe', () => {
    for (const bet of ENTRE_DADOS_BET_IDS) {
      const values = DIE_FACES.map((value) => cardValue(bet, value));
      expect([values[0]!.equals(values[5]!), values[1]!.equals(values[4]!)]).toEqual([true, true]);
      expect(values[2]!.equals(values[3]!)).toBe(true);
    }
  });

  it('leaves Exato, Dobros and Triplo immune: every card value is worth the same', () => {
    for (const bet of ['exato', 'dobros', 'triplo'] as const) {
      const values = new Set(DIE_FACES.map((value) => cardValue(bet, value).toString()));
      expect(values.size, bet).toBe(1);
    }
  });

  it('favours a perfect counter on Entre in 8.57% of rounds at the default 75% penetration', () => {
    const result = exposure('entre', createEntreDadosShoe().penetration);
    expect(result.rounds).toBe(108);
    expect((result.favourable * 100).toFixed(2)).toBe('8.57');
    expect((result.edgeWhenFavourable * 100).toFixed(2)).toBe('2.05');
    expect(result.breakEvenSpread.toFixed(1)).toBe('22.1');
  });

  it('shrinks with shallower penetration', () => {
    const half = exposure('entre', 0.5);
    const quarter = exposure('entre', 0.25);
    expect([
      half.rounds,
      (half.favourable * 100).toFixed(2),
      half.breakEvenSpread.toFixed(0),
    ]).toEqual([72, '3.66', '87']);
    expect([quarter.rounds, (quarter.favourable * 100).toFixed(2)]).toEqual([36, '0.47']);
    expect(quarter.breakEvenSpread).toBeGreaterThan(1_000);
  });

  it('rarely favours Olho de Boi, which also depends on the composition', () => {
    const result = exposure('olho-de-boi', createEntreDadosShoe().penetration);
    expect((result.favourable * 100).toFixed(2)).toBe('0.47');
  });
});
