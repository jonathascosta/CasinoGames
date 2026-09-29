// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Architecture rules live here so they are enforced, not just documented:
 *  - no Math.random anywhere: every random draw goes through an injected Rng;
 *  - the engine is pure: no DOM/browser globals, no UI or rendering imports;
 *  - PixiJS is confined to the animation layer (packages/ui/src/pixi).
 */
const BROWSER_GLOBALS = ['window', 'document', 'navigator', 'localStorage', 'sessionStorage'];

export default defineConfig([
  globalIgnores(['**/dist/', '**/coverage/', '**/node_modules/']),

  js.configs.recommended,

  {
    name: 'repo/typescript',
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  {
    name: 'repo/no-math-random',
    files: ['**/*.{ts,js,mjs}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Math.random is banned: draw from an injected Rng (see packages/engine/src/rng).',
        },
      ],
    },
  },

  {
    name: 'repo/engine-purity',
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...BROWSER_GLOBALS.map((name) => ({
          name,
          message: 'The engine is platform-agnostic: no DOM or browser globals.',
        })),
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@casinogames/ui', '@casinogames/lobby', 'pixi.js', 'pixi.js/*'],
              message: 'The engine must not depend on UI or rendering code.',
            },
          ],
        },
      ],
    },
  },

  {
    name: 'repo/browser',
    files: ['packages/ui/**/*.ts', 'apps/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },

  {
    name: 'repo/pixi-confinement',
    files: ['packages/ui/**/*.ts', 'apps/**/*.ts'],
    ignores: ['packages/ui/src/pixi/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['pixi.js', 'pixi.js/*'],
              message: 'PixiJS is confined to packages/ui/src/pixi (the animation layer).',
            },
          ],
        },
      ],
    },
  },

  {
    name: 'repo/tests',
    files: ['**/*.test.ts'],
    rules: {
      // Tests assert on shapes they just built; non-null assertions keep them readable.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  {
    name: 'repo/javascript',
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  prettier,
]);
