import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin, type Rolldown } from 'vite';
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
      // A failed build wrote no index.html: leave the error to speak.
      if (!existsSync(index)) return;
      for (const slug of slugs) {
        mkdirSync(join(outDir, slug), { recursive: true });
        copyFileSync(index, join(outDir, slug, 'index.html'));
      }
      copyFileSync(index, join(outDir, '404.html'));
    },
  };
}

/**
 * Publishes a file kept outside the app at the site's root: served by the dev
 * server, copied into the build. The submission pack lives in docs/, where
 * tools/generate-docs.ts writes it and CI checks it.
 */
function publishFile(source: string, name: string, type: string): Plugin {
  let outDir = 'dist';
  let base = '/';
  return {
    name: 'casinogames:publish-file',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      base = config.base;
    },
    configureServer(server) {
      server.middlewares.use(`${base}${name}`, (_request, response) => {
        response.setHeader('Content-Type', type);
        response.end(readFileSync(source));
      });
    },
    closeBundle() {
      if (!existsSync(outDir)) return;
      copyFileSync(source, join(outDir, name));
    },
  };
}

/**
 * Fails the build if PixiJS could load before a table asks for it. The
 * tables open on CSS dice and DOM cards and load PixiJS on the player's first
 * interaction (see DiceRoller.enhance): only the kit's PixiJS views,
 * packages/ui/src/pixi/, may bring it in. A module that shares a chunk with
 * PixiJS (even a bundler helper) can drag PixiJS into a page's first load,
 * which costs a phone seconds before the table first paints.
 */
function pixiOnDemandOnly(): Plugin {
  const pixi = /[\\/]node_modules[\\/]pixi\.js[\\/]/;
  const views = /[\\/]packages[\\/]ui[\\/]src[\\/]pixi[\\/]/;
  return {
    name: 'casinogames:pixi-on-demand-only',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = new Map<string, Rolldown.OutputChunk>();
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk') chunks.set(file.fileName, file);
      }
      // Everything the site may load, on navigation or on demand, short of
      // the PixiJS views themselves.
      const reachable = new Set<string>();
      const visit = (name: string): void => {
        const chunk = chunks.get(name);
        if (chunk === undefined || reachable.has(name) || views.test(chunk.facadeModuleId ?? '')) {
          return;
        }
        reachable.add(name);
        for (const next of [...chunk.imports, ...chunk.dynamicImports]) visit(next);
      };
      for (const chunk of chunks.values()) if (chunk.isEntry) visit(chunk.fileName);
      const carriers = [...reachable].filter((name) =>
        chunks.get(name)?.moduleIds.some((id) => pixi.test(id)),
      );
      if (carriers.length > 0) {
        this.error(
          `PixiJS would load before a table asks for it, through ${carriers.join(', ')}. ` +
            'Only packages/ui/src/pixi/ may import pixi.js, itself loaded with import(); ' +
            'look for a module the site loads that shares one of these chunks.',
        );
      }
    },
  };
}

/**
 * BASE_PATH is set by the Pages workflow to "/<repo>/"; locally the site is
 * served from the root.
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    pixiOnDemandOnly(),
    staticRoutes([...GAMES.map((game) => game.slug), 'stats']),
    publishFile(
      resolve(import.meta.dirname, '../../docs/SUBMISSION-PACK.pdf'),
      'SUBMISSION-PACK.pdf',
      'application/pdf',
    ),
  ],
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
