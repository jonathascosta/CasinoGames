/**
 * An exact rational number (bigint numerator and denominator, always in
 * lowest terms with a positive denominator). Exact-math tests use it so a
 * declared RTP such as 35/36 is compared without floating-point error.
 */
export class Fraction {
  readonly numerator: bigint;
  readonly denominator: bigint;

  static readonly ZERO = new Fraction(0n, 1n);
  static readonly ONE = new Fraction(1n, 1n);

  private constructor(numerator: bigint, denominator: bigint) {
    this.numerator = numerator;
    this.denominator = denominator;
  }

  /** Fraction.of(35, 36); integers may be numbers (safe integers) or bigints. */
  static of(numerator: bigint | number, denominator: bigint | number = 1n): Fraction {
    const n = toBigInt(numerator);
    const d = toBigInt(denominator);
    if (d === 0n) throw new RangeError('Fraction denominator must not be zero');
    const sign = d < 0n ? -1n : 1n;
    const divisor = gcd(abs(n), abs(d)) || 1n;
    return new Fraction((sign * n) / divisor, (sign * d) / divisor);
  }

  add(other: Fraction): Fraction {
    return Fraction.of(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  sub(other: Fraction): Fraction {
    return this.add(other.neg());
  }

  mul(other: Fraction): Fraction {
    return Fraction.of(this.numerator * other.numerator, this.denominator * other.denominator);
  }

  div(other: Fraction): Fraction {
    if (other.numerator === 0n) throw new RangeError('Division by zero');
    return Fraction.of(this.numerator * other.denominator, this.denominator * other.numerator);
  }

  neg(): Fraction {
    return new Fraction(-this.numerator, this.denominator);
  }

  compare(other: Fraction): -1 | 0 | 1 {
    const difference = this.numerator * other.denominator - other.numerator * this.denominator;
    return difference < 0n ? -1 : difference > 0n ? 1 : 0;
  }

  equals(other: Fraction): boolean {
    return this.numerator === other.numerator && this.denominator === other.denominator;
  }

  /**
   * The value as a double: correctly rounded when numerator and denominator
   * are safe integers (IEEE division), otherwise within one ulp.
   */
  toNumber(): number {
    const { numerator: n, denominator: d } = this;
    if (abs(n) <= MAX_SAFE && d <= MAX_SAFE) return Number(n) / Number(d);
    const whole = n / d;
    const rest = n - whole * d;
    return Number(whole) + Number((rest * 2n ** 64n) / d) / 2 ** 64;
  }

  toString(): string {
    return this.denominator === 1n ? `${this.numerator}` : `${this.numerator}/${this.denominator}`;
  }
}

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function toBigInt(value: bigint | number): bigint {
  if (typeof value === 'bigint') return value;
  if (!Number.isSafeInteger(value)) throw new RangeError(`Expected a safe integer, got ${value}`);
  return BigInt(value);
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}
