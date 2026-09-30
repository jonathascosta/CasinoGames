import type { DicePair, DieFace, Rng } from '@casinogames/engine';
import { Graphics } from 'pixi.js';
import { mix, readCssColor, shade } from '../dom/css.ts';
import type { DiceView, DieSpot } from '../dice/dice-view.ts';
import {
  FACES,
  PIPS,
  dot,
  fromAxisAngle,
  multiply,
  normalize,
  orientationFor,
  rotate,
  slerp,
  tumble,
  type Quat,
  type Vec3,
} from '../dice/geometry.ts';
import { easeOutCubic } from '../motion/motion.ts';
import { createPixiHost } from './host.ts';

interface DieState {
  x: number;
  y: number;
  /** Height above the felt, in die half-sizes. */
  lift: number;
  q: Quat;
}

interface Palette {
  readonly body: number;
  readonly face: number;
  readonly pip: number;
  readonly pipAccent: number;
}

/**
 * The camera sits above the player's side of the table, tilted 28° from
 * vertical, so dice at rest show their front faces as well as the top.
 */
const CAMERA_TILT = fromAxisAngle([1, 0, 0], (-28 * Math.PI) / 180);
/** Light from the upper left, in view space. */
const LIGHT = normalize([-0.42, 0.62, 0.66]);
const HALF_VECTOR = normalize([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
/** Perspective focal length, in die half-sizes. */
const FOCAL = 7;
const FACE_OUTLINE = roundedSquare(0.9, 0.34, 5);
const PIP_OUTLINE = circle(16);

/**
 * Real 3D dice drawn with PixiJS Graphics: each visible face of the cube is
 * projected with perspective, lit (Lambert + Blinn specular) and bevelled;
 * pips are projected discs. A throw flies the dice from the player's hand,
 * bounces them with decaying height and spins them about a random axis so
 * that the spin reaches zero exactly on the rolled faces. A die kept out of
 * a throw (a locked die) stays exactly where it lies.
 */
export async function createPixiDiceView(
  container: HTMLElement,
  initial: DicePair,
  rng: Rng,
): Promise<DiceView> {
  const host = await createPixiHost(container);
  const palette: Palette = {
    body: readCssColor(container, '--die-body', 0xe9dfcb),
    face: readCssColor(container, '--die-face', 0xfbf6ea),
    pip: readCssColor(container, '--die-pip', 0x19150f),
    pipAccent: readCssColor(container, '--die-pip-accent', 0xa8182a),
  };
  const shadows = new Graphics();
  const bodies = [new Graphics(), new Graphics()] as const;
  host.app.stage.addChild(shadows, ...bodies);

  const jitter = () => rng.next() * 2 - 1;
  let values: DicePair = initial;
  let rest = restLayout();
  const dice: [DieState, DieState] = [
    { ...rest[0], lift: 0, q: orientationFor(initial[0], jitter() * 0.5) },
    { ...rest[1], lift: 0, q: orientationFor(initial[1], jitter() * 0.5) },
  ];
  let holding = 0;
  let holdClock = 0;
  let throwing = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  function size(): number {
    return Math.max(18, Math.min(44, Math.min(host.width, host.height) * 0.1));
  }

  function restLayout(): [{ x: number; y: number }, { x: number; y: number }] {
    const s = size();
    const cx = host.width / 2;
    const cy = host.height * 0.47;
    return [
      { x: cx - s * 1.55 + jitter() * s * 0.25, y: cy + jitter() * s * 0.3 },
      { x: cx + s * 1.55 + jitter() * s * 0.25, y: cy + jitter() * s * 0.3 },
    ];
  }

  function handPosition(index: number): { x: number; y: number } {
    const s = size();
    return { x: host.width / 2 + (index === 0 ? -0.9 : 0.9) * s, y: host.height - s * 1.6 };
  }

  function draw(): void {
    const s = size();
    shadows.clear();
    for (const die of dice) drawShadow(shadows, die, s);
    const order = dice[0].lift <= dice[1].lift ? [0, 1] : [1, 0];
    order.forEach((index, layer) => {
      const graphics = bodies[layer]!;
      graphics.clear();
      drawDie(graphics, dice[index]!, s, palette);
    });
  }

  function show(next: DicePair): void {
    values = next;
    rest = restLayout();
    dice.forEach((die, i) => {
      Object.assign(die, rest[i], { lift: 0, q: orientationFor(next[i]!, jitter() * 0.5) });
    });
    draw();
    host.render();
    notify();
  }

  host.onResize(() => {
    if (!throwing) show(values);
  });

  const axes: Vec3[] = [
    [1, 0.3, 0.2],
    [-0.4, 1, 0.3],
  ];

  function startHoldLoop(): void {
    host.animate((deltaMs) => {
      holdClock += deltaMs / 1000;
      dice.forEach((die, i) => {
        const hand = handPosition(i);
        const wobble = holding * size() * 0.18;
        die.x += (hand.x + Math.sin(holdClock * 31 + i * 2) * wobble - die.x) * 0.35;
        die.y += (hand.y + Math.cos(holdClock * 27 + i) * wobble - die.y) * 0.35;
        die.lift += (0.35 + holding * 0.4 - die.lift) * 0.3;
        const spin = fromAxisAngle(axes[i]!, Math.sin(holdClock * 19 + i * 1.7) * 0.9 * holding);
        die.q = multiply(orientationFor(values[i]!, i * 0.8), spin);
      });
      draw();
      return holding > 0 && !throwing;
    });
  }

  show(initial);

  return {
    show,
    hold(intensity) {
      const wasHolding = holding > 0;
      holding = Math.max(0, Math.min(1, intensity));
      if (holding > 0 && !wasHolding && !throwing) startHoldLoop();
      if (holding === 0 && wasHolding && !throwing) show(values);
    },
    throw(result, options) {
      holding = 0;
      if (options.duration <= 0) {
        show(result);
        return Promise.resolve();
      }
      values = result;
      const keep = options.keep ?? [false, false];
      const from = dice.map((die) => ({ x: die.x, y: die.y, lift: die.lift, q: die.q }));
      const inHand = from.map((start, i) =>
        options.travel && !keep[i]
          ? { ...start, ...handPosition(i), lift: Math.max(start.lift, 1.1) }
          : start,
      );
      const next = restLayout();
      rest = [
        keep[0] ? { x: dice[0].x, y: dice[0].y } : next[0],
        keep[1] ? { x: dice[1].x, y: dice[1].y } : next[1],
      ];
      const plans = result.map((value: DieFace) => ({
        target: orientationFor(value, jitter() * 0.6),
        axis: normalize([jitter(), jitter(), 0.25 * jitter()]),
        spin: options.travel ? Math.PI * 2 * (1.3 + options.power * 2.2) + jitter() : 1.2,
        pace: 1 + jitter() * 0.05,
        bounces: 0,
      }));
      throwing = true;
      let elapsed = 0;
      return new Promise<void>((resolve) => {
        host.animate((deltaMs) => {
          elapsed += deltaMs;
          let done = true;
          for (let i = 0; i < dice.length; i++) {
            if (keep[i]) continue;
            const die = dice[i]!;
            const plan = plans[i]!;
            const start = inHand[i]!;
            const t = Math.min(1, (elapsed / options.duration) * plan.pace);
            if (t < 1) done = false;
            const travel = easeOutCubic(t);
            die.x = start.x + (rest[i]!.x - start.x) * travel;
            die.y = start.y + (rest[i]!.y - start.y) * travel;
            die.lift = options.travel ? bounceHeight(start.lift, t) : start.lift * (1 - t);
            const spun = tumble(plan.target, plan.axis, plan.spin, t);
            die.q = t < 0.12 ? slerp(from[i]!.q, spun, t / 0.12) : spun;
            // Impacts happen where the bounce height touches zero.
            const contacts = Math.floor(t * 3.5 + 0.5);
            if (options.travel && contacts > plan.bounces) {
              plan.bounces = contacts;
              options.onBounce?.(Math.exp(-3.2 * ((contacts - 0.5) / 3.5)));
            }
          }
          draw();
          if (done) {
            throwing = false;
            notify();
            resolve();
          }
          return !done;
        });
      });
    },
    spots(): readonly [DieSpot, DieSpot] {
      const s = size();
      const spot = (die: DieState): DieSpot => ({
        x: die.x,
        y: die.y - die.lift * s * 0.85,
        size: 2 * s * (1 + die.lift * 0.22),
      });
      return [spot(dice[0]), spot(dice[1])];
    },
    onLayout(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      listeners.clear();
      host.destroy();
    },
  };
}

/** Height of a bouncing throw: starts in the hand, three bounces, lands at t = 1. */
function bounceHeight(start: number, t: number): number {
  return start * Math.exp(-3.2 * t) * Math.abs(Math.cos(Math.PI * 3.5 * t));
}

function drawShadow(g: Graphics, die: DieState, s: number): void {
  const x = die.x + s * (0.2 + die.lift * 0.55);
  const y = die.y + s * (0.3 + die.lift * 0.7);
  const radius = s * 1.25 * (1 + die.lift * 0.22);
  const alpha = 0.3 * (1 - Math.min(0.6, die.lift * 0.3));
  for (const k of [1.3, 1.12, 0.95, 0.78]) {
    g.ellipse(x, y, radius * k, radius * k * 0.92).fill({ color: 0x000000, alpha: alpha * 0.26 });
  }
}

function drawDie(g: Graphics, die: DieState, s: number, palette: Palette): void {
  const scale = s * (1 + die.lift * 0.22);
  // Lifted dice come towards the camera and, with the tilt, rise on screen.
  const centerY = die.y - die.lift * s * 0.85;
  const project = (p: Vec3): [number, number] => {
    const k = FOCAL / (FOCAL - p[2]);
    return [die.x + p[0] * scale * k, centerY - p[1] * scale * k];
  };
  const view = multiply(CAMERA_TILT, die.q);

  for (const face of FACES) {
    const n = rotate(view, face.normal);
    if (n[2] <= 0.015) continue;
    const u = rotate(view, face.u);
    const v = rotate(view, face.v);
    const at = (a: number, b: number): Vec3 => [
      n[0] + u[0] * a + v[0] * b,
      n[1] + u[1] * a + v[1] * b,
      n[2] + u[2] * a + v[2] * b,
    ];
    const outline = (points: readonly (readonly [number, number])[], cu = 0, cv = 0, r = 1) =>
      points.flatMap(([a, b]) => project(at(cu + a * r, cv + b * r)));

    const diffuse = Math.max(0, dot(n, LIGHT));
    const specular = Math.max(0, dot(n, HALF_VECTOR)) ** 28;
    const light = 0.64 + 0.42 * diffuse;
    const lit = (color: number, factor = light) =>
      mix(shade(color, factor), 0xffffff, specular * 0.3);

    // Body square, then the rounded face inset: the body shows as a bevel.
    g.poly(outline(SQUARE)).fill({ color: lit(palette.body, light * 0.8) });
    g.poly(outline(FACE_OUTLINE)).fill({ color: lit(palette.face) });
    for (const [pu, pv] of PIPS[face.value]) {
      const radius = face.value === 1 ? 0.27 : 0.17;
      const color = face.value === 1 ? palette.pipAccent : palette.pip;
      g.poly(outline(PIP_OUTLINE, pu, pv, radius)).fill({ color: shade(color, 0.7 + 0.3 * light) });
    }
  }
}

const SQUARE: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

function roundedSquare(half: number, radius: number, steps: number): [number, number][] {
  const points: [number, number][] = [];
  const inner = half - radius;
  const corners: [number, number, number][] = [
    [inner, inner, 0],
    [-inner, inner, Math.PI / 2],
    [-inner, -inner, Math.PI],
    [inner, -inner, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= steps; i++) {
      const angle = start + (i / steps) * (Math.PI / 2);
      points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }
  }
  return points;
}

function circle(steps: number): [number, number][] {
  return Array.from({ length: steps }, (_, i) => {
    const angle = (i / steps) * Math.PI * 2;
    return [Math.cos(angle), Math.sin(angle)];
  });
}
