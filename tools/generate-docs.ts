/**
 * Writes the submission documents from the code:
 *
 *   docs/results.json          every figure the documents quote (docs/results.ts)
 *   docs/rules/<game>.md        the Rules of Play (tools/docs/rules.ts)
 *   docs/math/<game>.md         the Math Report (tools/docs/math.ts)
 *   docs/SUBMISSION-PACK.pdf    a cover, then each game's two documents (tools/docs/pdf.ts)
 *
 * Every number in a document is a figure of results.json, which is built
 * from each game's mathSummary() and the figures its tests recorded, and
 * nothing else: tools/docs/figures.ts fails the run on a number typed into a
 * template, and re-checks every figure against results.json. With --check,
 * nothing is written: the run fails if any file differs from what the code
 * gives now (CI runs it). --skip-pdf writes the Markdown and results.json
 * only, without Chrome.
 *
 *   pnpm docs:generate    # needs Chrome or Chromium for the PDF
 *   pnpm docs:check
 *
 * The documents name the last commit that changed packages/engine, so
 * commit an engine change before regenerating them. Runs the TypeScript
 * sources directly: Node >= 22.18 strips types.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { figs, validate, type Md } from './docs/figures.ts';
import { tidy, wrap } from './docs/markdown.ts';
import { mathReports } from './docs/math.ts';
import { cover, writePack } from './docs/pdf.ts';
import { buildResults } from './docs/results.ts';
import { rulesOfPlay } from './docs/rules.ts';

const ROOT = new URL('../', import.meta.url);
const check = process.argv.includes('--check');
const skipPdf = process.argv.includes('--skip-pdf');

const results = buildResults();
const json = `${JSON.stringify(results, null, 2)}\n`;
// The documents are checked against results.json as it will be written.
const stored = JSON.parse(json) as unknown;
const wrapped = figs(results);

interface Output {
  readonly path: string;
  readonly content: string;
  readonly figures?: number;
}

function document(path: string, markdown: Md): Output {
  const { markdown: text, figures } = validate(markdown, stored, path);
  return { path, content: tidy(wrap(text)), figures };
}

const rules = rulesOfPlay(wrapped);
const reports = mathReports(wrapped);
const outputs: Output[] = [
  { path: 'docs/results.json', content: json },
  ...Object.entries(rules).map(([id, markdown]) => document(`docs/rules/${id}.md`, markdown)),
  ...Object.entries(reports).map(([id, markdown]) => document(`docs/math/${id}.md`, markdown)),
];

let stale = 0;
for (const { path, content, figures } of outputs) {
  const file = new URL(path, ROOT);
  const current = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
  const note = figures === undefined ? '' : ` (${String(figures)} figures)`;
  if (current === content) {
    process.stdout.write(`✓ ${path}${note}\n`);
  } else if (check) {
    process.stderr.write(`✗ ${path} is out of date: run pnpm docs:generate\n`);
    stale++;
  } else {
    mkdirSync(new URL('.', file), { recursive: true });
    writeFileSync(file, content);
    process.stdout.write(`↻ ${path}${note}\n`);
  }
}
if (skipPdf) {
  process.stdout.write('– PDF skipped\n');
} else {
  // The pack: a cover, then each game's Rules of Play and Math Report.
  const coverMarkdown = validate(cover(wrapped), stored, 'the cover').markdown;
  const pack = Object.keys(rules).flatMap((id) =>
    (['rules', 'math'] as const).map((kind) => ({
      id,
      kind,
      markdown: outputs.find((output) => output.path === `docs/${kind}/${id}.md`)!.content,
    })),
  );
  const { ok, message } = await writePack(coverMarkdown, pack, check);
  (ok ? process.stdout : process.stderr).write(`${message}\n`);
  if (!ok) stale++;
}
if (stale > 0) process.exitCode = 1;
