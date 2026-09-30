import { h } from '../dom/h.ts';

/**
 * A small Markdown renderer for the Rules of Play and other rules text. It builds DOM
 * nodes directly (text is never parsed as HTML), so even a hostile document
 * cannot inject markup or script; link targets are limited to http(s),
 * mailto, relative paths and fragments.
 *
 * Supported: ATX headings, paragraphs with hard breaks, emphasis, strong,
 * inline code, links, (nested) ordered and unordered lists, blockquotes,
 * fenced code, horizontal rules, GFM tables with alignment. HTML comments
 * (used as markers in generated docs) are dropped; other HTML shows as text.
 */
export interface MarkdownOptions {
  /** Added to heading levels, e.g. 2 renders "#" as <h3> inside a dialog titled by an <h2>. */
  readonly headingOffset?: number;
}

type Line = string;

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*(\S*)\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const RULE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^ {0,3}>\s?(.*)$/;
const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)])( +)(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

export function renderMarkdown(source: string, options: MarkdownOptions = {}): DocumentFragment {
  const text = source
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\t/g, '    ');
  const fragment = document.createDocumentFragment();
  fragment.append(...parseBlocks(text.split('\n'), options.headingOffset ?? 0));
  return fragment;
}

function parseBlocks(lines: readonly Line[], offset: number): Node[] {
  const nodes: Node[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === '') {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence !== null) {
      const marker = fence[1]!;
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith(marker)) body.push(lines[i++]!);
      i++;
      const code = h('code', fence[2] === '' ? null : { class: `language-${fence[2]!}` });
      code.textContent = body.join('\n');
      nodes.push(h('pre', null, code));
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      const level = Math.min(6, heading[1]!.length + offset);
      nodes.push(h(`h${level}` as 'h1', null, ...parseInline(heading[2]!)));
      i++;
      continue;
    }

    if (RULE.test(line)) {
      nodes.push(h('hr'));
      i++;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1]!)) {
      const rows: string[] = [];
      let j = i + 2;
      while (j < lines.length && lines[j]!.includes('|') && lines[j]!.trim() !== '')
        rows.push(lines[j++]!);
      nodes.push(renderTable(line, lines[i + 1]!, rows));
      i = j;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i]!)) quoted.push(QUOTE.exec(lines[i++]!)![1]!);
      nodes.push(h('blockquote', null, ...parseBlocks(quoted, offset)));
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item !== null) {
      const { list, next } = parseList(lines, i, item[1]!.length, offset);
      nodes.push(list);
      i = next;
      continue;
    }

    // Paragraph: runs until a blank line or the start of another block.
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      (paragraph.length === 0 || !startsBlock(lines, i))
    ) {
      paragraph.push(lines[i++]!);
    }
    nodes.push(h('p', null, ...parseParagraph(paragraph)));
  }
  return nodes;
}

function startsBlock(lines: readonly Line[], i: number): boolean {
  const line = lines[i]!;
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    LIST_ITEM.test(line) ||
    (line.includes('|') && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1]!))
  );
}

/**
 * A paragraph's lines, joined: a soft line break is a space, so emphasis,
 * code and links may run across lines, as a wrapped document writes them.
 * A hard break (two trailing spaces or a backslash) ends the run.
 */
function parseParagraph(lines: readonly Line[]): Node[] {
  const nodes: Node[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length > 0) nodes.push(...parseInline(run.join(' ')));
    run = [];
  };
  lines.forEach((line, index) => {
    const hardBreak = / {2,}$/.test(line) || line.endsWith('\\');
    run.push(line.trim().replace(/\\$/, ''));
    if (hardBreak && index < lines.length - 1) {
      flush();
      nodes.push(h('br'));
    }
  });
  flush();
  return nodes;
}

function parseList(
  lines: readonly Line[],
  start: number,
  indent: number,
  offset: number,
): { list: HTMLElement; next: number } {
  const first = LIST_ITEM.exec(lines[start]!)!;
  const ordered = /\d/.test(first[2]!);
  const list = h(ordered ? 'ol' : 'ul');
  if (ordered) {
    const startNumber = Number.parseInt(first[2]!, 10);
    if (startNumber !== 1) list.setAttribute('start', String(startNumber));
  }

  let i = start;
  let loose = false;
  const items: string[][] = [];
  while (i < lines.length) {
    const match = LIST_ITEM.exec(lines[i]!);
    if (match?.[1]?.length !== indent || /\d/.test(match[2]!) !== ordered) break;
    const contentIndent = indent + match[2]!.length + match[3]!.length;
    const itemLines = [match[4]!];
    i++;
    while (i < lines.length) {
      const line = lines[i]!;
      if (line.trim() === '') {
        let k = i + 1;
        while (k < lines.length && lines[k]!.trim() === '') k++;
        if (k < lines.length && leadingSpaces(lines[k]!) >= contentIndent) {
          loose = true;
          itemLines.push('');
          i++;
          continue;
        }
        break;
      }
      const spaces = leadingSpaces(line);
      if (spaces >= contentIndent) {
        itemLines.push(line.slice(contentIndent));
      } else if (spaces > indent) {
        itemLines.push(line.slice(spaces));
      } else if (!startsBlock(lines, i)) {
        itemLines.push(line.trim()); // lazy continuation of the item's paragraph
      } else {
        break;
      }
      i++;
    }
    items.push(itemLines);
    // A blank line between items makes the list loose.
    if (i < lines.length && lines[i]!.trim() === '') {
      let k = i;
      while (k < lines.length && lines[k]!.trim() === '') k++;
      const nextItem = k < lines.length ? LIST_ITEM.exec(lines[k]!) : null;
      if (nextItem !== null && nextItem[1]!.length === indent) {
        loose = true;
        i = k;
      }
    }
  }

  for (const itemLines of items) {
    const children = parseBlocks(itemLines, offset);
    const li = h('li');
    for (const child of children) {
      // Tight lists render their paragraphs inline.
      if (!loose && child instanceof HTMLParagraphElement) li.append(...child.childNodes);
      else li.append(child);
    }
    list.append(li);
  }
  return { list, next: i };
}

function leadingSpaces(line: string): number {
  return line.length - line.trimStart().length;
}

function splitRow(row: string): string[] {
  let trimmed = row.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

/**
 * A text column with a cell longer than this, which can wrap, is prose: it
 * keeps a readable width (.cg-md-table__prose), so a table short of room
 * scrolls sideways rather than wrapping it a word per line.
 */
const PROSE_LENGTH = 12;

function renderTable(header: string, separator: string, rows: readonly string[]): HTMLElement {
  const aligns = splitRow(separator).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    return left && right ? 'center' : right ? 'right' : left ? 'left' : null;
  });
  const headers = splitRow(header);
  const body = rows.map((row) => splitRow(row));
  const prose = headers.map(
    (_, column) =>
      (aligns[column] ?? 'left') === 'left' &&
      body.some((cells) => {
        const text = cells[column] ?? '';
        return text.length > PROSE_LENGTH && /\s/.test(text);
      }),
  );
  const cell = (tag: 'th' | 'td', text: string, column: number) => {
    const align = aligns[column];
    return h(
      tag,
      {
        ...(prose[column] === true ? { class: 'cg-md-table__prose' } : {}),
        ...(align === null || align === undefined ? {} : { style: `text-align: ${align}` }),
      },
      ...parseInline(text),
    );
  };
  return h(
    'div',
    { class: 'cg-md-table' },
    h(
      'table',
      null,
      h('thead', null, h('tr', null, ...headers.map((text, c) => cell('th', text, c)))),
      h(
        'tbody',
        null,
        ...body.map((cells) =>
          h('tr', null, ...headers.map((_, c) => cell('td', cells[c] ?? '', c))),
        ),
      ),
    ),
  );
}

const ESCAPABLE = /[\\`*_[\]()#+\-.!|>~{}]/;

/** Inline Markdown: code spans, links, strong/emphasis and backslash escapes. */
export function parseInline(text: string): Node[] {
  const nodes: Node[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer !== '') nodes.push(document.createTextNode(buffer));
    buffer = '';
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    const next = text[i + 1];

    if (ch === '\\' && next !== undefined && ESCAPABLE.test(next)) {
      buffer += next;
      i += 2;
      continue;
    }

    if (ch === '`') {
      const run = /^`+/.exec(text.slice(i))![0];
      const end = text.indexOf(run, i + run.length);
      if (end !== -1) {
        flush();
        nodes.push(h('code', null, text.slice(i + run.length, end).trim()));
        i = end + run.length;
        continue;
      }
    }

    if (ch === '[') {
      const link = matchLink(text, i);
      if (link !== null) {
        flush();
        nodes.push(renderLink(link.label, link.href));
        i = link.end;
        continue;
      }
    }

    if ((ch === '*' || ch === '_') && canOpen(text, i)) {
      const marker = next === ch ? ch + ch : ch;
      const close = findClosing(text, marker, i + marker.length);
      if (close !== -1) {
        flush();
        const inner = parseInline(text.slice(i + marker.length, close));
        nodes.push(h(marker.length === 2 ? 'strong' : 'em', null, ...inner));
        i = close + marker.length;
        continue;
      }
    }

    buffer += ch;
    i++;
  }
  flush();
  return nodes;
}

/** Underscores inside words (snake_case) never start emphasis. */
function canOpen(text: string, i: number): boolean {
  const before = text[i - 1];
  const after = text[i + (text[i + 1] === text[i] ? 2 : 1)];
  if (after === undefined || /\s/.test(after)) return false;
  return text[i] === '*' || before === undefined || !/[\p{L}\p{N}]/u.test(before);
}

function findClosing(text: string, marker: string, from: number): number {
  for (let j = from; j < text.length; j++) {
    if (text[j] === '\\') {
      j++;
      continue;
    }
    if (text.startsWith(marker, j) && j > from && !/\s/.test(text[j - 1]!)) {
      const after = text[j + marker.length];
      // A single marker must not be half of a double one.
      if (marker.length === 1 && after === marker) {
        j++;
        continue;
      }
      if (marker.startsWith('_') && after !== undefined && /[\p{L}\p{N}]/u.test(after)) continue;
      return j;
    }
  }
  return -1;
}

function matchLink(
  text: string,
  start: number,
): { label: string; href: string; end: number } | null {
  let depth = 0;
  for (let j = start; j < text.length; j++) {
    if (text[j] === '\\') {
      j++;
    } else if (text[j] === '[') {
      depth++;
    } else if (text[j] === ']' && --depth === 0) {
      if (text[j + 1] !== '(') return null;
      const close = text.indexOf(')', j + 2);
      if (close === -1) return null;
      const target = text.slice(j + 2, close).trim();
      const href = /^<([^>]*)>/.exec(target)?.[1] ?? target.split(/\s+/)[0] ?? '';
      return { label: text.slice(start + 1, j), href, end: close + 1 };
    }
  }
  return null;
}

function renderLink(label: string, href: string): Node {
  const children = parseInline(label);
  if (!isSafeHref(href)) return h('span', null, ...children);
  const external = /^https?:/i.test(href);
  return h(
    'a',
    external ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href },
    ...children,
  );
}

export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (value === '') return false;
  if (/^(https?:|mailto:)/i.test(value)) return true;
  // Relative references and fragments, but nothing that parses as a scheme.
  return !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('//');
}
