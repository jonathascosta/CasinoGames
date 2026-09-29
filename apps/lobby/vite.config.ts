import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * BASE_PATH is set by the Pages workflow to "/<repo>/"; locally the site is
 * served from the root.
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
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
