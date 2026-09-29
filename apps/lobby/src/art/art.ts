import { svg } from '@casinogames/ui';
import type { GameEntry } from '../catalog.ts';

const GOLD = '#ddbd77';
const IVORY = '#f7f2e7';

type Node = SVGElement;

/**
 * Table art for each game, drawn as brass line work on the game's accent
 * colour. The motifs illustrate the names (between, target, mirror, lock),
 * not rules, which are still being designed.
 */
export function gameArt(game: GameEntry): SVGSVGElement {
  const id = `art-${game.slug}`;
  return svg(
    'svg',
    {
      class: 'art',
      viewBox: '0 0 320 200',
      role: 'img',
      'aria-label': `${game.name} table art`,
      preserveAspectRatio: 'xMidYMid slice',
    },
    svg(
      'defs',
      null,
      svg(
        'radialGradient',
        { id: `${id}-felt`, cx: '50%', cy: '42%', r: '75%' },
        svg('stop', { offset: '0%', 'stop-color': game.accent, 'stop-opacity': '0.95' }),
        svg('stop', { offset: '55%', 'stop-color': shadeHex(game.accent, 0.42) }),
        svg('stop', { offset: '100%', 'stop-color': '#04110b' }),
      ),
      svg(
        'linearGradient',
        { id: `${id}-sheen`, x1: '0', y1: '0', x2: '0', y2: '1' },
        svg('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0.16' }),
        svg('stop', { offset: '45%', 'stop-color': '#ffffff', 'stop-opacity': '0' }),
      ),
    ),
    svg('rect', { width: 320, height: 200, fill: `url(#${id}-felt)` }),
    svg('rect', {
      x: 10,
      y: 10,
      width: 300,
      height: 180,
      rx: 14,
      fill: 'none',
      stroke: GOLD,
      'stroke-opacity': '0.35',
    }),
    svg(
      'g',
      {
        fill: 'none',
        stroke: GOLD,
        'stroke-width': 1.6,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      ...(MOTIFS[game.slug]?.() ?? []),
    ),
    svg('rect', { width: 320, height: 200, fill: `url(#${id}-sheen)` }),
  );
}

const MOTIFS: Readonly<Record<string, () => Node[]>> = {
  // Two dice with a card standing between them.
  'entre-dados': () => [die(62, 108, 5, -14), card(160, 100, 0), die(258, 108, 2, 12)],
  // A target with motion arcs and a die rolling towards it.
  'alvo-movel': () => [
    svg('circle', { cx: 205, cy: 100, r: 62, 'stroke-opacity': '0.5' }),
    svg('circle', { cx: 205, cy: 100, r: 42, 'stroke-opacity': '0.75' }),
    svg('circle', { cx: 205, cy: 100, r: 21 }),
    svg('circle', { cx: 205, cy: 100, r: 5, fill: IVORY, stroke: 'none' }),
    svg('path', {
      d: 'M52 150 Q 90 110 120 116',
      'stroke-dasharray': '2 6',
      'stroke-opacity': '0.7',
    }),
    svg('path', {
      d: 'M40 128 Q 70 98 100 98',
      'stroke-dasharray': '2 6',
      'stroke-opacity': '0.45',
    }),
    die(118, 118, 6, 20, 26),
  ],
  // Two cards reflected across a dashed axis.
  espelho: () => [
    svg('line', {
      x1: 160,
      y1: 30,
      x2: 160,
      y2: 170,
      'stroke-dasharray': '3 6',
      'stroke-opacity': '0.6',
    }),
    card(112, 100, -8, 'A'),
    card(208, 100, 8, 'A', true),
  ],
  // A padlock whose body holds a die.
  trancar: () => [
    svg('path', {
      d: 'M126 92 V70 a34 34 0 0 1 68 0 V92',
      'stroke-width': 5,
      'stroke-opacity': '0.85',
    }),
    svg('rect', { x: 108, y: 90, width: 104, height: 84, rx: 14, fill: 'rgb(3 14 9 / 0.35)' }),
    die(160, 132, 4, 0, 26),
  ],
};

function die(cx: number, cy: number, value: 2 | 4 | 5 | 6, tilt: number, half = 30): Node {
  const pip = half * 0.5;
  const positions: Record<number, [number, number][]> = {
    2: [
      [-pip, -pip],
      [pip, pip],
    ],
    4: [
      [-pip, -pip],
      [pip, -pip],
      [-pip, pip],
      [pip, pip],
    ],
    5: [
      [-pip, -pip],
      [pip, -pip],
      [0, 0],
      [-pip, pip],
      [pip, pip],
    ],
    6: [
      [-pip, -pip],
      [-pip, 0],
      [-pip, pip],
      [pip, -pip],
      [pip, 0],
      [pip, pip],
    ],
  };
  return svg(
    'g',
    { transform: `translate(${cx} ${cy}) rotate(${tilt})` },
    svg('rect', {
      x: -half,
      y: -half,
      width: half * 2,
      height: half * 2,
      rx: half * 0.28,
      fill: 'rgb(247 242 231 / 0.08)',
    }),
    ...(positions[value] ?? []).map(([x, y]) =>
      svg('circle', { cx: x, cy: y, r: half * 0.12, fill: IVORY, stroke: 'none' }),
    ),
  );
}

function card(cx: number, cy: number, tilt: number, rank = '', mirrored = false): Node {
  const w = 58;
  const h = 82;
  return svg(
    'g',
    { transform: `translate(${cx} ${cy}) rotate(${tilt})${mirrored ? ' scale(-1 1)' : ''}` },
    svg('rect', {
      x: -w / 2,
      y: -h / 2,
      width: w,
      height: h,
      rx: 7,
      fill: 'rgb(247 242 231 / 0.08)',
    }),
    svg('rect', {
      x: -w / 2 + 5,
      y: -h / 2 + 5,
      width: w - 10,
      height: h - 10,
      rx: 4,
      'stroke-opacity': '0.4',
    }),
    rank === ''
      ? svg('path', { d: 'M0 -14 L10 0 L0 14 L-10 0 Z', fill: IVORY, stroke: 'none' })
      : svg(
          'text',
          {
            x: 0,
            y: 12,
            'text-anchor': 'middle',
            fill: IVORY,
            stroke: 'none',
            'font-family': 'Georgia, serif',
            'font-size': 34,
            'font-weight': 600,
          },
          rank,
        ),
  );
}

function shadeHex(hex: string, factor: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.round(((value >> shift) & 0xff) * factor);
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`;
}
