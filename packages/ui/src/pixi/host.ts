import { Application } from 'pixi.js';

/**
 * A PixiJS application sized to its container that only renders when
 * something changes: the ticker runs while animations are active and stops
 * when they finish, so an idle table costs no GPU time or battery.
 */
export interface PixiHost {
  readonly app: Application;
  readonly width: number;
  readonly height: number;
  /** Calls `frame(deltaMs)` every frame until it returns false. */
  animate(frame: (deltaMs: number) => boolean): void;
  /** Renders one frame now (for static changes while idle). */
  render(): void;
  onResize(listener: () => void): void;
  destroy(): void;
}

export async function createPixiHost(container: HTMLElement): Promise<PixiHost> {
  const app = new Application();
  await app.init({
    width: Math.max(1, container.clientWidth),
    height: Math.max(1, container.clientHeight),
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
    // WebGL first, Canvas 2D where WebGL is unavailable.
    preference: ['webgl', 'canvas'],
    autoStart: false,
  });
  app.canvas.classList.add('cg-pixi-canvas');
  container.append(app.canvas);

  const frames = new Set<(deltaMs: number) => boolean>();
  const resizeListeners: (() => void)[] = [];
  let width = app.screen.width;
  let height = app.screen.height;

  app.ticker.add((ticker) => {
    for (const frame of [...frames]) {
      if (!frame(ticker.deltaMS)) frames.delete(frame);
    }
    if (frames.size === 0) app.ticker.stop();
  });

  const observer = new ResizeObserver(() => {
    const nextWidth = Math.max(1, container.clientWidth);
    const nextHeight = Math.max(1, container.clientHeight);
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    app.renderer.resize(width, height);
    for (const listener of resizeListeners) listener();
    app.render();
  });
  observer.observe(container);

  return {
    app,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    animate(frame) {
      frames.add(frame);
      if (!app.ticker.started) app.ticker.start();
    },
    render() {
      app.render();
    },
    onResize(listener) {
      resizeListeners.push(listener);
    },
    destroy() {
      observer.disconnect();
      frames.clear();
      app.destroy(true, { children: true });
    },
  };
}
