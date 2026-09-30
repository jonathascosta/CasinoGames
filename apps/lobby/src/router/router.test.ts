import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appPath,
  createRouter,
  matchRoute,
  normalizeBase,
  type Page,
  type Route,
} from './router.ts';

function page(title: string, onUnmount = () => undefined): Page {
  return {
    title,
    mount(outlet) {
      const heading = document.createElement('h1');
      heading.textContent = title;
      outlet.append(heading);
      return onUnmount;
    },
  };
}

function setup(base = '/CasinoGames/') {
  const outlet = document.createElement('main');
  document.body.append(outlet);
  const unmountLobby = vi.fn();
  const routes: Route[] = [
    { path: '/', load: () => page('Lobby', unmountLobby) },
    { path: '/:slug', load: ({ params }) => Promise.resolve(page(`Game ${params.slug!}`)) },
  ];
  const router = createRouter({
    routes,
    outlet,
    base,
    notFound: () => page('Not found'),
    titleSuffix: ' · Demo',
  });
  return { router, outlet, unmountLobby };
}

describe('router helpers', () => {
  it('normalises bases and strips them from paths', () => {
    expect(normalizeBase('/CasinoGames/')).toBe('/CasinoGames');
    expect(normalizeBase('/')).toBe('');
    expect(appPath('/CasinoGames/mirror/', '/CasinoGames')).toBe('/mirror');
    expect(appPath('/CasinoGames/', '/CasinoGames')).toBe('/');
    expect(appPath('/CasinoGames', '/CasinoGames')).toBe('/');
    expect(appPath('/index.html', '')).toBe('/');
  });

  it('matches static and parameterised routes', () => {
    const routes: Route[] = [
      { path: '/', load: () => page('a') },
      { path: '/:slug', load: () => page('b') },
    ];
    expect(matchRoute(routes, '/')?.route).toBe(routes[0]);
    expect(matchRoute(routes, '/caf%C3%A9')?.params).toEqual({ slug: 'café' });
    expect(matchRoute(routes, '/a/b')).toBeNull();
  });
});

describe('createRouter', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
    history.replaceState(null, '', '/');
  });

  it('renders the page for the current URL, with title and focus', async () => {
    history.replaceState(null, '', '/CasinoGames/mirror');
    const { router, outlet } = setup();
    await router.start();
    expect(outlet.textContent).toBe('Game mirror');
    expect(document.title).toBe('Game mirror · Demo');
    expect(document.activeElement).toBe(outlet.querySelector('h1'));
    router.destroy();
  });

  it('navigates with pushState, unmounting the previous page', async () => {
    history.replaceState(null, '', '/CasinoGames/');
    const { router, outlet, unmountLobby } = setup();
    await router.start();
    await router.navigate('/lock-and-roll');
    expect(location.pathname).toBe('/CasinoGames/lock-and-roll');
    expect(outlet.textContent).toBe('Game lock-and-roll');
    expect(unmountLobby).toHaveBeenCalledTimes(1);
    expect(router.href('/')).toBe('/CasinoGames/');
    router.destroy();
  });

  it('intercepts in-app links but not new tabs, other documents or other sites', async () => {
    history.replaceState(null, '', '/CasinoGames/');
    const { router, outlet } = setup();
    await router.start();
    const link = (href: string, attrs: Record<string, string> = {}) => {
      const a = document.createElement('a');
      a.href = href;
      for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
      document.body.append(a);
      return a;
    };
    const click = (a: HTMLAnchorElement, init: MouseEventInit = {}) => {
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...init,
      });
      a.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(click(link('/CasinoGames/moving-target'))).toBe(true);
    await vi.waitFor(() => {
      expect(outlet.textContent).toBe('Game moving-target');
    });
    expect(click(link('/CasinoGames/mirror'), { metaKey: true })).toBe(false);
    expect(click(link('/CasinoGames/mirror', { target: '_blank' }))).toBe(false);
    expect(click(link('/CasinoGames/dev.html'))).toBe(false);
    expect(click(link('https://example.com/CasinoGames/mirror'))).toBe(false);
    expect(click(link('/elsewhere/mirror'))).toBe(false);
    router.destroy();
  });

  it('shows the not-found page for unknown paths and follows history', async () => {
    history.replaceState(null, '', '/CasinoGames/a/b');
    const { router, outlet } = setup();
    await router.start();
    expect(outlet.textContent).toBe('Not found');
    history.replaceState(null, '', '/CasinoGames/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => {
      expect(outlet.textContent).toBe('Lobby');
    });
    router.destroy();
  });

  it('works at the site root too', async () => {
    history.replaceState(null, '', '/mirror/');
    const { router, outlet } = setup('/');
    await router.start();
    expect(outlet.textContent).toBe('Game mirror');
    expect(router.href('/mirror')).toBe('/mirror');
    router.destroy();
  });
});
