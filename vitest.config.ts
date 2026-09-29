import { defineConfig } from 'vitest/config';

/**
 * One Vitest run, several projects:
 *  - each package/app contributes a fast unit project (`pnpm test`);
 *  - `math` runs the long Monte Carlo suites (`*.math.test.ts`, `pnpm test:math`),
 *    kept out of the pre-commit hook because each one plays millions of rounds.
 */
export default defineConfig({
  test: {
    projects: [
      'packages/*/vitest.config.ts',
      'apps/*/vitest.config.ts',
      {
        test: {
          name: 'math',
          root: './packages/engine',
          include: ['src/**/*.math.test.ts'],
          testTimeout: 10 * 60_000,
        },
      },
    ],
  },
});
