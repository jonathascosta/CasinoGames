/**
 * Writes each registered game's paytable section into docs/games/<id>.md,
 * between the math markers. With --check it only reports stale sheets and
 * exits non-zero, which CI uses to stop hand-edited or outdated figures.
 *
 * Runs the engine's TypeScript sources directly: Node >= 22.18 strips types.
 *   pnpm docs:sheets        # update
 *   pnpm docs:check         # verify (CI)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { GAMES } from '../packages/engine/src/games/index.ts';
import { renderMathSection, replaceMathSection } from '../packages/engine/src/math/sheet.ts';

const check = process.argv.includes('--check');
let problems = 0;

for (const game of GAMES) {
  const file = new URL(`../docs/games/${game.id}.md`, import.meta.url);
  const name = `docs/games/${game.id}.md`;
  if (!existsSync(file)) {
    process.stderr.write(`✗ ${name} is missing: copy docs/games/_TEMPLATE.md\n`);
    problems++;
    continue;
  }
  const current = readFileSync(file, 'utf8');
  const next = replaceMathSection(current, renderMathSection(game.mathSummary()));
  if (next === current) {
    process.stdout.write(`✓ ${name}\n`);
  } else if (check) {
    process.stderr.write(`✗ ${name} is out of date: run pnpm docs:sheets\n`);
    problems++;
  } else {
    writeFileSync(file, next);
    process.stdout.write(`↻ ${name} updated\n`);
  }
}

if (GAMES.length === 0) process.stdout.write('No games registered yet: nothing to generate.\n');
if (problems > 0) process.exitCode = 1;
