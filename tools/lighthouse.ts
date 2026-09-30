/**
 * Lighthouse on every page of the built site, as it measures a phone (its
 * default mobile settings): fails unless each page scores at least 90 for
 * performance and for accessibility. Scores vary from run to run, so a page
 * under the bar is measured twice more and judged on the median of three.
 *
 *   pnpm build && pnpm lighthouse
 *
 * Serves apps/lobby/dist with `vite preview` (under BASE_PATH, as built),
 * runs Lighthouse 12 through npx, so there is nothing to install, and needs
 * Chrome: CHROME_PATH, or wherever Lighthouse finds it. Node >= 22.18 runs
 * this TypeScript directly.
 */
import { execFile, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { GAMES } from '../packages/engine/src/games/index.ts';

const BAR = 0.9;
const RUNS = 3;
const PORT = 4180;
/**
 * Chrome's debugging port. A fixed one: with none, Lighthouse's launcher
 * waits for Chrome to print the port it picked, which Chrome on GitHub's
 * runners did not do in time.
 */
const DEBUGGING_PORT = 9333;
const BASE = process.env.BASE_PATH ?? '/';
const ORIGIN = `http://localhost:${String(PORT)}`;
const PAGES = ['', 'stats', ...GAMES.map((game) => game.id)];

interface Scores {
  readonly performance: number;
  readonly accessibility: number;
  readonly metrics: string;
}

const run = promisify(execFile);
const dir = mkdtempSync(join(tmpdir(), 'lighthouse-'));
const server = spawn(
  'pnpm',
  [
    '--filter',
    '@casinogames/lobby',
    'exec',
    'vite',
    'preview',
    '--port',
    String(PORT),
    '--strictPort',
  ],
  { stdio: 'ignore' },
);

try {
  await ready(`${ORIGIN}${BASE}`);
  const failures: string[] = [];
  for (const page of PAGES) {
    const url = `${ORIGIN}${BASE}${page}`;
    const runs = [await measure(url)];
    if (!passes(runs[0]!)) {
      while (runs.length < RUNS) runs.push(await measure(url));
    }
    const scores = median(runs);
    const verdict = passes(scores) ? '✓' : '✗';
    process.stdout.write(
      `${verdict} /${page.padEnd(14)} performance ${percent(scores.performance)}  ` +
        `accessibility ${percent(scores.accessibility)}  ${scores.metrics}` +
        `${runs.length > 1 ? `  (median of ${String(runs.length)})` : ''}\n`,
    );
    if (!passes(scores)) failures.push(`/${page}`);
  }
  if (failures.length > 0) {
    process.stderr.write(`✗ under ${percent(BAR)}: ${failures.join(', ')}\n`);
    process.exitCode = 1;
  }
} finally {
  server.kill();
  rmSync(dir, { recursive: true, force: true });
}

/** Waits for the preview server to answer. */
async function ready(url: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The preview server did not answer at ${url}`);
}

async function measure(url: string): Promise<Scores> {
  const output = join(dir, 'report.json');
  try {
    await run(
      'npx',
      [
        '--yes',
        'lighthouse@12',
        url,
        `--port=${String(DEBUGGING_PORT)}`,
        '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage',
        '--only-categories=performance,accessibility',
        '--output=json',
        `--output-path=${output}`,
      ],
      { timeout: 180_000, maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (error) {
    // Lighthouse's log (and Chrome's, when it would not start) says why.
    const { stderr } = error as { stderr?: string };
    process.stderr.write(`${(stderr ?? '').split('\n').slice(-40).join('\n')}\n`);
    throw error;
  }
  const report = JSON.parse(readFileSync(output, 'utf8')) as {
    categories: Record<'performance' | 'accessibility', { score: number }>;
    audits: Record<string, { displayValue?: string }>;
  };
  const metric = (id: string, label: string) =>
    `${label} ${(report.audits[id]?.displayValue ?? '?').replace(/\s/g, ' ')}`;
  return {
    performance: report.categories.performance.score,
    accessibility: report.categories.accessibility.score,
    metrics: [
      metric('first-contentful-paint', 'FCP'),
      metric('largest-contentful-paint', 'LCP'),
      metric('total-blocking-time', 'TBT'),
      metric('cumulative-layout-shift', 'CLS'),
    ].join(' · '),
  };
}

function passes(scores: Scores): boolean {
  return scores.performance >= BAR && scores.accessibility >= BAR;
}

/** The run with the median performance score, with the median accessibility score. */
function median(runs: readonly Scores[]): Scores {
  const middle = (values: number[]) => values.sort((a, b) => a - b)[(values.length - 1) >> 1]!;
  const performance = middle(runs.map((scores) => scores.performance));
  return {
    performance,
    accessibility: middle(runs.map((scores) => scores.accessibility)),
    metrics: runs.find((scores) => scores.performance === performance)!.metrics,
  };
}

function percent(score: number): string {
  return String(Math.round(score * 100)).padStart(3);
}
