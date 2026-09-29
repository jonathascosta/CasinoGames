import '@casinogames/ui/theme.css';
import './shell/app.css';
import { GAMES } from './catalog.ts';
import { lobbyPage } from './pages/lobby.ts';
import { notFoundPage } from './pages/not-found.ts';
import { createRouter } from './router/router.ts';
import { createServices } from './services.ts';

const outlet = document.getElementById('app');
if (outlet === null) throw new Error('Missing #app outlet');

const services = createServices();

const router = createRouter({
  outlet,
  base: import.meta.env.BASE_URL,
  titleSuffix: ' · Original Table Games',
  notFound: ({ router: r }) => notFoundPage(services, r),
  routes: [
    { path: '/', load: ({ router: r }) => lobbyPage(services, r) },
    {
      path: '/:slug',
      // Tables load on demand: the lobby never downloads table code or PixiJS.
      load: async ({ router: r, params }) => {
        const game = GAMES.find((entry) => entry.slug === params.slug);
        if (game === undefined) return notFoundPage(services, r);
        const { gamePage } = await import('./pages/game.ts');
        return gamePage(game, services, r);
      },
    },
  ],
});

void router.start();
