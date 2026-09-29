export interface ChiSquareResult {
  readonly statistic: number;
  readonly degreesOfFreedom: number;
  /** Probability of a statistic at least this large if the null hypothesis holds. */
  readonly pValue: number;
}

/**
 * Pearson's chi-square goodness-of-fit test of observed counts against the
 * expected category probabilities. Used by the seeded uniformity tests: with
 * a fixed seed the p-value is deterministic, so a threshold such as
 * p > 0.001 cannot flake.
 */
export function chiSquareTest(
  observed: readonly number[],
  probabilities: readonly number[],
): ChiSquareResult {
  if (observed.length !== probabilities.length || observed.length < 2) {
    throw new RangeError('observed and probabilities must have the same length (>= 2)');
  }
  const total = observed.reduce((sum, count) => sum + count, 0);
  let statistic = 0;
  observed.forEach((count, i) => {
    const expected = total * probabilities[i]!;
    statistic += (count - expected) ** 2 / expected;
  });
  const degreesOfFreedom = observed.length - 1;
  return {
    statistic,
    degreesOfFreedom,
    pValue: regularizedGammaQ(degreesOfFreedom / 2, statistic / 2),
  };
}

/** Chi-square test against a uniform distribution over the categories. */
export function chiSquareUniform(observed: readonly number[]): ChiSquareResult {
  return chiSquareTest(
    observed,
    observed.map(() => 1 / observed.length),
  );
}

const EPSILON = 1e-15;
const TINY = 1e-300;
const MAX_ITERATIONS = 10_000;

/** Regularised upper incomplete gamma Q(a, x) (Numerical Recipes §6.2). */
export function regularizedGammaQ(a: number, x: number): number {
  if (x < 0 || a <= 0) throw new RangeError('regularizedGammaQ: need a > 0 and x >= 0');
  if (x === 0) return 1;
  const logPrefactor = -x + a * Math.log(x) - logGamma(a);

  if (x < a + 1) {
    // Series for P(a, x); Q = 1 - P.
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < MAX_ITERATIONS; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * EPSILON) break;
    }
    return 1 - sum * Math.exp(logPrefactor);
  }

  // Continued fraction for Q(a, x), modified Lentz's method.
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < MAX_ITERATIONS; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPSILON) break;
  }
  return Math.exp(logPrefactor) * h;
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** ln Γ(z) for z > 0 (Lanczos approximation, g = 7). */
export function logGamma(z: number): number {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const x = z - 1;
  let series = LANCZOS[0]!;
  for (let i = 1; i < LANCZOS.length; i++) series += LANCZOS[i]! / (x + i);
  const t = x + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(series);
}
