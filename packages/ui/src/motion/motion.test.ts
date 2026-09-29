import { afterEach, describe, expect, it, vi } from 'vitest';
import { Motion, easeInOutCubic, easeOutBack, easeOutCubic, tween, wait } from './motion.ts';

describe('Motion', () => {
  it('scales durations by level', () => {
    const root = document.createElement('div');
    const full = new Motion({ reducedMotion: false, root });
    expect(full.level).toBe('full');
    expect(full.duration(600)).toBe(600);

    const reduced = new Motion({ reducedMotion: true, root });
    expect(reduced.level).toBe('reduced');
    expect(reduced.duration(600)).toBe(160);

    full.turbo = true;
    expect(full.level).toBe('none');
    expect(full.duration(600)).toBe(0);
    expect(root.dataset.motion).toBe('turbo');
    full.turbo = false;
    expect(root.dataset.motion).toBeUndefined();
  });
});

describe('easings', () => {
  it.each([easeOutCubic, easeInOutCubic, easeOutBack])('%o runs from 0 to 1', (easing) => {
    expect(easing(0)).toBeCloseTo(0, 12);
    expect(easing(1)).toBeCloseTo(1, 12);
  });
});

describe('tween', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the final frame at once for zero durations', async () => {
    const frames: number[] = [];
    await tween(0, (t) => frames.push(t));
    expect(frames).toEqual([1]);
  });

  it('animates through frames and ends exactly at 1', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'performance'] });
    const frames: number[] = [];
    const done = tween(100, (t) => frames.push(t));
    await vi.advanceTimersByTimeAsync(200);
    await done;
    expect(frames.length).toBeGreaterThan(2);
    expect(frames.at(-1)).toBe(1);
    expect(frames.slice(0, -1).every((t) => t >= 0 && t < 1)).toBe(true);
  });

  it('jumps to the end when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const frames: number[] = [];
    await tween(1_000, (t) => frames.push(t), { signal: controller.signal });
    expect(frames).toEqual([1]);
  });
});

describe('wait', () => {
  it('resolves early on abort', async () => {
    const controller = new AbortController();
    const done = wait(60_000, controller.signal);
    controller.abort();
    await expect(done).resolves.toBeUndefined();
  });
});
