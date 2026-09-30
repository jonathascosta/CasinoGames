import { MIRROR_CONFIG, type Cents } from '@casinogames/engine';
import {
  formatCents,
  formatPercent,
  h,
  icon,
  jackpotKey,
  storedMeterAmount,
  type Modal,
} from '@casinogames/ui';
import { gameArt } from '../art/art.ts';
import { GAMES, type GameEntry } from '../catalog.ts';
import type { Page } from '../router/router.ts';
import type { Router } from '../router/router.ts';
import type { Services } from '../services.ts';
import { brand, createTopBar } from '../shell/topbar.ts';
import { isPlayable } from '../tables/index.ts';
import './lobby.css';

/** Tables with a progressive meter, shown live on their card. */
const METERS: Readonly<Partial<Record<string, { readonly id: string; readonly seed: Cents }>>> = {
  mirror: MIRROR_CONFIG.jackpot,
};

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
      const topbar = createTopBar(services, brand(router.href('/')), {
        settings: false,
        house: { statsHref: router.href('/stats') },
      });
      const sheets = new SheetDialogs();
      const cards = GAMES.map((game) => gameCard(game, router, services, sheets));
      outlet.append(
        h(
          'div',
          { class: 'lobby' },
          topbar.element,
          h(
            'section',
            { class: 'hero' },
            h('span', { class: 'cg-eyebrow' }, 'Demo lobby · Virtual chips'),
            h('h1', { class: 'hero__title' }, 'Roll ', h('em', null, '& Deal')),
            h(
              'p',
              { class: 'hero__lede' },
              'Dice rolled by the player. Cards dealt by the dealer.',
            ),
            h(
              'p',
              { class: 'hero__text' },
              'Four original table games for aggregators and live-dealer studios. Every ' +
                'declared RTP is proven exactly and by simulation, on one engine and one ' +
                'table kit, and the RTP stats show how your own rounds compare.',
            ),
          ),
          h(
            'section',
            { class: 'games', 'aria-labelledby': 'games-title' },
            h('h2', { class: 'cg-sr-only', id: 'games-title' }, 'Tables'),
            h('ul', { class: 'games__grid' }, ...cards.map((card) => h('li', null, card.element))),
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
        for (const card of cards) card.destroy();
        sheets.destroy();
      };
    },
  };
}

/**
 * A table's card: its art, the main bet's declared RTP, the name and
 * tagline, a live meter where the table has one, and two actions. Play is a
 * link stretched over the whole card; Game sheet opens the rules and math in
 * a dialog, loaded on first use.
 */
function gameCard(
  game: GameEntry,
  router: Router,
  services: Services,
  sheets: SheetDialogs,
): { element: HTMLElement; destroy: () => void } {
  const playable = isPlayable(game);
  const nameId = `game-${game.slug}`;
  const meter = METERS[game.slug];
  let meterElement: HTMLElement | null = null;
  let stopWatching = (): void => undefined;
  if (meter !== undefined) {
    const read = () => formatCents(storedMeterAmount(services.storage, meter.id, meter.seed));
    const value = h('strong', { class: 'game-card__meter-value cg-num' }, read());
    meterElement = h(
      'p',
      { class: 'game-card__meter' },
      h('span', { class: 'game-card__meter-label' }, 'Progressive'),
      value,
    );
    // Live: a round played at the table in another tab moves the meter here too.
    stopWatching = services.storage.watch(jackpotKey(meter.id), () => {
      value.textContent = read();
    });
  }
  const sheet = h(
    'button',
    { type: 'button', class: 'cg-btn game-card__sheet', 'aria-label': `Game sheet: ${game.name}` },
    icon('paytable'),
    'Game sheet',
  );
  sheet.addEventListener('click', () => {
    void sheets.open(game);
  });
  const rtp = formatPercent(game.rtp);
  const element = h(
    'article',
    {
      class: 'game-card',
      style: `--accent: ${game.accent}`,
      dataset: { slug: game.slug, playable: String(playable) },
      'aria-labelledby': nameId,
    },
    h('div', { class: 'game-card__art' }, gameArt(game)),
    h(
      'div',
      { class: 'game-card__body' },
      h(
        'p',
        {
          class: 'game-card__rtp',
          title: `Declared RTP of the main bet, ${game.mainBet}`,
        },
        h('span', { class: 'game-card__rtp-label' }, 'RTP'),
        ' ',
        h('strong', { class: 'cg-num' }, rtp),
        h('span', { class: 'cg-sr-only' }, `, declared for the main bet, ${game.mainBet}`),
      ),
      h('h3', { class: 'game-card__name', id: nameId }, game.name),
      h('p', { class: 'game-card__tagline' }, game.tagline),
      meterElement,
      h(
        'div',
        { class: 'game-card__actions' },
        h(
          'a',
          {
            class: 'cg-btn cg-btn--primary game-card__play',
            href: router.href(`/${game.slug}`),
            'aria-label': `${playable ? 'Play' : 'Preview'} ${game.name}`,
          },
          icon('play'),
          playable ? 'Play' : 'Preview',
        ),
        sheet,
      ),
    ),
  );
  return { element, destroy: stopWatching };
}

/** The lobby's Game sheet dialogs, built on first use and kept for the visit. */
class SheetDialogs {
  readonly #modals = new Map<string, Modal>();
  #destroyed = false;

  async open(game: GameEntry): Promise<void> {
    let modal = this.#modals.get(game.slug);
    if (modal === undefined) {
      const { loadSheet, createRulesModal } = await import('../tables/shell.ts');
      const sheet = await loadSheet(game.slug);
      if (this.#destroyed) return;
      modal = this.#modals.get(game.slug) ?? createRulesModal(game, sheet, 'Game sheet');
      this.#modals.set(game.slug, modal);
    }
    modal.open();
  }

  destroy(): void {
    this.#destroyed = true;
    for (const modal of this.#modals.values()) modal.destroy();
    this.#modals.clear();
  }
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
