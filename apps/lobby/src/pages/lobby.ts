import { h } from '@casinogames/ui';
import { gameArt } from '../art/art.ts';
import { GAMES, type GameEntry } from '../catalog.ts';
import type { Page } from '../router/router.ts';
import type { Router } from '../router/router.ts';
import type { Services } from '../services.ts';
import { brand, createTopBar } from '../shell/topbar.ts';
import { isPlayable } from '../tables/index.ts';
import './lobby.css';

const PILLARS = [
  {
    title: 'Deterministic engine',
    text:
      'Every outcome is drawn from an injected RNG: Web Crypto in play, seeded xoshiro128** ' +
      'in tests, so any round can be replayed. Pure TypeScript with zero dependencies — it ' +
      'runs unchanged on a server.',
  },
  {
    title: 'Verifiable math',
    text:
      'Paytables and declared RTPs are generated from code and proven twice: exactly, by ' +
      'running the game over every possible draw, and by seeded multi-million-round ' +
      'simulations. Each table shows its live RTP converging.',
  },
  {
    title: 'Built for any screen',
    text:
      'Mobile-first from 360 px, portrait or landscape, touch or keyboard. 3D dice and dealt ' +
      'cards in PixiJS, loaded only at the table; turbo mode and reduced motion respected.',
  },
] as const;

export function lobbyPage(services: Services, router: Router): Page {
  return {
    title: 'Demo lobby',
    mount(outlet) {
      const topbar = createTopBar(services, brand(router.href('/')));
      outlet.append(
        h(
          'div',
          { class: 'lobby' },
          topbar.element,
          h(
            'section',
            { class: 'hero' },
            h('span', { class: 'cg-eyebrow' }, 'Demo lobby · Virtual chips'),
            h('h1', { class: 'hero__title' }, 'Four original table games'),
            h(
              'p',
              { class: 'hero__lede' },
              'Dice rolled by the player. Cards dealt by the dealer.',
            ),
            h(
              'p',
              { class: 'hero__text' },
              'A portfolio build for aggregators and live-dealer studios. Entre Dados and Alvo ' +
                'Móvel are open, with their math proven exactly and by simulation; the other two ' +
                'tables are in development on the same engine and table kit.',
            ),
          ),
          h(
            'section',
            { class: 'games', 'aria-labelledby': 'games-title' },
            h('h2', { class: 'cg-sr-only', id: 'games-title' }, 'Tables'),
            h(
              'ul',
              { class: 'games__grid' },
              ...GAMES.map((game) => h('li', null, gameCard(game, router))),
            ),
          ),
          h(
            'section',
            { class: 'pillars', 'aria-labelledby': 'pillars-title' },
            h('h2', { id: 'pillars-title', class: 'pillars__title' }, 'Under the hood'),
            h(
              'ul',
              { class: 'pillars__list' },
              ...PILLARS.map((pillar) =>
                h(
                  'li',
                  { class: 'pillar' },
                  h('h3', null, pillar.title),
                  h('p', null, pillar.text),
                ),
              ),
            ),
          ),
          siteFooter(),
        ),
      );
      return () => {
        topbar.destroy();
      };
    },
  };
}

function gameCard(game: GameEntry, router: Router): HTMLAnchorElement {
  const playable = isPlayable(game);
  return h(
    'a',
    {
      class: 'game-card',
      href: router.href(`/${game.slug}`),
      style: `--accent: ${game.accent}`,
      dataset: { playable: String(playable) },
    },
    h('div', { class: 'game-card__art' }, gameArt(game)),
    h(
      'div',
      { class: 'game-card__body' },
      h('span', { class: 'game-card__status' }, playable ? 'Open · play now' : 'In development'),
      h('h3', { class: 'game-card__name' }, game.name),
      h('p', { class: 'game-card__gloss' }, `“${game.gloss}”`),
      h(
        'span',
        { class: 'game-card__cta', 'aria-hidden': 'true' },
        playable ? 'Take a seat' : 'Preview the table',
      ),
    ),
  );
}

export function siteFooter(): HTMLElement {
  return h(
    'footer',
    { class: 'site-footer' },
    h(
      'p',
      null,
      'Demo for B2B evaluation. Virtual chips only — no real-money play. 18+. ' +
        'Please play responsibly.',
    ),
    h(
      'nav',
      { 'aria-label': 'Developer links' },
      h('a', { href: `${import.meta.env.BASE_URL}dev.html` }, 'Component playground'),
    ),
  );
}
