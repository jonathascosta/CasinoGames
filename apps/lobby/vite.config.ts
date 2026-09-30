import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { GAMES } from './src/catalog.ts';

/**
 * GitHub Pages serves static files only. Writing index.html into a folder per
 * route makes deep links such as /<repo>/mirror/ load with a 200, and
 * 404.html lets the router handle any other path.
 */
function staticRoutes(slugs: readonly string[]): Plugin {
  let outDir = 'dist';
  return {
    name: 'casinogames:static-routes',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const index = join(outDir, 'index.html');
      for (const slug of slugs) {
        mkdirSync(join(outDir, slug), { recursive: true });
        copyFileSync(index, join(outDir, slug, 'index.html'));
      }
      copyFileSync(index, join(outDir, '404.html'));
    },
  };
}

/**
 * BASE_PATH is set by the Pages workflow to "/<repo>/"; locally the site is
 * served from the root.
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [staticRoutes(GAMES.map((game) => game.slug))],
  build: {
    target: 'es2022',
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        dev: resolve(import.meta.dirname, 'dev.html'),
      },
    },
  },
});
