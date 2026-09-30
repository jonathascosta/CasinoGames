/**
 * The Markdown the documents are built from: numbered sections, tables and
 * lists over the parts of figures.ts, and the final line wrapping. Section
 * and step numbers are written by the structure (see structural()), never
 * typed.
 */
import { Md, join, doc, structural, type Part } from './figures.ts';

export interface Section {
  readonly title: Part;
  readonly body?: Part;
  readonly subsections?: readonly Section[];
}

/** Numbered sections: "## 3. Equipment", then "### 3.1 Between". */
export function sections(list: readonly Section[]): Md {
  return join(
    list.map((section, index) => {
      const number = structural(index + 1);
      const subsections = (section.subsections ?? []).map(
        (sub, subIndex) => doc`### ${number}.${structural(subIndex + 1)} ${sub.title}

${sub.body ?? ''}`,
      );
      return doc`## ${number}. ${section.title}

${section.body ?? ''}

${join(subsections, '\n\n')}`;
    }),
    '\n\n',
  );
}

export type Align = 'left' | 'right' | 'center';

function cell(part: Part): Md {
  const text = join([part]).text;
  return new Md(
    text
      .replace(/\|/g, '\\|')
      .replace(/\s*\n\s*/g, ' ')
      .trim(),
  );
}

/** A GFM table: a header row, the alignments, then the rows. */
export function table(
  columns: readonly (readonly [Part, Align])[],
  rows: readonly (readonly Part[])[],
): Md {
  const separator = { left: ':--', right: '--:', center: ':-:' };
  const line = (cells: readonly Part[]) => join(['| ', join(cells.map(cell), ' | '), ' |']);
  return join(
    [
      line(columns.map(([title]) => title)),
      line(columns.map(([, align]) => separator[align])),
      ...rows.map((row) => {
        if (row.length !== columns.length)
          throw new Error('A table row with the wrong number of cells');
        return line(row);
      }),
    ],
    '\n',
  );
}

/** A two-column table of facts, "| Game | Dice Spread |", headed by its first row. */
export function facts(rows: readonly (readonly [Part, Part])[]): Md {
  const [head, ...rest] = rows;
  if (head === undefined) throw new Error('A table of facts needs a row');
  return table(
    [
      [head[0], 'left'],
      [head[1], 'left'],
    ],
    rest,
  );
}

/** Paragraphs, which may hold tables: blocks a list item cannot contain. */
export function paragraphs(items: readonly Part[]): Md {
  return join(items, '\n\n');
}

export function bullets(items: readonly Part[]): Md {
  return join(
    items.map((item) => doc`- ${item}`),
    '\n',
  );
}

/** A numbered list, numbered by the structure. */
export function steps(items: readonly Part[]): Md {
  return join(
    items.map((item, index) => doc`${structural(index + 1)}. ${item}`),
    '\n',
  );
}

/** Joins sentences or clauses: "a, b and c". */
export function series(items: readonly Part[], last = ' and '): Md {
  if (items.length <= 1) return join(items);
  return join([join(items.slice(0, -1), ', '), last, items.at(-1)!]);
}

const WIDTH = 100;
/** A line starting with one of these would start a new block: never wrap onto it. */
const BLOCK_START = /^([-+*#]$|[>|]|\d+[.)]$)/;

function wrapLine(line: string, indent: string, first: string): string[] {
  const words = line.split(' ');
  const lines: string[] = [];
  let current = first;
  let empty = true;
  for (const word of words) {
    const candidate = empty ? `${current}${word}` : `${current} ${word}`;
    if (!empty && candidate.length > WIDTH && !BLOCK_START.test(word)) {
      lines.push(current);
      current = `${indent}${word}`;
    } else {
      current = candidate;
    }
    empty = false;
  }
  lines.push(current);
  return lines;
}

/**
 * Wraps paragraphs and list items at 100 columns, as the repository's
 * Markdown is written; headings, tables, rules and code stay on their lines.
 */
export function wrap(markdown: string): string {
  const out: string[] = [];
  let fenced = false;
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    if (fenced || line.length <= WIDTH || /^(#|\||```|---)/.test(line)) {
      out.push(line);
      continue;
    }
    const item = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (item !== null) {
      const [, spaces = '', marker = '', rest = ''] = item;
      const indent = ' '.repeat(spaces.length + marker.length + 1);
      out.push(...wrapLine(rest, indent, `${spaces}${marker} `));
      continue;
    }
    const quote = /^(>\s?)(.*)$/.exec(line);
    if (quote !== null) {
      out.push(...wrapLine(quote[2]!, quote[1]!, quote[1]!));
      continue;
    }
    const lead = /^\s*/.exec(line)![0];
    out.push(...wrapLine(line.trimStart(), lead, lead));
  }
  return out.join('\n');
}

/** Collapses runs of blank lines and trims, for a tidy file. */
export function tidy(markdown: string): string {
  return `${markdown
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}
