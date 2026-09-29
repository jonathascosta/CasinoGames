/**
 * A small History API router. Pages are loaded on demand, links inside the
 * app are intercepted, and every navigation updates the title, resets the
 * scroll and moves focus to the new page's heading for screen readers.
 */
export interface PageContext {
  readonly router: Router;
  /** Route parameters, e.g. { slug } for "/:slug". */
  readonly params: Readonly<Record<string, string>>;
}

export interface Page {
  readonly title: string;
  /** Renders into `outlet` and returns the cleanup to run on navigation. */
  mount(outlet: HTMLElement): () => void;
}

export interface Route {
  /** "/", "/about" or with parameters, "/:slug". */
  readonly path: string;
  readonly load: (context: PageContext) => Page | Promise<Page>;
}

export interface RouterOptions {
  readonly routes: readonly Route[];
  readonly outlet: HTMLElement;
  /** Deployment base, e.g. "/CasinoGames/" (Vite's BASE_URL). */
  readonly base?: string;
  readonly notFound: (context: PageContext) => Page | Promise<Page>;
  readonly titleSuffix?: string;
}

export interface Router {
  /** Path inside the app, without the base ("/", "/espelho"). */
  readonly path: string;
  /** Absolute URL path for an app path, e.g. href("/espelho"). */
  href(path: string): string;
  navigate(path: string, options?: { replace?: boolean }): Promise<void>;
  start(): Promise<void>;
  destroy(): void;
}

export function createRouter(options: RouterOptions): Router {
  const base = normalizeBase(options.base ?? '/');
  let cleanup: (() => void) | undefined;
  let renderToken = 0;

  const router: Router = {
    get path() {
      return appPath(location.pathname, base);
    },
    href(path) {
      const clean = path.startsWith('/') ? path : `/${path}`;
      return base === '' ? clean : clean === '/' ? `${base}/` : `${base}${clean}`;
    },
    async navigate(path, { replace = false } = {}) {
      const url = router.href(path);
      if (url !== location.pathname) {
        if (replace) history.replaceState(null, '', url);
        else history.pushState(null, '', url);
      }
      await render();
    },
    async start() {
      document.addEventListener('click', onClick);
      window.addEventListener('popstate', onPopState);
      await render();
    },
    destroy() {
      document.removeEventListener('click', onClick);
      window.removeEventListener('popstate', onPopState);
      cleanup?.();
      cleanup = undefined;
    },
  };

  async function render(): Promise<void> {
    const token = ++renderToken;
    const path = router.path;
    const match = matchRoute(options.routes, path);
    const context: PageContext = { router, params: match?.params ?? {} };
    const page = await (match === null ? options.notFound(context) : match.route.load(context));
    // A newer navigation started while this page was loading.
    if (token !== renderToken) return;

    cleanup?.();
    options.outlet.replaceChildren();
    cleanup = page.mount(options.outlet);
    document.title =
      options.titleSuffix === undefined ? page.title : `${page.title}${options.titleSuffix}`;
    window.scrollTo(0, 0);
    const heading = options.outlet.querySelector<HTMLElement>('h1');
    if (heading !== null) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  function onClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest('a');
    if (anchor === null) return;
    if (anchor.target !== '' && anchor.target !== '_self') return;
    if (anchor.hasAttribute('download') || anchor.dataset.router === 'off') return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin) return;
    if (base !== '' && url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return;
    // Other documents of the build (e.g. dev.html) load normally.
    if (/\.[a-z0-9]+$/i.test(url.pathname)) return;
    event.preventDefault();
    void router.navigate(appPath(url.pathname, base));
  }

  function onPopState(): void {
    void render();
  }

  return router;
}

/** "/CasinoGames/" → "/CasinoGames"; "/" → "". */
export function normalizeBase(base: string): string {
  const trimmed = base.replace(/\/+$/, '');
  return trimmed === '' ? '' : trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** The app path for a URL path: base and trailing slash removed. */
export function appPath(pathname: string, base: string): string {
  let path = pathname;
  if (base !== '' && (path === base || path.startsWith(`${base}/`))) path = path.slice(base.length);
  path = path.replace(/\/index\.html$/, '/').replace(/\/+$/, '');
  return path === '' ? '/' : path;
}

export function matchRoute(
  routes: readonly Route[],
  path: string,
): { route: Route; params: Record<string, string> } | null {
  const segments = path.split('/').filter(Boolean);
  for (const route of routes) {
    const pattern = route.path.split('/').filter(Boolean);
    if (pattern.length !== segments.length) continue;
    const params: Record<string, string> = {};
    const matches = pattern.every((part, i) => {
      const segment = segments[i]!;
      if (part.startsWith(':')) {
        params[part.slice(1)] = decodeURIComponent(segment);
        return true;
      }
      return part === segment;
    });
    if (matches) return { route, params };
  }
  return null;
}
