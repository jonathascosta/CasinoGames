/**
 * Renders the four game sheets (docs/games/<id>.md) into one PDF,
 * docs/GAME-SHEETS.pdf: a cover with the games and their declared RTPs, then
 * each sheet on its own pages. The Markdown goes through the UI kit's own
 * renderer (on a jsdom document), so the PDF reads like the Rules dialog at
 * the tables; headless Chrome prints it.
 *
 * The PDF's title carries a hash of everything it is made from (the sheets,
 * this script and the renderer), so --check can tell a stale PDF from a fresh
 * one without a browser and without a PDF parser. CI runs --check in
 * `pnpm docs:check`, and prints the PDF afresh with the runner's Chrome.
 *
 *   pnpm docs:pdf            # write docs/GAME-SHEETS.pdf (needs Chrome or Chromium)
 *   pnpm docs:pdf --check    # fail if it no longer matches the sheets
 *
 * Chrome is taken from CHROME_PATH, then the usual install paths, then
 * Playwright's browsers (PLAYWRIGHT_BROWSERS_PATH). Runs the TypeScript
 * sources directly: Node >= 22.18 strips types.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { GAMES } from '../packages/engine/src/games/index.ts';

const ROOT = new URL('../', import.meta.url);
const OUTPUT = new URL('docs/GAME-SHEETS.pdf', ROOT);
const NAME = 'docs/GAME-SHEETS.pdf';
/** What the PDF is made from, besides the sheets: a change to either reprints it. */
const SOURCES = [
  'tools/game-sheets-pdf.ts',
  'packages/ui/src/markdown/markdown.ts',
  'packages/ui/src/dom/h.ts',
];

const check = process.argv.includes('--check');

const sheets = GAMES.map((game) => ({
  game,
  path: `docs/games/${game.id}.md`,
  markdown: readFileSync(new URL(`docs/games/${game.id}.md`, ROOT), 'utf8'),
}));
const build = createHash('sha256')
  .update(SOURCES.map((path) => readFileSync(new URL(path, ROOT), 'utf8')).join('\0'))
  .update(sheets.map(({ path, markdown }) => `${path}\0${markdown}`).join('\0'))
  .digest('hex')
  .slice(0, 16);
/**
 * The PDF's title: plain ASCII without parentheses (which PDF strings escape),
 * so it sits in the file as written and --check can find it.
 */
const TITLE = `Roll & Deal game sheets, build ${build}`;

/** The build hash in a PDF's title, if it has one. */
function buildOf(pdf: Buffer): string | undefined {
  return /Roll & Deal game sheets, build ([0-9a-f]{16})/.exec(pdf.toString('latin1'))?.[1];
}

async function renderDocument(): Promise<string> {
  // The renderer builds DOM nodes; jsdom stands in for the browser, with the
  // two globals the renderer uses.
  const { window } = new JSDOM('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, {
    document: window.document,
    HTMLParagraphElement: window.HTMLParagraphElement,
  });
  const { renderMarkdown } = await import('../packages/ui/src/markdown/markdown.ts');
  const html = (markdown: string) => {
    const container = window.document.createElement('div');
    container.append(renderMarkdown(markdown));
    return container.innerHTML;
  };

  const games = sheets.map(({ game }) => {
    const main = game.mathSummary().bets.find((bet) => bet.kind === 'main');
    const rtp = main === undefined ? '' : `RTP ${(main.rtp * 100).toFixed(2)}% · ${main.label}`;
    return `<li><a href="#${game.id}">${escape(game.name)}</a><span>${escape(rtp)}</span></li>`;
  });
  const body = sheets.map(
    ({ game, markdown }) => `<article class="sheet" id="${game.id}">${html(markdown)}</article>`,
  );
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escape(TITLE)}</title>
<style>${STYLE}</style>
</head>
<body>
<section class="cover">
  <p class="eyebrow">Roll &amp; Deal · Original table games</p>
  <h1>Game sheets</h1>
  <p class="lede">Dice rolled by the player. Cards dealt by the dealer.</p>
  <ol class="games">${games.join('')}</ol>
  <p class="note">One sheet per game: rules, examples, the paytable and the mathematics. The
  paytables and declared figures are generated from each game's code and proven by exact
  enumeration and seeded Monte Carlo runs. RTPs shown here are those of each main bet; the sheets
  give every bet's. Build ${build}.</p>
</section>
${body.join('\n')}
</body>
</html>
`;
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    { stdio: 'pipe', timeout: 120_000 },
  );
}

/** Print styles: A4, the sheets' tables kept readable, a running footer with page numbers. */
const STYLE = `
@page {
  size: A4;
  margin: 17mm 15mm 18mm;
  @bottom-left { content: "Roll & Deal · Game sheets"; font: 8pt "DejaVu Sans", Arial, sans-serif; color: #777; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt "DejaVu Sans", Arial, sans-serif; color: #777; }
}
@page :first {
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; color: #1d1d1b; font: 9.6pt/1.45 "DejaVu Sans", "Helvetica Neue", Arial, sans-serif; }
h1, h2, h3, h4 { margin: 1.3em 0 0.4em; color: #0f2a1d; font-family: "DejaVu Serif", Georgia, "Times New Roman", serif; line-height: 1.2; break-after: avoid; }
h1 { margin-top: 0; font-size: 22pt; }
h2 { padding-bottom: 2pt; border-bottom: 0.6pt solid #c9b68a; font-size: 14pt; }
h3 { font-size: 11.5pt; }
h4 { font-size: 10pt; }
p, ul, ol, blockquote { margin: 0 0 0.6em; orphans: 3; widows: 3; }
ul, ol { padding-left: 1.4em; }
li { margin: 0.15em 0; }
a { color: #0f5132; text-decoration: none; }
code { padding: 0 2pt; border-radius: 2pt; background: #f1eee6; font: 0.9em "DejaVu Sans Mono", Menlo, monospace; }
pre { padding: 6pt 8pt; border-radius: 3pt; background: #f1eee6; white-space: pre-wrap; break-inside: avoid; }
pre code { padding: 0; background: none; }
blockquote { margin-left: 0; padding: 4pt 10pt; border-left: 2pt solid #c9b68a; background: #faf8f2; }
hr { border: 0; border-top: 0.6pt solid #d8d2c2; }
.cg-md-table { margin: 0.4em 0 0.9em; }
table { width: 100%; border-collapse: collapse; font-size: 8pt; line-height: 1.3; font-variant-numeric: tabular-nums; }
th, td { padding: 2.5pt 5pt; border: 0.5pt solid #cfc8b6; vertical-align: top; }
th { background: #f1eee6; color: #3b3a33; font-weight: 700; }
tr { break-inside: avoid; }
thead { display: table-header-group; }
.sheet { break-before: page; }
.cover { display: flex; flex-direction: column; justify-content: center; min-height: 240mm; }
.cover .eyebrow { margin: 0 0 6pt; color: #8a6d2b; font-size: 9pt; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
.cover h1 { margin: 0; font-size: 40pt; }
.cover .lede { margin: 6pt 0 24pt; color: #6b5a2e; font-family: "DejaVu Serif", Georgia, serif; font-size: 14pt; font-style: italic; }
.cover .games { margin: 0 0 24pt; padding: 0; list-style: none; border-top: 0.6pt solid #c9b68a; }
.cover .games li { display: flex; justify-content: space-between; gap: 12pt; margin: 0; padding: 7pt 0; border-bottom: 0.6pt solid #e2dccb; font-size: 12pt; }
.cover .games a { color: #0f2a1d; font-family: "DejaVu Serif", Georgia, serif; font-weight: 700; }
.cover .games span { color: #5a5a52; font-size: 10pt; }
.cover .note { max-width: 150mm; color: #5a5a52; font-size: 8.8pt; }
`;

if (check) {
  const stored = existsSync(OUTPUT) ? buildOf(readFileSync(OUTPUT)) : undefined;
  if (stored === build) {
    process.stdout.write(`✓ ${NAME}\n`);
  } else {
    process.stderr.write(
      stored === undefined
        ? `✗ ${NAME} is missing or unreadable: run pnpm docs:pdf\n`
        : `✗ ${NAME} is out of date (build ${stored}, sources ${build}): run pnpm docs:pdf\n`,
    );
    process.exitCode = 1;
  }
} else {
  const html = await renderDocument();
  const dir = mkdtempSync(join(tmpdir(), 'game-sheets-'));
  try {
    const page = join(dir, 'game-sheets.html');
    writeFileSync(page, html);
    printToPdf(findChrome(), pathToFileURL(page).href, fileURLToPath(OUTPUT));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const written = buildOf(readFileSync(OUTPUT));
  if (written !== build) {
    throw new Error(`${NAME} was printed without its build hash (found ${String(written)})`);
  }
  process.stdout.write(`↻ ${NAME} written (build ${build})\n`);
}
