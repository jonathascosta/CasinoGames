/**
 * docs/SUBMISSION-PACK.pdf: a cover, then each game's Rules of Play and Math
 * Report. The Markdown goes through the UI kit's own renderer (on a jsdom
 * document), so the PDF reads like the documents in the demo; headless
 * Chrome prints it.
 *
 * The PDF's title carries a hash of everything it is made from (the
 * documents, the generator and the renderer), so a check can tell a stale
 * PDF from a fresh one without a browser and without a PDF parser.
 *
 * Chrome is taken from CHROME_PATH, then the usual install paths, then
 * Playwright's browsers (PLAYWRIGHT_BROWSERS_PATH).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { doc, int, pct, text, type Figs, type Md } from './figures.ts';
import { bullets, facts } from './markdown.ts';
import type { Results } from './results.ts';

const ROOT = new URL('../../', import.meta.url);
export const PDF_PATH = 'docs/SUBMISSION-PACK.pdf';

/** What the PDF is made from besides the documents: a change to any reprints it. */
const SOURCES = [
  'tools/generate-docs.ts',
  ...readdirSync(new URL('tools/docs/', ROOT))
    .filter((name) => name.endsWith('.ts'))
    .sort()
    .map((name) => `tools/docs/${name}`),
  'packages/ui/src/markdown/markdown.ts',
  'packages/ui/src/dom/h.ts',
];

export interface PackDocument {
  readonly id: string;
  readonly kind: 'rules' | 'math';
  readonly markdown: string;
}

/** The cover: the games, their main wager's RTP, and where every figure comes from. */
export function cover(results: Figs<Results>): Md {
  const { meta, games } = results;
  const list = Object.values(games).map((game) => {
    const main = game.summary.bets[0]!;
    return doc`**${text(game.name)}** — _${text(game.tagline)}_ Main wager ${text(main.label)}, RTP ${pct(main.rtp, 2)}. [Rules of Play](#${text(game.id)}-rules) · [Math Report](#${text(game.id)}-math), revision ${text(game.revision.revision)}, ${text(game.revision.date)}.`;
  });
  return doc`# Submission pack

Roll & Deal · Four original table games · Version ${text(meta.version)}

_Dice rolled by the player. Cards dealt by the dealer._

${bullets(list)}

${facts([
  ['Author', text(meta.author)],
  ['Code', doc`commit \`${text(meta.commit)}\` (${text(meta.commitDate)})`],
  [
    'Figures',
    doc`\`docs/results.json\`, from each game's \`mathSummary()\` and its tests' recorded results`,
  ],
  ['Generator', doc`\`${text(meta.generator)}\` (\`pnpm docs:generate\`)`],
  ['Demo', doc`[${text(meta.site)}](${text(meta.site)})`],
])}

For each game, the **Rules of Play** are for a pit manager or a live-dealer trainer: the equipment, the layout, the wagers, the procedure, the settlement and the rulings, with no figure beyond the paytable. The **Math Report** is for a gaming-lab mathematician or a distributor's analyst: every wager's return, derived exactly and confirmed by seeded simulation, each table naming the test that reproduces it. To reproduce every figure: clone the repository, run \`pnpm install\`, \`pnpm test\` (exact figures), \`pnpm test:math\` (simulations, ${int(games['dice-spread'].records['monte-carlo'].figures.simulation.rounds)} rounds for Dice Spread alone) and \`pnpm docs:check\`; each fails if its figures differ from those recorded here.`;
}

function build(cover: string, documents: readonly PackDocument[]): string {
  return createHash('sha256')
    .update(SOURCES.map((path) => readFileSync(new URL(path, ROOT), 'utf8')).join('\0'))
    .update(cover)
    .update(documents.map(({ id, kind, markdown }) => `${id}/${kind}\0${markdown}`).join('\0'))
    .digest('hex')
    .slice(0, 16);
}

/** The PDF's title: plain ASCII without parentheses, so it sits in the file as written. */
const title = (hash: string) => `Roll & Deal submission pack, build ${hash}`;

function buildOf(pdf: Buffer): string | undefined {
  return /Roll & Deal submission pack, build ([0-9a-f]{16})/.exec(pdf.toString('latin1'))?.[1];
}

async function renderHtml(
  cover: string,
  documents: readonly PackDocument[],
  hash: string,
): Promise<string> {
  // The renderer builds DOM nodes; jsdom stands in for the browser, with the
  // two globals the renderer uses.
  const { window } = new JSDOM('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, {
    document: window.document,
    HTMLParagraphElement: window.HTMLParagraphElement,
  });
  const { renderMarkdown } = await import('../../packages/ui/src/markdown/markdown.ts');
  const html = (markdown: string) => {
    const container = window.document.createElement('div');
    container.append(renderMarkdown(markdown));
    return container.innerHTML;
  };
  const articles = documents.map(
    ({ id, kind, markdown }) =>
      `<article class="document document--${kind}" id="${id}-${kind}">${html(markdown)}</article>`,
  );
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escape(title(hash))}</title>
<style>${STYLE}</style>
</head>
<body>
<section class="cover">${html(cover)}<p class="build">Build ${hash}</p></section>
${articles.join('\n')}
</body>
</html>
`;
}

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function findChrome(): string {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ...playwrightChromes(),
  ];
  const found = candidates.find((path) => path !== undefined && path !== '' && existsSync(path));
  if (found === undefined) {
    throw new Error('No Chrome or Chromium found: set CHROME_PATH to its executable');
  }
  return found;
}

function playwrightChromes(): string[] {
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (dir === undefined || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort()
    .reverse()
    .map((name) => join(dir, name, 'chrome-linux', 'chrome'));
}

function printToPdf(chrome: string, url: string, output: string): void {
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      // A static page of our own; the sandbox cannot start as root in containers.
      '--no-sandbox',
      '--no-pdf-header-footer',
      '--run-all-compositor-stages-before-draw',
      `--print-to-pdf=${output}`,
      url,
    ],
    { stdio: 'pipe', timeout: 180_000 },
  );
}

/**
 * Prints the pack when the stored PDF's build is not the documents' (or
 * always, with `reprint`). With `check`, prints nothing and only compares the
 * builds. Returns whether the PDF is (now) up to date.
 */
export async function writePack(
  coverMarkdown: string,
  documents: readonly PackDocument[],
  { check = false, reprint = false }: { readonly check?: boolean; readonly reprint?: boolean } = {},
): Promise<{ readonly ok: boolean; readonly message: string }> {
  const output = new URL(PDF_PATH, ROOT);
  const hash = build(coverMarkdown, documents);
  const stored = existsSync(output) ? buildOf(readFileSync(output)) : undefined;
  if (stored === hash && (check || !reprint)) return { ok: true, message: `✓ ${PDF_PATH}` };
  if (check) {
    return {
      ok: false,
      message:
        stored === undefined
          ? `✗ ${PDF_PATH} is missing or unreadable: run pnpm docs:generate`
          : `✗ ${PDF_PATH} is out of date (build ${stored}, sources ${hash}): run pnpm docs:generate`,
    };
  }
  const html = await renderHtml(coverMarkdown, documents, hash);
  const dir = mkdtempSync(join(tmpdir(), 'submission-pack-'));
  try {
    const page = join(dir, 'submission-pack.html');
    writeFileSync(page, html);
    printToPdf(findChrome(), pathToFileURL(page).href, fileURLToPath(output));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const written = buildOf(readFileSync(output));
  if (written !== hash) throw new Error(`${PDF_PATH} was printed without its build hash`);
  return { ok: true, message: `↻ ${PDF_PATH} (build ${hash})` };
}

/** Print styles: A4, dense tables kept readable, a running footer with page numbers. */
const STYLE = `
@page {
  size: A4;
  margin: 16mm 14mm 17mm;
  @bottom-left { content: "Roll & Deal · Submission pack"; font: 7.5pt "DejaVu Sans", Arial, sans-serif; color: #777; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7.5pt "DejaVu Sans", Arial, sans-serif; color: #777; }
}
@page :first {
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; color: #1d1d1b; font: 9.2pt/1.42 "DejaVu Sans", "Helvetica Neue", Arial, sans-serif; }
h1, h2, h3, h4 { margin: 1.2em 0 0.4em; color: #0f2a1d; font-family: "DejaVu Serif", Georgia, "Times New Roman", serif; line-height: 1.2; break-after: avoid; }
h1 { margin-top: 0; font-size: 20pt; }
h2 { padding-bottom: 2pt; border-bottom: 0.6pt solid #c9b68a; font-size: 13pt; }
h3 { font-size: 11pt; }
h4 { font-size: 10pt; }
p, ul, ol, blockquote { margin: 0 0 0.55em; orphans: 3; widows: 3; }
ul, ol { padding-left: 1.4em; }
li { margin: 0.12em 0; }
a { color: #0f5132; text-decoration: none; }
code { padding: 0 2pt; border-radius: 2pt; background: #f1eee6; font: 0.88em "DejaVu Sans Mono", Menlo, monospace; overflow-wrap: break-word; }
pre { padding: 6pt 8pt; border-radius: 3pt; background: #f1eee6; white-space: pre-wrap; break-inside: avoid; }
pre code { padding: 0; background: none; }
hr { border: 0; border-top: 0.6pt solid #d8d2c2; }
.cg-md-table { margin: 0.4em 0 0.9em; }
table { width: 100%; border-collapse: collapse; font-size: 7.4pt; line-height: 1.28; font-variant-numeric: tabular-nums; }
th, td { padding: 2pt 4pt; border: 0.5pt solid #cfc8b6; vertical-align: top; overflow-wrap: break-word; }
td[style*="right"], th[style*="right"], td[style*="center"] { white-space: nowrap; }
th { background: #f1eee6; color: #3b3a33; font-weight: 700; }
tr { break-inside: avoid; }
thead { display: table-header-group; }
.document { break-before: page; }
.document--math table { font-size: 7pt; }
.cover { display: flex; flex-direction: column; justify-content: center; min-height: 250mm; }
.cover h1 { margin: 0 0 4pt; font-size: 34pt; }
.cover h1 + p { margin: 0 0 4pt; color: #8a6d2b; font-size: 9pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.cover h1 + p + p { margin: 0 0 18pt; color: #6b5a2e; font-family: "DejaVu Serif", Georgia, serif; font-size: 13pt; }
.cover ul { margin: 0 0 16pt; padding: 0; list-style: none; border-top: 0.6pt solid #c9b68a; }
.cover li { margin: 0; padding: 6pt 0; border-bottom: 0.6pt solid #e2dccb; font-size: 10pt; }
.cover table { font-size: 8pt; margin-bottom: 12pt; }
.cover p { max-width: 170mm; color: #3b3a33; font-size: 9pt; }
.cover .build { color: #8a8a80; font-size: 7.5pt; }
`;
