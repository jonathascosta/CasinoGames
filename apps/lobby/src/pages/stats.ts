import { GAMES as ENGINE_GAMES, type Cents, type MathSummary } from '@casinogames/engine';
import {
  RtpPanel,
  RtpTracker,
  createStore,
  formatCents,
  formatCount,
  formatPercent,
  formatPoints,
  h,
  liveRtp,
  storedMeterAmount,
  rtpKey,
  type RtpStats,
  type Store,
} from '@casinogames/ui';
import { GAMES, type GameEntry } from '../catalog.ts';
import type { Page, Router } from '../router/router.ts';
import type { Services } from '../services.ts';
import { brand, createTopBar } from '../shell/topbar.ts';
import { siteFooter } from './lobby.ts';
import './stats.css';

/** One table's stats on the page: its tracker, its RTP monitor and its figures. */
interface GameStats {
  readonly game: GameEntry;
  readonly math: MathSummary;
  readonly tracker: RtpTracker;
  readonly panel: RtpPanel;
  readonly release: () => void;
}

/**
 * The RTP stats of every table in one place: the rounds this browser has
 * played, what they returned against what the declared RTPs make of the
 * same stakes, and each table's RTP monitor with its bets, declared against
 * observed. Tables played in another tab show up here as they settle.
 */
export function statsPage(services: Services, router: Router): Page {
  return {
    title: 'RTP stats',
    mount(outlet) {
      const maths = new Map(GAMES.map((game) => [game.slug, mathOf(game)]));
      const summary = h('div', { class: 'stats__summary' });
      const byGame = h('div', { class: 'stats__table' });
      const sections = new Map(
        GAMES.map((game) => [
          game.slug,
          h(
            'section',
            { class: 'stats__game', 'aria-labelledby': `stats-${game.slug}` },
            h(
              'header',
              { class: 'stats__game-header' },
              h('h3', { id: `stats-${game.slug}` }, game.name),
              h(
                'a',
                {
                  class: 'cg-btn stats__play',
                  href: router.href(`/${game.slug}`),
                  'aria-label': `Play ${game.name}`,
                },
                'Play',
              ),
            ),
          ),
        ]),
      );
      const entries = new Map<string, GameStats>();

      const render = () => {
        const all = GAMES.map((game) => ({ game, entry: entries.get(game.slug)! }));
        renderSummary(summary, all);
        renderByGame(byGame, all);
      };
      // A table's stats are read from storage afresh: at mount, after a reset,
      // and when another tab settles a round there.
      const load = (game: GameEntry) => {
        const previous = entries.get(game.slug);
        const math = maths.get(game.slug)!;
        const tracker = new RtpTracker({ gameId: game.slug, storage: services.storage });
        const meters = metersOf(math, services);
        const panel = new RtpPanel({
          tracker,
          math,
          collapsed: tracker.stats.rounds === 0,
          ...(meters === undefined ? {} : { meters }),
        });
        const section = sections.get(game.slug)!;
        if (previous === undefined) {
          section.append(panel.element);
        } else {
          previous.panel.element.replaceWith(panel.element);
          previous.release();
        }
        const unsubscribe = tracker.subscribe(render);
        const unwatch = services.storage.watch(rtpKey(game.slug), () => {
          load(game);
          render();
        });
        entries.set(game.slug, {
          game,
          math,
          tracker,
          panel,
          release: () => {
            unsubscribe();
            unwatch();
            panel.destroy();
          },
        });
      };
      const loadAll = () => {
        for (const game of GAMES) load(game);
        render();
      };

      const topbar = createTopBar(services, brand(router.href('/')), {
        settings: false,
        house: { statsHref: router.href('/stats'), onStatsReset: loadAll },
      });
      loadAll();
      outlet.append(
        h(
          'div',
          { class: 'stats-page' },
          topbar.element,
          h(
            'main',
            { class: 'stats' },
            h('span', { class: 'cg-eyebrow' }, 'All tables · This browser'),
            h('h1', { class: 'stats__title' }, 'RTP stats'),
            h(
              'p',
              { class: 'stats__intro' },
              'Every round settled at the four tables on this device, against the declared ' +
                'RTP of each bet. The expected return applies the declared RTPs to the same ' +
                'stakes, so the two can be compared directly. Stats stay in this browser and ' +
                'reset from the bar above.',
            ),
            summary,
            h('h2', { class: 'stats__heading' }, 'By table'),
            byGame,
            h('h2', { class: 'stats__heading' }, 'By bet'),
            h(
              'p',
              { class: 'stats__intro' },
              "Each table's RTP monitor: per bet, the observed RTP beside the declared one, " +
                'and how it converges into the band where it should sit 95% of the time.',
            ),
            h('div', { class: 'stats__games' }, ...sections.values()),
            h(
              'ul',
              { class: 'stats__notes' },
              h(
                'li',
                null,
                "Lock & Roll's declared RTP assumes the reference strategy; other decisions " +
                  'return less, and its fees count against the return.',
              ),
              h(
                'li',
                null,
                "Double Sixes' declared RTP excludes the meter's seed, which the house funds; " +
                  "Mirror's monitor also shows the RTP at the meter as it stands.",
              ),
            ),
          ),
          siteFooter(),
        ),
      );
      return () => {
        for (const entry of entries.values()) entry.release();
        topbar.destroy();
      };
    },
  };
}

function mathOf(game: GameEntry): MathSummary {
  const registered = ENGINE_GAMES.find((entry) => entry.id === game.slug);
  if (registered === undefined) throw new Error(`No math registered for ${game.slug}`);
  return registered.mathSummary();
}

/** A progressive bet's meter as the table left it, for its RTP at the current meter. */
function metersOf(math: MathSummary, services: Services): Record<string, Store<Cents>> | undefined {
  const meters: Record<string, Store<Cents>> = {};
  for (const bet of math.bets) {
    if (bet.progressive === undefined) continue;
    const { jackpotId, seed } = bet.progressive;
    meters[jackpotId] = createStore(storedMeterAmount(services.storage, jackpotId, seed));
  }
  return Object.keys(meters).length === 0 ? undefined : meters;
}

interface Totals {
  readonly rounds: number;
  readonly staked: number;
  readonly returned: number;
  readonly fees: number;
  /** What the declared RTPs return on the same stakes, bet by bet. */
  readonly expected: number;
}

function totalsOf(stats: RtpStats, math: MathSummary): Totals {
  let expected = 0;
  for (const bet of math.bets) expected += (stats.bets[bet.betId]?.staked ?? 0) * bet.rtp;
  return {
    rounds: stats.rounds,
    staked: stats.staked,
    returned: stats.returned,
    fees: stats.fees,
    expected,
  };
}

function sum(all: readonly Totals[]): Totals {
  return all.reduce(
    (total, next) => ({
      rounds: total.rounds + next.rounds,
      staked: total.staked + next.staked,
      returned: total.returned + next.returned,
      fees: total.fees + next.fees,
      expected: total.expected + next.expected,
    }),
    { rounds: 0, staked: 0, returned: 0, fees: 0, expected: 0 },
  );
}

interface Row {
  readonly game: GameEntry;
  readonly entry: GameStats;
}

function renderSummary(element: HTMLElement, rows: readonly Row[]): void {
  const total = sum(rows.map(({ entry }) => totalsOf(entry.tracker.stats, entry.math)));
  if (total.rounds === 0) {
    element.replaceChildren(
      h(
        'p',
        { class: 'stats__empty' },
        'No rounds yet. Play any table and every round you settle is counted here.',
      ),
    );
    return;
  }
  const observed = liveRtp(total);
  const expected = total.expected / total.staked;
  element.replaceChildren(
    h(
      'dl',
      { class: 'stats__totals' },
      figure('Rounds', formatCount(total.rounds)),
      figure('Wagered', formatCents(total.staked)),
      figure('Won', formatCents(total.returned)),
      total.fees > 0 ? figure('Fees', formatCents(total.fees)) : null,
      figure('Net', formatCents(total.returned - total.staked - total.fees, { sign: true })),
      figure('Observed RTP', formatPercent(observed), 'stats__figure--key'),
      figure(
        'Expected RTP',
        formatPercent(expected),
        undefined,
        `${formatPoints(observed - expected)} observed`,
      ),
    ),
  );
}

function figure(label: string, value: string, extra?: string, note?: string): HTMLElement {
  return h(
    'div',
    { class: extra === undefined ? 'stats__figure' : `stats__figure ${extra}` },
    h('dt', null, label),
    h('dd', { class: 'cg-num' }, value),
    note === undefined ? null : h('dd', { class: 'stats__figure-note cg-num' }, note),
  );
}

function renderByGame(element: HTMLElement, rows: readonly Row[]): void {
  const cells = rows.map(({ game, entry }) => {
    const totals = totalsOf(entry.tracker.stats, entry.math);
    const played = totals.staked > 0;
    return h(
      'tr',
      null,
      h('th', { scope: 'row' }, game.name),
      h('td', { class: 'cg-num' }, formatCount(totals.rounds)),
      h('td', { class: 'cg-num stats__wagered' }, formatCents(totals.staked)),
      h('td', { class: 'cg-num' }, played ? formatPercent(liveRtp(totals)) : '—'),
      h('td', { class: 'cg-num' }, played ? formatPercent(totals.expected / totals.staked) : '—'),
    );
  });
  element.replaceChildren(
    h(
      'table',
      null,
      h('caption', { class: 'cg-sr-only' }, 'Rounds, wagers and RTP by table'),
      h(
        'thead',
        null,
        h(
          'tr',
          null,
          h('th', { scope: 'col' }, 'Table'),
          h('th', { scope: 'col' }, 'Rounds'),
          h('th', { scope: 'col', class: 'stats__wagered' }, 'Wagered'),
          h('th', { scope: 'col' }, 'Observed'),
          h('th', { scope: 'col' }, 'Expected'),
        ),
      ),
      h('tbody', null, ...cells),
    ),
  );
}
