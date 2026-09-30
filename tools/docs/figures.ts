/**
 * The figure guard: no number in a generated document is typed by hand.
 *
 * Documents are written with the `doc` tag, whose literal text may not hold a
 * digit. A number enters a document only as a figure: a value of the results
 * (docs/results.json), reached through `figs(results)` and written by one of
 * the named formatters below. Each figure is marked in the text with the
 * path of its value, the formatter and its arguments, and `validate()` checks
 * the finished document against the results as they stand in results.json:
 * every marked figure must be exactly what its formatter makes of the value
 * at its path, and no digit may stand outside a figure or a section number.
 * A figure typed into a template, computed in a template, or edited in a
 * document therefore fails the generator.
 */

/** Marks a figure: open, its description as JSON, separator, its text, close. */
const FIGURE_OPEN = '\u{E000}';
const FIGURE_TEXT = '\u{E001}';
const FIGURE_CLOSE = '\u{E002}';
/** Marks a section or list number, which the document's structure writes. */
const NUMBER_OPEN = '\u{E003}';
const NUMBER_CLOSE = '\u{E004}';
const MARKS = /[\u{E000}-\u{E004}]/u;

export type Path = readonly (string | number)[];

/** A value of the results, with where it lies in them. Only `figs()` makes one. */
export class Fig<T = unknown> {
  readonly value: T;
  readonly path: Path;

  private constructor(value: T, path: Path) {
    this.value = value;
    this.path = path;
  }

  /** @internal */
  static of<T>(value: T, path: Path): Fig<T> {
    return new Fig(value, path);
  }
}

/** The results with every leaf wrapped in a Fig: what templates read. */
export type Figs<T> = T extends null | undefined | boolean | number | string
  ? Fig<T>
  : T extends readonly (infer U)[]
    ? readonly Figs<U>[]
    : {
        readonly [K in keyof T]-?: undefined extends T[K]
          ? Figs<NonNullable<T[K]>> | undefined
          : Figs<T[K]>;
      };

export function figs<T>(value: T, path: Path = []): Figs<T> {
  if (value === null || typeof value !== 'object') return Fig.of(value, path) as Figs<T>;
  if (Array.isArray(value)) {
    return value.map((item: unknown, index) => figs(item, [...path, index])) as unknown as Figs<T>;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, figs(item, [...path, key])]),
  ) as Figs<T>;
}

type Argument = string | number | boolean;

/** Group digits by thousands: 124852059 → "124,852,059". */
function grouped(value: number, digits = 0): string {
  const [whole, fraction] = Math.abs(value).toFixed(digits).split('.');
  const text = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
  return value < 0 && Number(text.replace(/,/g, '')) !== 0 ? `−${text}` : text;
}

function fractionValue(text: string): number {
  const [numerator, denominator = '1'] = text.split('/');
  return Number(numerator) / Number(denominator);
}

function signed(text: string, value: number): string {
  if (Number(text.replace(/[^\d.]/g, '')) === 0) return text;
  return value < 0 ? `−${text}` : `+${text}`;
}

/**
 * The formatters: each turns the values at a figure's paths (and its
 * arguments) into its text. validate() calls them again on results.json.
 */
const FORMATTERS = {
  /** A string as it is: a name, a label, a seed, a date, a test's name. */
  text: ([value]: unknown[]) => String(value),
  /** A whole number, grouped by thousands. */
  int: ([value]: unknown[]) => grouped(value as number),
  /** A number with `digits` decimals, grouped by thousands. */
  num: ([value]: unknown[], [digits]: Argument[]) => grouped(value as number, digits as number),
  /** A share as a percentage: 0.96296 → "96.30%". */
  pct: ([value]: unknown[], [digits]: Argument[]) =>
    `${grouped((value as number) * 100, digits as number)}%`,
  /** A difference of shares in percentage points: "+0.04 pp", "−0.11 pp". */
  pp: ([value]: unknown[], [digits]: Argument[]) =>
    `${signed(grouped(Math.abs((value as number) * 100), digits as number), value as number)} pp`,
  /** A size in percentage points, unsigned: a standard error, a tolerance. */
  points: ([value]: unknown[], [digits]: Argument[]) =>
    `${grouped((value as number) * 100, digits as number)} pp`,
  /** An amount in cents as money: 25000 → "250.00". */
  money: ([value]: unknown[]) => grouped((value as number) / 100, 2),
  /** Money to the cent, or to a tenth of a cent when it has one: "7.875". */
  moneyExact: ([value]: unknown[]) =>
    grouped((value as number) / 100, Number.isInteger(value) ? 2 : 3),
  /** A signed amount in cents: "+0.60", "−1.00". */
  signedMoney: ([value]: unknown[]) =>
    signed(grouped(Math.abs(value as number) / 100, 2), value as number),
  /** An exact fraction as written: "26/27", "−5/9". */
  frac: ([value]: unknown[]) => String(value).replace('-', '−'),
  /** An exact fraction as a signed decimal: "−73/108" → "−0.676". */
  fracNum: ([value]: unknown[], [digits]: Argument[]) => {
    const number = fractionValue(String(value));
    return signed(grouped(Math.abs(number), digits as number), number);
  },
  /** Odds from their two numbers: "4 to 1", "15 to 2". */
  odds: ([to, per]: unknown[]) => `${String(to)} to ${String(per)}`,
  /** A multiple: 7.5 → "7.5×", 1000 → "1,000×". */
  times: ([value]: unknown[]) => {
    const number = value as number;
    return `${Number.isInteger(number) ? grouped(number) : String(number)}×`;
  },
  /** A bet spread: 13.62 → "1 to 13.6". */
  spread: ([value]: unknown[], [digits]: Argument[]) =>
    `1 to ${grouped(value as number, digits as number)}`,
  /** Dice, higher first: "6-1". */
  dice: (values: unknown[]) => values.map(String).join('-'),
} satisfies Record<string, (values: unknown[], args: Argument[]) => string>;

type FormatterName = keyof typeof FORMATTERS;

/** A piece of a document: text built with `doc`, or a digit-free string. */
export class Md {
  readonly text: string;

  constructor(text: string) {
    this.text = text;
  }
}

export type Part = Md | string | null | undefined | false | readonly Part[];

function joinPart(part: Part, where: string): string {
  if (part === null || part === undefined || part === false) return '';
  if (part instanceof Md) return part.text;
  if (Array.isArray(part)) return part.map((item: Part) => joinPart(item, where)).join('');
  if (typeof part === 'string') {
    if (/\d/.test(part) || MARKS.test(part)) {
      throw new Error(`A number in plain text (${where}): "${part}". Write it as a figure.`);
    }
    return part;
  }
  throw new TypeError(`Not a document part (${where}): ${typeof part}`);
}

/**
 * Tags a document template. Its literal text may not hold a digit, and its
 * values must be figures, other parts, or strings without digits.
 */
export function doc(strings: TemplateStringsArray, ...parts: Part[]): Md {
  let text = '';
  for (const [index, literal] of strings.entries()) {
    if (/\d/.test(literal)) {
      throw new Error(`A number typed in a document template: "${literal.trim()}"`);
    }
    text += literal;
    if (index < parts.length) text += joinPart(parts[index], literal.trim().slice(-40));
  }
  return new Md(text);
}

/** Parts joined with `separator` (digit-free). */
export function join(parts: readonly Part[], separator = ''): Md {
  return new Md(parts.map((part) => joinPart(part, 'join')).join(joinPart(separator, 'separator')));
}

function figure(name: FormatterName, figures: readonly Fig[], args: Argument[] = []): Md {
  const values = figures.map((fig) => fig.value);
  const text = FORMATTERS[name](values, args);
  const description = JSON.stringify({ f: name, p: figures.map((fig) => fig.path), a: args });
  return new Md(`${FIGURE_OPEN}${description}${FIGURE_TEXT}${text}${FIGURE_CLOSE}`);
}

export const text = (fig: Fig<string | number>) => figure('text', [fig]);
export const int = (fig: Fig<number>) => figure('int', [fig]);
export const num = (fig: Fig<number>, digits: number) => figure('num', [fig], [digits]);
export const pct = (fig: Fig<number>, digits = 2) => figure('pct', [fig], [digits]);
export const pp = (fig: Fig<number>, digits = 2) => figure('pp', [fig], [digits]);
export const points = (fig: Fig<number>, digits = 2) => figure('points', [fig], [digits]);
export const money = (fig: Fig<number>) => figure('money', [fig]);
export const signedMoney = (fig: Fig<number>) => figure('signedMoney', [fig]);
export const moneyExact = (fig: Fig<number>) => figure('moneyExact', [fig]);
export const frac = (fig: Fig<string>) => figure('frac', [fig]);
export const fracNum = (fig: Fig<string>, digits = 3) => figure('fracNum', [fig], [digits]);
export const odds = (to: Fig<number>, per: Fig<number>) => figure('odds', [to, per]);
export const times = (fig: Fig<number>) => figure('times', [fig]);
export const spread = (fig: Fig<number>, digits = 1) => figure('spread', [fig], [digits]);
export const dice = (...faces: Fig<number>[]) => figure('dice', faces);

/** A number the document's structure writes: a section's or a step's. */
export function structural(value: number): Md {
  if (!Number.isInteger(value) || value < 0) throw new RangeError('A section number is whole');
  return new Md(`${NUMBER_OPEN}${String(value)}${NUMBER_CLOSE}`);
}

const FIGURE = /\u{E000}([^\u{E001}]*)\u{E001}([^\u{E002}]*)\u{E002}/gu;
const NUMBER = /\u{E003}(\d+)\u{E004}/gu;

function valueAt(results: unknown, path: Path): unknown {
  let value = results;
  for (const key of path) {
    if (value === null || typeof value !== 'object' || !(key in value)) {
      throw new Error(`No value at ${path.join('.')} in results.json`);
    }
    value = (value as Record<string | number, unknown>)[key];
  }
  return value;
}

/**
 * Checks a finished document against `results` (docs/results.json, parsed):
 * every figure is re-formatted from the value at its path and must read the
 * same; then no digit may be left outside the figures and section numbers.
 * Returns the document without its marks, and how many figures it holds.
 */
export function validate(
  document: Md,
  results: unknown,
  name: string,
): { markdown: string; figures: number } {
  let figures = 0;
  const bare = document.text.replace(FIGURE, (_, description: string, written: string) => {
    const { f, p, a } = JSON.parse(description) as { f: FormatterName; p: Path[]; a: Argument[] };
    const expected = FORMATTERS[f](
      p.map((path) => valueAt(results, path)),
      a,
    );
    if (expected !== written) {
      throw new Error(
        `${name}: the figure at ${p.map((path) => path.join('.')).join(', ')} reads "${written}", ` +
          `but results.json gives "${expected}"`,
      );
    }
    figures++;
    return '';
  });
  const rest = bare.replace(NUMBER, '');
  const stray = /.{0,40}\d.{0,40}/u.exec(rest);
  if (stray !== null) {
    throw new Error(`${name}: a number outside the figures: "…${stray[0]}…"`);
  }
  if (MARKS.test(rest)) throw new Error(`${name}: a broken figure mark`);
  const markdown = document.text
    .replace(FIGURE, (_, __: string, written: string) => written)
    .replace(NUMBER, (_, value: string) => value);
  return { markdown, figures };
}
