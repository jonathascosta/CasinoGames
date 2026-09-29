/**
 * Animation policy for the whole page.
 *
 * - full: every animation plays.
 * - reduced: the OS asks for reduced motion; big movements (tumbles, slides)
 *   are replaced by short fades.
 * - none: turbo mode; results appear instantly.
 *
 * Components read durations from here instead of hard-coding them, so turbo
 * mode and accessibility settings apply everywhere at once. The CSS side is
 * handled by the duration tokens (see theme/tokens.css).
 */
export type MotionLevel = 'full' | 'reduced' | 'none';

export class Motion {
  #turbo = false;
  readonly #reduced: boolean;
  readonly #root: HTMLElement | null;

  constructor(options: { reducedMotion?: boolean; root?: HTMLElement | null } = {}) {
    this.#reduced = options.reducedMotion ?? prefersReducedMotion();
    this.#root = options.root === undefined ? defaultRoot() : options.root;
  }

  get level(): MotionLevel {
    if (this.#turbo) return 'none';
    return this.#reduced ? 'reduced' : 'full';
  }

  get turbo(): boolean {
    return this.#turbo;
  }

  set turbo(turbo: boolean) {
    this.#turbo = turbo;
    if (this.#root === null) return;
    if (turbo) this.#root.dataset.motion = 'turbo';
    else delete this.#root.dataset.motion;
  }

  /** A nominal duration adjusted to the level: unchanged, capped at 160 ms, or 0. */
  duration(ms: number): number {
    switch (this.level) {
      case 'full':
        return ms;
      case 'reduced':
        return Math.min(ms, 160);
      case 'none':
        return 0;
    }
  }
}

/** The page-wide policy used by components that are not given their own. */
export const motion = new Motion();

export function prefersReducedMotion(): boolean {
  // matchMedia is absent outside browsers (tests, server rendering).
  const scope = globalThis as { matchMedia?: (query: string) => MediaQueryList };
  return scope.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function defaultRoot(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.documentElement;
}

export type Easing = (t: number) => number;

export const easeOutCubic: Easing = (t) => 1 - (1 - t) ** 3;
export const easeInOutCubic: Easing = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutBack: Easing = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

/**
 * Calls `frame(progress)` on every animation frame for `durationMs`, with the
 * eased progress from 0 to 1. A zero duration renders the final frame at
 * once. Aborting jumps straight to the end.
 */
export function tween(
  durationMs: number,
  frame: (progress: number) => void,
  options: { easing?: Easing; signal?: AbortSignal } = {},
): Promise<void> {
  const easing = options.easing ?? easeOutCubic;
  if (durationMs <= 0 || options.signal?.aborted === true) {
    frame(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      if (t >= 1 || options.signal?.aborted === true) {
        frame(1);
        resolve();
        return;
      }
      frame(easing(t));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/** Resolves after `ms` (immediately for 0), or early when `signal` aborts. */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted === true) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
